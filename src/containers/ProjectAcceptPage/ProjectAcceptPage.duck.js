import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { denormalisedResponseEntities } from '../../util/data';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { CGC_APPLICATION_PROCESS_NAME, CGC_UGC_PROCESS_NAME } from '../../transactions/transaction';
import { transitions as ugcTransitions } from '../../transactions/transactionProcessCGCUGC';

const entityRef = entity => (entity ? { id: entity.id, type: entity.type } : null);

/**
 * B9's confirmation-before-payment screen (IMPLEMENTATION-PLAN.md F2.6) needs
 * the accepted cgc-application transaction itself — creator, agreed price,
 * ready-by date, note. `only: 'sale'` scopes this to the signed-in brand's
 * own transactions (they are provider on cgc-application), so there's no
 * risk of fetching another brand's application by guessing an id.
 */
export const fetchApplicationThunk = createAsyncThunk(
  'ProjectAcceptPage/fetchApplication',
  ({ applicationId }, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .show({
        id: applicationId,
        include: ['customer', 'customer.profileImage'],
        'fields.transaction': ['processName', 'protectedData', 'metadata', 'lastTransition', 'createdAt'],
        'fields.user': ['profile.displayName', 'profile.abbreviatedName', 'banned'],
        'fields.image': ['variants.square-small', 'variants.square-small2x'],
      })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        const [tx] = denormalisedResponseEntities(response);
        if (tx?.attributes?.processName !== CGC_APPLICATION_PROCESS_NAME) {
          throw new Error('Not a cgc-application transaction.');
        }
        return entityRef(tx);
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

/**
 * Was this creator invited to this project? If a brand's own cgc-ugc-approval
 * inquiry transaction already exists for this (project, creator) pair — sent
 * from ProjectInvitePage (F2.5) — checkout should continue that same
 * transaction (transition/request-payment-after-inquiry) instead of starting
 * a fresh one, so the existing message thread carries forward. See
 * BLUEPRINT.md §4. `only: 'order'` scopes this to the brand's own
 * transactions. If more than one matches (a re-invite after expiry, F2.5),
 * the most recently created one wins.
 */
export const fetchInvitationTxThunk = createAsyncThunk(
  'ProjectAcceptPage/fetchInvitationTx',
  ({ projectId, creatorListingId }, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .query({
        only: 'order',
        processNames: [CGC_UGC_PROCESS_NAME],
        'fields.transaction': ['protectedData', 'lastTransition', 'createdAt'],
        perPage: 100,
      })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        // Filter on the raw JSON:API entries: a relationship's id/type stub
        // (relationships.listing.data) is always present, unlike the fully
        // resolved related resource, which would need `include: ['listing']`.
        const matches = response.data.data.filter(tx => {
          const listingId = tx.relationships?.listing?.data?.id?.uuid;
          return (
            tx.attributes.lastTransition === ugcTransitions.INQUIRE &&
            tx.attributes.protectedData?.projectId === projectId &&
            listingId === creatorListingId
          );
        });
        const latestRaw = matches.sort(
          (a, b) => new Date(b.attributes.createdAt) - new Date(a.attributes.createdAt)
        )[0];
        if (!latestRaw) {
          return null;
        }
        const entities = denormalisedResponseEntities(response);
        const latest = entities.find(tx => tx.id.uuid === latestRaw.id.uuid);
        return entityRef(latest) || null;
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const initialState = {
  applicationFetched: false,
  applicationFetchInProgress: false,
  applicationFetchError: null,
  applicationRef: null,

  invitationTxFetched: false,
  invitationTxFetchInProgress: false,
  invitationTxRef: null,
};

const projectAcceptPageSlice = createSlice({
  name: 'ProjectAcceptPage',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchApplicationThunk.pending, state => {
        state.applicationFetchInProgress = true;
        state.applicationFetchError = null;
      })
      .addCase(fetchApplicationThunk.fulfilled, (state, action) => {
        state.applicationFetchInProgress = false;
        state.applicationFetched = true;
        state.applicationRef = action.payload;
      })
      .addCase(fetchApplicationThunk.rejected, (state, action) => {
        state.applicationFetchInProgress = false;
        state.applicationFetched = true;
        state.applicationFetchError = action.payload || storableError(action.error);
      })
      .addCase(fetchInvitationTxThunk.pending, state => {
        state.invitationTxFetchInProgress = true;
      })
      .addCase(fetchInvitationTxThunk.fulfilled, (state, action) => {
        state.invitationTxFetchInProgress = false;
        state.invitationTxFetched = true;
        state.invitationTxRef = action.payload;
      })
      .addCase(fetchInvitationTxThunk.rejected, state => {
        state.invitationTxFetchInProgress = false;
        state.invitationTxFetched = true;
      });
  },
});

export default projectAcceptPageSlice.reducer;
