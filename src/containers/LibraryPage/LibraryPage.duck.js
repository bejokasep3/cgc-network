import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { storableError } from '../../util/errors';
import { CGC_UGC_PROCESS_NAME } from '../../transactions/transaction';
import { states } from '../../transactions/transactionProcessCGCUGC';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';

const LIBRARY_PAGE_SIZE = 100;

// A collaboration's assets only count as "final" once content has actually
// been received — canceled/disputed-away collaborations never delivered
// anything to freeze into the library.
const FINAL_STATES = [
  states.RECEIVED,
  states.COMPLETED,
  states.REVIEWED,
  states.REVIEWED_BY_CUSTOMER,
  states.REVIEWED_BY_PROVIDER,
].map(s => `state/${s}`);

const entityRefs = entities => entities.map(entity => ({ id: entity.id, type: entity.type }));

/**
 * A brand's own completed collaborations (IMPLEMENTATION-PLAN.md F6.2) —
 * `only: 'order'` scopes the query to transactions this brand is the
 * customer on, the same mechanism ManageCampaignsPage.duck.js already
 * relies on for "my campaigns". No Integration API involved: this is the
 * brand's own data, readable with their own session.
 */
export const fetchLibraryTransactionsThunk = createAsyncThunk(
  'LibraryPage/fetchTransactions',
  (_, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .query({
        only: 'order',
        processNames: [CGC_UGC_PROCESS_NAME],
        states: FINAL_STATES.join(','),
        include: ['listing', 'provider', 'provider.profileImage'],
        'fields.transaction': ['processName', 'protectedData'],
        'fields.listing': ['title'],
        'fields.user': ['profile.displayName', 'profile.abbreviatedName'],
        'fields.image': ['variants.square-small', 'variants.square-small2x'],
        perPage: LIBRARY_PAGE_SIZE,
      })
      .then(response => {
        dispatch(addMarketplaceEntities(response));

        // Each transaction's protectedData.projectId points at the project
        // listing (not the transaction's own `listing` relationship, which
        // is the creator-profile) — batch-fetch every distinct one so
        // usageRights/platforms can be read per asset without an N+1 fetch.
        const projectIds = [
          ...new Set(
            response.data.data
              .map(tx => tx.attributes?.protectedData?.projectId)
              .filter(Boolean)
          ),
        ];

        const fetchProjectListings = projectIds.length
          ? sdk.listings
              .query({ ids: projectIds, 'fields.listing': ['title', 'publicData'] })
              .then(listingsResponse => dispatch(addMarketplaceEntities(listingsResponse)))
          : Promise.resolve();

        return fetchProjectListings.then(() => entityRefs(response.data.data));
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const initialState = {
  transactionRefs: [],
  fetchInProgress: false,
  fetchError: null,
};

const libraryPageSlice = createSlice({
  name: 'LibraryPage',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchLibraryTransactionsThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchLibraryTransactionsThunk.fulfilled, (state, action) => {
        state.fetchInProgress = false;
        state.transactionRefs = action.payload;
      })
      .addCase(fetchLibraryTransactionsThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.payload || storableError(action.error);
      });
  },
});

export default libraryPageSlice.reducer;
