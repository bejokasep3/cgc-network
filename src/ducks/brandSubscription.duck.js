import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import {
  fetchSubscriptionStatus,
  fetchSubscriptionPrice,
  createSubscriptionCheckoutSession,
  createBillingPortalSession,
} from '../util/api';
import { storableError } from '../util/errors';

/**
 * Brand subscription state.
 *
 * Stripe is authoritative about whether a subscription is active, so this slice
 * caches the answer for the current page load only. Anything that gates access
 * should read it through hasActiveBrandSubscription in util/subscription.js
 * rather than poking at the raw fields.
 */

const initialState = {
  fetchInProgress: false,
  fetchError: null,
  // null means "not fetched yet", which is different from "not subscribed".
  status: null,
  // { unitAmount, currency, interval, intervalCount } | null — see
  // fetchBrandSubscriptionPrice below (IMPLEMENTATION-PLAN.md F9.2).
  price: null,
  priceFetchInProgress: false,
  priceFetchError: null,
  checkoutInProgress: false,
  checkoutError: null,
  billingPortalInProgress: false,
  billingPortalError: null,
};

export const fetchBrandSubscription = createAsyncThunk(
  'app/brandSubscription/fetch',
  (_, { rejectWithValue }) =>
    fetchSubscriptionStatus().catch(e => rejectWithValue(storableError(e)))
);

// The live Stripe price for the brand plan (IMPLEMENTATION-PLAN.md F9.2) —
// SubscriptionPage must not hardcode this, so it's read from Stripe on
// every visit rather than baked into a translation string.
export const fetchBrandSubscriptionPrice = createAsyncThunk(
  'app/brandSubscription/fetchPrice',
  (_, { rejectWithValue }) =>
    fetchSubscriptionPrice().catch(e => rejectWithValue(storableError(e)))
);

// Redirects the browser to Stripe-hosted Checkout. The user enters their card
// details on Stripe's domain; this app never sees them.
export const startBrandSubscriptionCheckout = createAsyncThunk(
  'app/brandSubscription/checkout',
  (_, { rejectWithValue }) =>
    createSubscriptionCheckoutSession()
      .then(({ url }) => {
        if (!url) {
          throw new Error('Stripe did not return a checkout URL');
        }
        window.location.assign(url);
        return url;
      })
      .catch(e => rejectWithValue(storableError(e)))
);

// Redirects to Stripe's billing portal, where the brand can change its card or
// cancel. Keeps card handling and cancellation entirely on Stripe's side.
export const openBillingPortal = createAsyncThunk(
  'app/brandSubscription/billingPortal',
  (_, { rejectWithValue }) =>
    createBillingPortalSession()
      .then(({ url }) => {
        if (!url) {
          throw new Error('Stripe did not return a billing portal URL');
        }
        window.location.assign(url);
        return url;
      })
      .catch(e => rejectWithValue(storableError(e)))
);

const brandSubscriptionSlice = createSlice({
  name: 'brandSubscription',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchBrandSubscription.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(fetchBrandSubscription.fulfilled, (state, action) => {
        state.fetchInProgress = false;
        state.status = action.payload;
      })
      .addCase(fetchBrandSubscription.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.payload;
      })
      .addCase(fetchBrandSubscriptionPrice.pending, state => {
        state.priceFetchInProgress = true;
        state.priceFetchError = null;
      })
      .addCase(fetchBrandSubscriptionPrice.fulfilled, (state, action) => {
        state.priceFetchInProgress = false;
        state.price = action.payload;
      })
      .addCase(fetchBrandSubscriptionPrice.rejected, (state, action) => {
        state.priceFetchInProgress = false;
        state.priceFetchError = action.payload;
      })
      .addCase(startBrandSubscriptionCheckout.pending, state => {
        state.checkoutInProgress = true;
        state.checkoutError = null;
      })
      .addCase(startBrandSubscriptionCheckout.fulfilled, state => {
        // The browser is navigating away; leave the flag set so the button stays
        // in its in-progress state until it does.
        state.checkoutError = null;
      })
      .addCase(startBrandSubscriptionCheckout.rejected, (state, action) => {
        state.checkoutInProgress = false;
        state.checkoutError = action.payload;
      })
      .addCase(openBillingPortal.pending, state => {
        state.billingPortalInProgress = true;
        state.billingPortalError = null;
      })
      .addCase(openBillingPortal.fulfilled, state => {
        state.billingPortalError = null;
      })
      .addCase(openBillingPortal.rejected, (state, action) => {
        state.billingPortalInProgress = false;
        state.billingPortalError = action.payload;
      });
  },
});

export default brandSubscriptionSlice.reducer;
