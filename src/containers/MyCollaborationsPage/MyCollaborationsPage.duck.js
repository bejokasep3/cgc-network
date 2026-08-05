import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { CGC_UGC_PROCESS_NAME, CGC_APPLICATION_PROCESS_NAME } from '../../transactions/transaction';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';

const COLLABORATIONS_PAGE_SIZE = 50;

const entityRefs = entities => entities.map(entity => ({ id: entity.id, type: entity.type }));

// A creator's "collaborations" are its own CGC UGC sale transactions — the
// `only: 'sale'` mirror of what ManageCampaignsPage.duck.js fetches for
// brands.
export const fetchCollaborationsThunk = createAsyncThunk(
  'MyCollaborationsPage/fetchCollaborations',
  (_, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .query({
        only: 'sale',
        processNames: [CGC_UGC_PROCESS_NAME],
        include: ['listing', 'customer', 'customer.profileImage', 'reviews', 'reviews.author'],
        'fields.transaction': [
          'processName',
          'lastTransition',
          'lastTransitionedAt',
          'transitions',
          'protectedData',
          'payoutTotal',
        ],
        'fields.listing': ['title', 'publicData'],
        'fields.user': ['profile.displayName', 'profile.abbreviatedName', 'banned'],
        'fields.image': ['variants.square-small', 'variants.square-small2x'],
        perPage: COLLABORATIONS_PAGE_SIZE,
      })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        return entityRefs(response.data.data);
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

// A creator's pending applications — cgc-application transactions the
// creator initiated on a brand's project listing via transition/apply (see
// ProjectDetailPage.js).
export const fetchApplicationsThunk = createAsyncThunk(
  'MyCollaborationsPage/fetchApplications',
  (_, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .query({
        only: 'order',
        processNames: [CGC_APPLICATION_PROCESS_NAME],
        include: ['listing', 'provider', 'provider.profileImage'],
        'fields.transaction': ['processName', 'lastTransition', 'lastTransitionedAt', 'createdAt'],
        'fields.listing': ['title', 'publicData'],
        'fields.user': ['profile.displayName', 'profile.abbreviatedName', 'banned'],
        'fields.image': ['variants.square-small', 'variants.square-small2x'],
        perPage: COLLABORATIONS_PAGE_SIZE,
      })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        return entityRefs(response.data.data);
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const myCollaborationsPageSlice = createSlice({
  name: 'MyCollaborationsPage',
  initialState: {
    fetchInProgress: false,
    fetchError: null,
    collaborationRefs: [],
    applicationsInProgress: false,
    applicationsError: null,
    applicationRefs: [],
  },
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchCollaborationsThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchCollaborationsThunk.fulfilled, (state, action) => {
        state.fetchInProgress = false;
        state.collaborationRefs = action.payload;
      })
      .addCase(fetchCollaborationsThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.payload || storableError(action.error);
      })
      .addCase(fetchApplicationsThunk.pending, state => {
        state.applicationsInProgress = true;
        state.applicationsError = null;
      })
      .addCase(fetchApplicationsThunk.fulfilled, (state, action) => {
        state.applicationsInProgress = false;
        state.applicationRefs = action.payload;
      })
      .addCase(fetchApplicationsThunk.rejected, (state, action) => {
        state.applicationsInProgress = false;
        state.applicationsError = action.payload || storableError(action.error);
      });
  },
});

export default myCollaborationsPageSlice.reducer;
