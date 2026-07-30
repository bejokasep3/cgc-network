import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';

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

const rosterPageSlice = createSlice({
  name: 'RosterPage',
  initialState: {
    fetchInProgress: false,
    fetchError: null,
    rosterListingRefs: [],
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
      });
  },
});

export default rosterPageSlice.reducer;
