/**
 * Brand subscription gating.
 *
 * The CGC Network is two-sided in an asymmetric way: creators are vetted and
 * invited (handled by Sharetribe's own user-approval state, see
 * isUserAuthorized in util/userHelpers.js), while brands pay a recurring
 * subscription for access. This module holds the rules for the latter so that
 * every gated surface asks the same question.
 *
 * Stripe is the source of truth for subscription state; see
 * ducks/brandSubscription.duck.js and server/api/subscription.js.
 */

// Actions that require an active brand subscription.
export const BRAND_GATED_ACTIONS = {
  POST_BRIEF: 'postBrief',
  CONTACT_CREATOR: 'contactCreator',
  BOOK_CREATOR: 'bookCreator',
};

/**
 * Whether the subscription payload from the API grants access.
 *
 * @param {Object|null} status - Payload from /api/subscription/status
 * @returns {boolean}
 */
export const hasActiveBrandSubscription = status => !!status?.isActive;

/**
 * Whether we know enough to make a gating decision yet. Before the status has
 * been fetched, callers should show a loading state rather than a paywall —
 * flashing "subscribe" at a paying customer is worse than a brief spinner.
 *
 * @param {Object} state - The brandSubscription slice
 * @returns {boolean}
 */
export const isSubscriptionStatusResolved = state =>
  state?.status !== null && !state?.fetchInProgress;

/**
 * Gate a brand action.
 *
 * Creators are never subscription-gated — only brands are. The caller passes the
 * user's role so a creator is never shown a paywall for their own side of the
 * marketplace.
 *
 * @param {Object} params
 * @param {Object|null} params.status - Payload from /api/subscription/status
 * @param {boolean} params.isBrand - Whether the current user acts as a brand here
 * @returns {{allowed: boolean, reason: string|null}}
 */
export const checkBrandAccess = ({ status, isBrand }) => {
  if (!isBrand) {
    return { allowed: true, reason: null };
  }
  if (hasActiveBrandSubscription(status)) {
    return { allowed: true, reason: null };
  }
  // 'past_due' and 'unpaid' are distinguished from never having subscribed so
  // the UI can prompt for a card update instead of a fresh signup.
  const reason = ['past_due', 'unpaid'].includes(status?.status)
    ? 'paymentFailed'
    : 'noSubscription';
  return { allowed: false, reason };
};
