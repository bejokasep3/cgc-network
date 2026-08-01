import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { listCreators } from '../../util/api';

// Only name + profile photo are wired up to real data for now. Rating, video
// count, and response rate stay as placeholder text in the component until
// those fields exist on the creator's account.
//
// This calls a local API endpoint (server/api/list-creators.js) instead of
// the Marketplace SDK: browsing creator accounts directly (rather than via a
// published listing) requires the Integration API, which only runs
// server-side with separate Integration application credentials.
export const fetchCreatorsThunk = createAsyncThunk(
  'ExploreCreatorsPage/fetchCreators',
  (_, { rejectWithValue }) => {
    return listCreators()
      .then(({ creators }) => creators)
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const exploreCreatorsPageSlice = createSlice({
  name: 'ExploreCreatorsPage',
  initialState: {
    fetchInProgress: false,
    fetchError: null,
    creators: [],
  },
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchCreatorsThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchCreatorsThunk.fulfilled, (state, action) => {
        state.fetchInProgress = false;
        state.creators = action.payload;
      })
      .addCase(fetchCreatorsThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.payload || storableError(action.error);
      });
  },
});

export default exploreCreatorsPageSlice.reducer;
