import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { denormalisedResponseEntities } from '../../util/data';
import { storableError } from '../../util/errors';
import { setCurrentUser } from '../../ducks/user.duck';

/**
 * A creator's own default shipping address (IMPLEMENTATION-PLAN.md F4.2,
 * BLUEPRINT §7 C2) — collected once during onboarding so a brand can ship a
 * product the same day a collaboration is agreed, instead of waiting on the
 * creator to type it out mid-transaction. Not vetting material, so — unlike
 * F4.1's application/accessRequest — this can be written directly through
 * the trusted per-session SDK, same as brandRoster.duck.js's savedCreatorIds.
 */
export const saveShippingAddressThunk = createAsyncThunk(
  'ShippingAddressPage/saveShippingAddress',
  (shippingAddress, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.currentUser
      .updateProfile({ privateData: { shippingAddress } }, { expand: true })
      .then(response => {
        const entities = denormalisedResponseEntities(response);
        if (entities.length !== 1) {
          throw new Error('Expected a resource in the sdk.currentUser.updateProfile response');
        }
        dispatch(setCurrentUser(entities[0]));
        return entities[0];
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const initialState = {
  saveInProgress: false,
  saveError: null,
};

const shippingAddressPageSlice = createSlice({
  name: 'ShippingAddressPage',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(saveShippingAddressThunk.pending, state => {
        state.saveInProgress = true;
        state.saveError = null;
      })
      .addCase(saveShippingAddressThunk.fulfilled, state => {
        state.saveInProgress = false;
      })
      .addCase(saveShippingAddressThunk.rejected, (state, action) => {
        state.saveInProgress = false;
        state.saveError = action.payload || storableError(action.error);
      });
  },
});

export default shippingAddressPageSlice.reducer;
