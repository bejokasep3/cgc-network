import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { CGC_UGC_PROCESS_NAME } from '../../transactions/transaction';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';

const EARNINGS_PAGE_SIZE = 100;

const entityRefs = entities => entities.map(entity => ({ id: entity.id, type: entity.type }));

// A creator's own CGC UGC sale transactions (IMPLEMENTATION-PLAN.md F8.2) —
// same `only: 'sale'` query MyCollaborationsPage.duck.js uses, minus fields
// this page doesn't need (protectedData, reviews) and plus a higher
// perPage, since summing/bucketing wants the full set, not one page of a
// paginated list.
export const fetchEarningsTransactionsThunk = createAsyncThunk(
  'EarningsPage/fetchTransactions',
  (_, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .query({
        only: 'sale',
        processNames: [CGC_UGC_PROCESS_NAME],
        include: ['listing', 'customer'],
        'fields.transaction': [
          'processName',
          'lastTransition',
          'lastTransitionedAt',
          'transitions',
          'payoutTotal',
        ],
        'fields.listing': ['title'],
        'fields.user': ['profile.displayName', 'profile.abbreviatedName'],
        perPage: EARNINGS_PAGE_SIZE,
      })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        return entityRefs(response.data.data);
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const initialState = {
  fetchInProgress: false,
  fetchError: null,
  transactionRefs: [],
};

const earningsPageSlice = createSlice({
  name: 'EarningsPage',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchEarningsTransactionsThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchEarningsTransactionsThunk.fulfilled, (state, action) => {
        state.fetchInProgress = false;
        state.transactionRefs = action.payload;
      })
      .addCase(fetchEarningsTransactionsThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.payload || storableError(action.error);
      });
  },
});

export default earningsPageSlice.reducer;
