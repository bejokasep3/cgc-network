import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { getSupportedProcessesInfo } from '../../transactions/transaction';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';

const CAMPAIGNS_PAGE_SIZE = 50;
const PROJECTS_PAGE_SIZE = 50;
const APPLICATIONS_PAGE_SIZE = 100;

const entityRefs = entities => entities.map(entity => ({ id: entity.id, type: entity.type }));

// The brand's own project listings — what "Projects" shows before any of
// them have turned into a collaboration. Separate from fetchCampaignsThunk,
// which only sees transactions and is therefore blind to a freshly posted
// project until a creator applies to it.
export const fetchOwnProjectsThunk = createAsyncThunk(
  'ManageCampaignsPage/fetchOwnProjects',
  (_, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.ownListings
      .query({
        pub_listingType: 'project',
        'fields.listing': ['title', 'publicData', 'state', 'createdAt'],
        perPage: PROJECTS_PAGE_SIZE,
      })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        return entityRefs(response.data.data);
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

// Applications (cgc-application transactions) received on the brand's own
// projects, so "Projects" can show a per-listing applicant count — the brand is
// the provider on these, since the creator (customer) is the one applying
// (BLUEPRINT D1/D2: roles are inverted relative to cgc-ugc-approval).
export const fetchProjectApplicationsThunk = createAsyncThunk(
  'ManageCampaignsPage/fetchProjectApplications',
  (_, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .query({
        only: 'sale',
        processNames: ['cgc-application'],
        include: ['listing', 'customer', 'customer.profileImage'],
        'fields.transaction': ['processName', 'lastTransition', 'lastTransitionedAt'],
        'fields.listing': ['title'],
        'fields.user': ['profile.displayName', 'profile.abbreviatedName'],
        'fields.image': ['variants.square-small', 'variants.square-small2x'],
        perPage: APPLICATIONS_PAGE_SIZE,
      })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        return entityRefs(response.data.data);
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

// Flips a posted project between published (visible to creators in Browse
// projects) and closed, from the visibility toggle in the "Listed" table.
// Same close/open SDK calls ManageListingsPage uses, just dispatching
// addMarketplaceEntities here too so this page's own projects list (read via
// getMarketplaceEntities) picks up the new state without a refetch.
export const setProjectVisibilityThunk = createAsyncThunk(
  'ManageCampaignsPage/setProjectVisibility',
  ({ listingId, isPublished }, { dispatch, rejectWithValue, extra: sdk }) => {
    const apiCall = isPublished ? sdk.ownListings.open : sdk.ownListings.close;
    return apiCall({ id: listingId }, { expand: true })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        return response;
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

// A brand's "campaigns" are simply its own transactions (the `only: 'order'`
// side, same query InboxPage uses for the "orders" tab) — there's no
// separate project/campaign entity in this app's data model yet, so grouping
// these by process state (see statesNeedingCustomerAttention /
// statesNeedingProviderAttention in transactions/transaction.js) is the
// closest real equivalent to Billo's campaign list.
export const fetchCampaignsThunk = createAsyncThunk(
  'ManageCampaignsPage/fetchCampaigns',
  (_, { dispatch, rejectWithValue, extra: sdk }) => {
    const processNames = getSupportedProcessesInfo().map(p => p.name);

    return sdk.transactions
      .query({
        only: 'order',
        processNames,
        include: ['listing', 'provider', 'provider.profileImage', 'reviews', 'reviews.author'],
        'fields.transaction': [
          'processName',
          'lastTransition',
          'lastTransitionedAt',
          'transitions',
          'protectedData',
        ],
        'fields.listing': ['title', 'publicData'],
        'fields.user': ['profile.displayName', 'profile.abbreviatedName', 'banned'],
        'fields.image': ['variants.square-small', 'variants.square-small2x'],
        perPage: CAMPAIGNS_PAGE_SIZE,
      })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        return entityRefs(response.data.data);
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const manageCampaignsPageSlice = createSlice({
  name: 'ManageCampaignsPage',
  initialState: {
    fetchInProgress: false,
    fetchError: null,
    campaignRefs: [],
    fetchProjectsInProgress: false,
    fetchProjectsError: null,
    projectRefs: [],
    fetchApplicationsInProgress: false,
    fetchApplicationsError: null,
    applicationRefs: [],
    togglingListingId: null,
    toggleVisibilityError: null,
  },
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchCampaignsThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchCampaignsThunk.fulfilled, (state, action) => {
        state.fetchInProgress = false;
        state.campaignRefs = action.payload;
      })
      .addCase(fetchCampaignsThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.payload || storableError(action.error);
      })
      .addCase(fetchOwnProjectsThunk.pending, state => {
        state.fetchProjectsInProgress = true;
        state.fetchProjectsError = null;
      })
      .addCase(fetchOwnProjectsThunk.fulfilled, (state, action) => {
        state.fetchProjectsInProgress = false;
        state.projectRefs = action.payload;
      })
      .addCase(fetchOwnProjectsThunk.rejected, (state, action) => {
        state.fetchProjectsInProgress = false;
        state.fetchProjectsError = action.payload || storableError(action.error);
      })
      .addCase(fetchProjectApplicationsThunk.pending, state => {
        state.fetchApplicationsInProgress = true;
        state.fetchApplicationsError = null;
      })
      .addCase(fetchProjectApplicationsThunk.fulfilled, (state, action) => {
        state.fetchApplicationsInProgress = false;
        state.applicationRefs = action.payload;
      })
      .addCase(fetchProjectApplicationsThunk.rejected, (state, action) => {
        state.fetchApplicationsInProgress = false;
        state.fetchApplicationsError = action.payload || storableError(action.error);
      })
      .addCase(setProjectVisibilityThunk.pending, (state, action) => {
        state.togglingListingId = action.meta.arg.listingId.uuid;
        state.toggleVisibilityError = null;
      })
      .addCase(setProjectVisibilityThunk.fulfilled, state => {
        state.togglingListingId = null;
      })
      .addCase(setProjectVisibilityThunk.rejected, (state, action) => {
        state.togglingListingId = null;
        state.toggleVisibilityError = action.payload || storableError(action.error);
      });
  },
});

export default manageCampaignsPageSlice.reducer;
