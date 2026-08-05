import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { denormalisedResponseEntities } from '../../util/data';
import { storableError } from '../../util/errors';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';

/**
 * The license record (IMPLEMENTATION-PLAN.md F6.1) needs nothing beyond the
 * collaboration transaction itself (customer/provider denormalized) — the
 * related project listing (for usageRights/contentDueDate) is fetched
 * separately by the component via ListingPage.duck.js's showListing, once
 * protectedData.projectId is known, mirroring TransactionPage.js's own
 * pattern for the same lookup.
 */
export const fetchLicenseTransactionThunk = createAsyncThunk(
  'LicensePage/fetchTransaction',
  ({ id }, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .show({ id, include: ['customer', 'provider', 'listing'] }, { expand: true })
      .then(response => {
        const entities = denormalisedResponseEntities(response);
        if (entities.length !== 1) {
          throw new Error('Expected a resource in the sdk.transactions.show response');
        }
        dispatch(addMarketplaceEntities(response));
        return entities[0].id.uuid;
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const initialState = {
  transactionId: null,
  fetchInProgress: false,
  fetchError: null,
};

const licensePageSlice = createSlice({
  name: 'LicensePage',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchLicenseTransactionThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchLicenseTransactionThunk.fulfilled, (state, action) => {
        state.fetchInProgress = false;
        state.transactionId = action.payload;
      })
      .addCase(fetchLicenseTransactionThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.payload || storableError(action.error);
      });
  },
});

export default licensePageSlice.reducer;
