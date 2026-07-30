import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { denormalisedResponseEntities } from '../util/data';
import { storableError } from '../util/errors';
import { setCurrentUser } from './user.duck';

/**
 * Brand roster ("saved creators", CGC-FRONTEND-PLAN.md §4.2).
 *
 * A brand can keep a list of creators it wants to work with again. This needs
 * no new server endpoint: a user can write their own extended data, so the
 * list of saved creator ids lives in the brand's own
 * currentUser.attributes.profile.privateData.savedCreatorIds. That array is
 * the single source of truth — this slice only tracks the in-flight/error
 * state of the toggle request; read the saved ids straight off currentUser.
 */

const initialState = {
  toggleInProgress: false,
  toggleError: null,
};

export const toggleSavedCreator = createAsyncThunk(
  'app/brandRoster/toggle',
  (creatorId, { getState, dispatch, rejectWithValue, extra: sdk }) => {
    const { currentUser } = getState().user;
    const savedCreatorIds = currentUser?.attributes?.profile?.privateData?.savedCreatorIds || [];
    const isSaved = savedCreatorIds.includes(creatorId);
    const nextSavedCreatorIds = isSaved
      ? savedCreatorIds.filter(id => id !== creatorId)
      : [...savedCreatorIds, creatorId];

    return sdk.currentUser
      .updateProfile(
        { privateData: { savedCreatorIds: nextSavedCreatorIds } },
        { expand: true }
      )
      .then(response => {
        const entities = denormalisedResponseEntities(response);
        if (entities.length !== 1) {
          throw new Error('Expected a resource in the sdk.currentUser.updateProfile response');
        }
        dispatch(setCurrentUser(entities[0]));
        return nextSavedCreatorIds;
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const brandRosterSlice = createSlice({
  name: 'brandRoster',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(toggleSavedCreator.pending, state => {
        state.toggleInProgress = true;
        state.toggleError = null;
      })
      .addCase(toggleSavedCreator.fulfilled, state => {
        state.toggleInProgress = false;
      })
      .addCase(toggleSavedCreator.rejected, (state, action) => {
        state.toggleInProgress = false;
        state.toggleError = action.payload;
      });
  },
});

export default brandRosterSlice.reducer;
