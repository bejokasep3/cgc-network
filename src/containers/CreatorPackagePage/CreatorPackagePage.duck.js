import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { denormalisedResponseEntities } from '../../util/data';
import { storableError } from '../../util/errors';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';

const CREATOR_PROFILE_LISTING_TYPE = 'creator-profile';

// Finds the creator's own creator-profile listing regardless of state (draft
// or published), so this page can resume editing an in-progress draft
// instead of creating a duplicate one. ducks/creatorProfile.duck.js
// intentionally only returns the *published* listing (it's used elsewhere as
// a "setup complete" signal) — this page needs the draft too.
export const fetchOwnListingThunk = createAsyncThunk(
  'CreatorPackagePage/fetchOwnListing',
  (_, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.ownListings
      .query({ pub_listingType: CREATOR_PROFILE_LISTING_TYPE })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        const listings = denormalisedResponseEntities(response);
        return listings[0]?.id || null;
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const initialState = {
  fetchInProgress: false,
  fetchError: null,
  listingId: null,
};

const creatorPackagePageSlice = createSlice({
  name: 'CreatorPackagePage',
  initialState,
  reducers: {
    setListingId(state, action) {
      state.listingId = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchOwnListingThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchOwnListingThunk.fulfilled, (state, action) => {
        state.fetchInProgress = false;
        state.listingId = action.payload;
      })
      .addCase(fetchOwnListingThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.payload || storableError(action.error);
      });
  },
});

export const { setListingId } = creatorPackagePageSlice.actions;

export default creatorPackagePageSlice.reducer;
