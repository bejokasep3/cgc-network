import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';

const PROJECTS_PAGE_SIZE = 50;

const entityRefs = entities => entities.map(entity => ({ id: entity.id, type: entity.type }));

// A creator's "projects" are published project-brief listings posted by
// brands (see PostProjectPage.duck.js on the brand side) — plain Marketplace
// SDK listing search, since these are ordinary public listings rather than
// something that needs the Integration API (contrast with
// ExploreCreatorsPage.duck.js, which lists creator *accounts* directly).
export const fetchProjectsThunk = createAsyncThunk(
  'BrowseProjectsPage/fetchProjects',
  (_, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.listings
      .query({
        pub_listingType: 'project-brief',
        include: ['author', 'author.profileImage'],
        'fields.listing': ['title', 'description', 'publicData', 'createdAt'],
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

const browseProjectsPageSlice = createSlice({
  name: 'BrowseProjectsPage',
  initialState: {
    fetchInProgress: false,
    fetchError: null,
    projectRefs: [],
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
      });
  },
});

export default browseProjectsPageSlice.reducer;
