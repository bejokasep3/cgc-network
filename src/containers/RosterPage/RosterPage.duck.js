import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { CGC_UGC_PROCESS_NAME } from '../../transactions/transaction';

const ROSTER_HISTORY_PAGE_SIZE = 100;

// The roster (CGC-FRONTEND-PLAN.md §4.2) only stores creator user ids on the
// brand's own profile (see ducks/brandRoster.duck.js); there's no listing
// query that accepts a set of author ids, so resolving those ids to their
// current creator-profile listing is one query per saved creator. Roster
// sizes are expected to be small (a brand's own shortlist), so N parallel
// requests is the simplest correct approach rather than a new server endpoint.
export const fetchRosterThunk = createAsyncThunk(
  'RosterPage/fetchRoster',
  (_, { getState, dispatch, extra: sdk }) => {
    const { currentUser } = getState().user;
    const savedCreatorIds = currentUser?.attributes?.profile?.privateData?.savedCreatorIds || [];

    if (savedCreatorIds.length === 0) {
      return Promise.resolve([]);
    }

    const queryParams = {
      pub_listingType: 'creator-profile',
      perPage: 1,
      include: ['author', 'author.profileImage', 'images'],
      'fields.image': ['variants.listing-card', 'variants.listing-card-2x'],
    };

    return Promise.all(
      savedCreatorIds.map(authorId =>
        sdk.listings
          .query({ authorId, ...queryParams })
          .then(response => {
            dispatch(addMarketplaceEntities(response));
            const listing = response.data.data[0];
            // A saved creator may since have unpublished their listing; drop
            // it from the roster view rather than showing a broken card.
            return listing ? { id: listing.id, type: listing.type } : null;
          })
          .catch(() => null)
      )
    ).then(refs => refs.filter(Boolean));
  }
);

// Per-creator collaboration history (F8.1): how many times this brand has
// worked with each roster creator, and which project to prefill "Collab
// again" from. The Marketplace API has no counterparty filter (same
// constraint ProfilePage.duck.js's queryCollaborationHistoryThunk documents,
// scoped to one creator there) — here the roster can hold many creators, so
// this fetches the brand's own order transactions ONCE and groups
// client-side by provider id, rather than running one query per creator.
export const fetchRosterCollaborationHistoryThunk = createAsyncThunk(
  'RosterPage/fetchCollaborationHistory',
  (_, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .query({
        only: 'order',
        processNames: [CGC_UGC_PROCESS_NAME],
        include: ['provider'],
        'fields.transaction': ['protectedData', 'lastTransitionedAt'],
        perPage: ROSTER_HISTORY_PAGE_SIZE,
      })
      .then(response => {
        // Newest-first, so the first transaction seen per creator below is
        // their most recent — the one "Collab again" prefills from.
        const transactions = response.data.data
          .filter(tx => !!tx.relationships?.provider?.data?.id)
          .sort(
            (a, b) =>
              new Date(b.attributes.lastTransitionedAt) - new Date(a.attributes.lastTransitionedAt)
          );

        // A transaction's own `listing` relationship is the CREATOR-PROFILE
        // listing, not the project (same distinction LibraryPage.duck.js
        // documents) — the project is `protectedData.projectId`, batch-fetched
        // separately so RosterPage can read its publicData for the prefill.
        const projectIds = [
          ...new Set(
            transactions.map(tx => tx.attributes.protectedData?.projectId).filter(Boolean)
          ),
        ];
        const fetchProjectListings = projectIds.length
          ? sdk.listings
              .query({ ids: projectIds, 'fields.listing': ['title', 'description', 'publicData', 'price'] })
              .then(listingsResponse => dispatch(addMarketplaceEntities(listingsResponse)))
          : Promise.resolve();

        return fetchProjectListings.then(() =>
          transactions.reduce((acc, tx) => {
            const creatorId = tx.relationships.provider.data.id.uuid;
            if (!acc[creatorId]) {
              acc[creatorId] = {
                count: 0,
                mostRecentProjectId: tx.attributes.protectedData?.projectId || null,
              };
            }
            acc[creatorId].count += 1;
            return acc;
          }, {})
        );
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const rosterPageSlice = createSlice({
  name: 'RosterPage',
  initialState: {
    fetchInProgress: false,
    fetchError: null,
    rosterListingRefs: [],

    historyFetchInProgress: false,
    historyFetchError: null,
    // { [creatorUserId]: { count, mostRecentProjectId } }
    historyByCreatorId: {},
  },
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchRosterThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchRosterThunk.fulfilled, (state, action) => {
        state.fetchInProgress = false;
        state.rosterListingRefs = action.payload;
      })
      .addCase(fetchRosterThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.payload || storableError(action.error);
      })
      .addCase(fetchRosterCollaborationHistoryThunk.pending, state => {
        state.historyFetchInProgress = true;
        state.historyFetchError = null;
      })
      .addCase(fetchRosterCollaborationHistoryThunk.fulfilled, (state, action) => {
        state.historyFetchInProgress = false;
        state.historyByCreatorId = action.payload;
      })
      .addCase(fetchRosterCollaborationHistoryThunk.rejected, (state, action) => {
        state.historyFetchInProgress = false;
        state.historyFetchError = action.payload || storableError(action.error);
      });
  },
});

export default rosterPageSlice.reducer;
