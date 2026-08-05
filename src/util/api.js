// These helpers are calling this template's own server-side routes
// so, they are not directly calling Marketplace API or Integration API.
// You can find these api endpoints from 'server/api/...' directory

import appSettings from '../config/settings';
import { types as sdkTypes, transit } from './sdkLoader';
import Decimal from 'decimal.js';

export const apiBaseUrl = marketplaceRootURL => {
  const port = process.env.REACT_APP_DEV_API_SERVER_PORT;
  const useDevApiServer = process.env.NODE_ENV === 'development' && !!port;

  // In development, the dev API server is running in a different port
  if (useDevApiServer) {
    return `http://localhost:${port}`;
  }

  // Otherwise, use the given marketplaceRootURL parameter or the same domain and port as the frontend
  return marketplaceRootURL ? marketplaceRootURL.replace(/\/$/, '') : `${window.location.origin}`;
};

// Application type handlers for JS SDK.
//
// NOTE: keep in sync with `typeHandlers` in `server/api-util/sdk.js`
export const typeHandlers = [
  // Use Decimal type instead of SDK's BigDecimal.
  {
    type: sdkTypes.BigDecimal,
    customType: Decimal,
    writer: v => new sdkTypes.BigDecimal(v.toString()),
    reader: v => new Decimal(v.value),
  },
];

const serialize = data => {
  return transit.write(data, { typeHandlers, verbose: appSettings.sdk.transitVerbose });
};

const deserialize = str => {
  return transit.read(str, { typeHandlers });
};

const methods = {
  POST: 'POST',
  GET: 'GET',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
};

// If server/api returns data from SDK, you should set Content-Type to 'application/transit+json'
const request = (path, options = {}) => {
  const url = `${apiBaseUrl()}${path}`;
  const { credentials, headers, body, ...rest } = options;

  // If headers are not set, we assume that the body should be serialized as transit format.
  const shouldSerializeBody =
    (!headers || headers['Content-Type'] === 'application/transit+json') && body;
  const bodyMaybe = shouldSerializeBody ? { body: serialize(body) } : {};

  const fetchOptions = {
    credentials: credentials || 'include',
    // Since server/api mostly talks to Marketplace API using SDK,
    // we default to 'application/transit+json' as content type (as SDK uses transit).
    headers: headers || { 'Content-Type': 'application/transit+json' },
    ...bodyMaybe,
    ...rest,
  };

  return window.fetch(url, fetchOptions).then(res => {
    const contentTypeHeader = res.headers.get('Content-Type');
    const contentType = contentTypeHeader ? contentTypeHeader.split(';')[0] : null;

    if (res.status >= 400) {
      return res.json().then(data => {
        let e = new Error();
        e = Object.assign(e, data);

        throw e;
      });
    }
    if (contentType === 'application/transit+json') {
      return res.text().then(deserialize);
    } else if (contentType === 'application/json') {
      return res.json();
    }
    return res.text();
  });
};

// Keep the previous parameter order for the post method.
// For now, only POST has own specific function, but you can create more or use request directly.
const post = (path, body, options = {}) => {
  const requestOptions = {
    ...options,
    method: methods.POST,
    body,
  };

  return request(path, requestOptions);
};

// Fetch transaction line items from the local API endpoint.
//
// See `server/api/transaction-line-items.js` to see what data should
// be sent in the body.
export const transactionLineItems = body => {
  return post('/api/transaction-line-items', body);
};

// Initiate a privileged transaction.
//
// With privileged transitions, the transactions need to be created
// from the backend. This endpoint enables sending the order data to
// the local backend, and passing that to the Marketplace API.
//
// See `server/api/initiate-privileged.js` to see what data should be
// sent in the body.
export const initiatePrivileged = body => {
  return post('/api/initiate-privileged', body);
};

// Transition a transaction with a privileged transition.
//
// This is similar to the `initiatePrivileged` above. It will use the
// backend for the transition. The backend endpoint will add the
// payment line items to the transition params.
//
// See `server/api/transition-privileged.js` to see what data should
// be sent in the body.
export const transitionPrivileged = body => {
  return post('/api/transition-privileged', body);
};

