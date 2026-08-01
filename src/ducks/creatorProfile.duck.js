import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { denormalisedResponseEntities } from '../util/data';
import { storableError } from '../util/errors';

/**
 * The current creator's own published creator-profile listing, if any.
 *
 * Shared across the creator dashboard pages (BrowseProjectsPage,
 * MyCollaborationsPage, CreatorOnboardingPage) since all three need to know
 * whether a creator has finished setting up their package (BrowseProjectsPage
 * for niche/platform filtering, CreatorOnboardingPage and
 * CreatorSetupBanner for the setup checklist) — kept as a global duck rather
 * than owned by one page.
 */

const initialState = {
  ownProfileListing: null,
  fetchInProgress: false,
  fetchError: null,
  fetched: false,
};

export const fetchOwnCreatorProfileThunk = createAsyncThunk(
  'app/creatorProfile/fetchOwn',
  (_, { rejectWithValue, extra: sdk }) => {
    return sdk.ownListings
      .query({ pub_listingType: 'creator-profile' })
      .then(response => {
        const listings = denormalisedResponseEntities(response);
        return listings.find(l => l.attributes.state === 'published') || null;
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const creatorProfileSlice = createSlice({
  name: 'creatorProfile',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchOwnCreatorProfileThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchOwnCreatorProfileThunk.fulfilled, (state, action) => {
        state.fetchInProgress = false;
        state.fetched = true;
        state.ownProfileListing = action.payload;
      })
      .addCase(fetchOwnCreatorProfileThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetched = true;
        state.fetchError = action.payload || storableError(action.error);
      });
  },
});

export default creatorProfileSlice.reducer;
