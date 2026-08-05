import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { CGC_UGC_PROCESS_NAME } from '../../transactions/transaction';
import { transitions as cgcUgcTransitions } from '../../transactions/transactionProcessCGCUGC';
import { isInvitationActive } from '../../util/invitation';

const PROJECTS_PAGE_SIZE = 50;
const INVITATIONS_PAGE_SIZE = 100;

const entityRefs = entities => entities.map(entity => ({ id: entity.id, type: entity.type }));

// A creator's "projects" are published project listings posted by
// brands (see PostProjectPage.duck.js on the brand side) — plain Marketplace
// SDK listing search, since these are ordinary public listings rather than
// something that needs the Integration API (contrast with
// ExploreCreatorsPage.duck.js, which lists creator *accounts* directly).
export const fetchProjectsThunk = createAsyncThunk(
  'BrowseProjectsPage/fetchProjects',
  (_, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.listings
      .query({
        pub_listingType: 'project',
        include: ['author', 'author.profileImage'],
        'fields.listing': ['title', 'description', 'price', 'publicData', 'createdAt'],
        'fields.user': ['profile.displayName', 'profile.abbreviatedName', 'banned'],
        'fields.image': ['variants.square-small', 'variants.square-small2x'],
        perPage: PROJECTS_PAGE_SIZE,
      })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        return entityRefs(response.data.data);
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

// Which open projects this creator has been directly invited to (F2.5: a
// brand invites via `transition/inquire` on the creator's own
// creator-profile listing, so the creator is `provider` on these sales).
// Only the project ids are kept in state — the "You're invited" badge just
// needs a membership check, not the full transaction.
export const fetchInvitationsThunk = createAsyncThunk(
  'BrowseProjectsPage/fetchInvitations',
  (_, { rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .query({
        only: 'sale',
        processNames: [CGC_UGC_PROCESS_NAME],
        lastTransitions: [cgcUgcTransitions.INQUIRE],
        'fields.transaction': ['protectedData', 'createdAt'],
        perPage: INVITATIONS_PAGE_SIZE,
      })
      .then(response =>
        response.data.data
          .filter(isInvitationActive)
          .map(tx => tx.attributes.protectedData?.projectId)
          .filter(Boolean)
      )
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const browseProjectsPageSlice = createSlice({
  name: 'BrowseProjectsPage',
  initialState: {
    fetchInProgress: false,
    fetchError: null,
    projectRefs: [],
    invitedProjectIds: [],
  },
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchProjectsThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchProjectsThunk.fulfilled, (state, action) => {
        state.fetchInProgress = false;
        state.projectRefs = action.payload;
      })
      .addCase(fetchProjectsThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.payload || storableError(action.error);
      })
      // Invitations are a supplementary badge, not the page's primary data —
      // a failure here shouldn't block the project board from rendering, so
      // it's not surfaced as a page-level fetchError.
      .addCase(fetchInvitationsThunk.fulfilled, (state, action) => {
        state.invitedProjectIds = action.payload;
      })
      .addCase(fetchInvitationsThunk.rejected, state => {
        state.invitedProjectIds = [];
      });
  },
});

export default browseProjectsPageSlice.reducer;