// Create user with identity provider (e.g. Facebook or Google)
//
// If loginWithIdp api call fails and user can't authenticate to Marketplace API with idp
// we will show option to create a new user with idp.
// For that user needs to confirm data fetched from the idp.
// After the confirmation, this endpoint is called to create a new user with confirmed data.
//
// See `server/api/auth/createUserWithIdp.js` to see what data should
// be sent in the body.
export const createUserWithIdp = body => {
  return post('/api/auth/create-user-with-idp', body);
};

// Check if user can be deleted and then delete the user. Endpoint logic
// must be modified to accommodate the transaction processes used in
// the marketplace.
export const deleteUserAccount = body => {
  return post('/api/delete-account', body);
};

// Lists creator (provider) user accounts directly via the Integration API
// (server/api/list-creators.js) — the regular Marketplace SDK can't query
// users, only listings, so this is a local API endpoint instead of an SDK call.
export const listCreators = () => {
  return request('/api/list-creators', { method: methods.GET });
};

// Submits a creator application or brand access request. `body.type` is
// `'creator'` or `'brand'` — see ApplyPage.js / RequestAccessPage.js for the
// rest of the shape, and server/api/applications.js for validation.
export const submitApplication = body => {
  return post('/api/applications', body);
};

// Brand subscriptions. Stripe stays the source of truth for whether a brand's
// subscription is active, so this is read live rather than cached in the store.
//
// See `server/api/subscription.js`.
export const fetchSubscriptionStatus = () => {
  return request('/api/subscription/status');
};

// { unitAmount, currency, interval, intervalCount } read live from Stripe —
// see server/api/subscription.js's subscriptionPrice (IMPLEMENTATION-PLAN.md
// F9.2: SubscriptionPage must not hardcode the price).
export const fetchSubscriptionPrice = () => {
  return request('/api/subscription/price');
};

// Returns a Stripe-hosted Checkout URL. Card details are entered on Stripe's
// domain, never in this app.
export const createSubscriptionCheckoutSession = () => {
  return post('/api/subscription/create-checkout-session', {});
};

// Returns a Stripe billing portal URL where the brand can update their card or
// cancel the subscription.
export const createBillingPortalSession = () => {
  return post('/api/subscription/billing-portal', {});
};

// Asks the server whether the current user is a verified operator (userType
// 'operator' AND their id is in CGC_OPERATOR_USER_IDS). Called before any
// /admin/* page renders — see server/api/admin/index.js and
// src/util/operator.js.
export const fetchAdminStatus = () => {
  return request('/api/admin/status', { method: methods.GET });
};

// Application queue (F5.2). See server/api/admin/applications.js — approve
// calls Sharetribe's real users/approve endpoint; decide (reject / request
// more info) records a decision on the applicant's own privateData instead,
// since there's no reject/ban endpoint (see that file's module doc).
export const fetchAdminApplicants = () => {
  return request('/api/admin/applications', { method: methods.GET });
};

export const approveApplicant = userId => {
  return post('/api/admin/applications/approve', { userId });
};

export const decideApplicant = (userId, status, note) => {
  return post('/api/admin/applications/decide', { userId, status, note });
};

// Invite codes (F5.3). See server/api/admin/invites.js.
export const fetchInviteCodes = () => {
  return request('/api/admin/invites', { method: methods.GET });
};

export const createInviteCode = ({ note, maxUses, expiresAt }) => {
  return post('/api/admin/invites', { note, maxUses, expiresAt });
};

export const revokeInviteCode = listingId => {
  return post('/api/admin/invites/revoke', { listingId });
};

// Dispute mediation (F5.3). See server/api/admin/disputes.js.
export const fetchDisputes = () => {
  return request('/api/admin/disputes', { method: methods.GET });
};

export const resolveDispute = (transactionId, resolution) => {
  return post('/api/admin/disputes/resolve', { transactionId, resolution });
};

// Network health dashboard (F5.3). See server/api/admin/health.js.
export const fetchAdminHealth = () => {
  return request('/api/admin/health', { method: methods.GET });
};
