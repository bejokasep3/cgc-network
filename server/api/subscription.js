/**
 * Brand subscriptions.
 *
 * The CGC Network is invite-only for creators and subscription-gated for brands.
 * Sharetribe has no notion of a platform subscription, so this is a thin layer
 * on top of Stripe Billing, kept deliberately small:
 *
 *  - Stripe Checkout collects the card. We never see or handle card details.
 *  - Stripe is the source of truth for whether a subscription is active. We only
 *    cache the customer id on the user's profile so we know who to ask about.
 *    That avoids needing webhooks plus the Integration API to keep a mirrored
 *    "isSubscribed" flag honest, which is the usual way this goes wrong.
 *  - Cancellation and card changes happen in Stripe's own billing portal.
 *
 * Requires these env vars:
 *   STRIPE_SECRET_KEY                  Stripe secret key (server only, never exposed)
 *   STRIPE_BRAND_SUBSCRIPTION_PRICE_ID Price id of the recurring brand plan
 */
const { getSdk, handleError } = require('../api-util/sdk');
const { getRootURL } = require('../api-util/rootURL');

const STRIPE_API = 'https://api.stripe.com/v1';

const secretKey = () => process.env.STRIPE_SECRET_KEY;
const priceId = () => process.env.STRIPE_BRAND_SUBSCRIPTION_PRICE_ID;

const isConfigured = () => !!secretKey() && !!priceId();

// Stripe's API takes form-encoded bodies, including for nested params.
const formEncode = (obj, prefix = '') =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .flatMap(([k, v]) => {
      const key = prefix ? `${prefix}[${k}]` : k;
      return typeof v === 'object' && !Array.isArray(v)
        ? formEncode(v, key)
        : [`${encodeURIComponent(key)}=${encodeURIComponent(v)}`];
    })
    .join('&');

const stripeRequest = async (path, { method = 'GET', body } = {}) => {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(body ? { body: formEncode(body) } : {}),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || 'Stripe request failed';
    throw new Error(message);
  }
  return data;
};

const notConfigured = res =>
  res.status(501).json({
    error:
      'Brand subscriptions are not configured. Set STRIPE_SECRET_KEY and STRIPE_BRAND_SUBSCRIPTION_PRICE_ID.',
  });

const getCurrentUser = sdk =>
  sdk.currentUser.show().then(response => response.data.data);

/**
 * Find or create the Stripe customer for this marketplace user, and remember the
 * id on their profile so we don't create duplicates on the next subscribe.
 */
const resolveStripeCustomerId = async (sdk, currentUser) => {
  const existing = currentUser.attributes.profile.privateData?.stripeCustomerId;
  if (existing) {
    return existing;
  }

  const customer = await stripeRequest('/customers', {
    method: 'POST',
    body: {
      email: currentUser.attributes.email,
      name: currentUser.attributes.profile.displayName,
      metadata: { sharetribeUserId: currentUser.id.uuid },
    },
  });

  await sdk.currentUser.updateProfile({
    privateData: { stripeCustomerId: customer.id },
  });

  return customer.id;
};

const summarizePrice = price => ({
  unitAmount: price.unit_amount,
  // Stripe always returns lowercase currency codes ("usd"), but
  // src/config/settingsCurrency.js's subUnitDivisors map (which
  // src/util/currency.js's unitDivisor/formatMoney look up) is keyed by
  // uppercase ISO codes ("USD") — pass it through as-is and formatMoney
  // throws "No minor unit divisor defined for currency: usd".
  currency: price.currency.toUpperCase(),
  interval: price.recurring?.interval || null,
  intervalCount: price.recurring?.interval_count || 1,
});

const summarize = subscription => {
  if (!subscription) {
    return { isActive: false, status: 'none' };
  }
  // 'trialing' still grants access; 'past_due' deliberately does not.
  const isActive = ['active', 'trialing'].includes(subscription.status);
  return {
    isActive,
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end || null,
    cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
  };
};

/**
 * GET /api/subscription/status
 * Reads the live subscription state from Stripe. Stripe stays authoritative, so
 * a cancellation or a failed payment takes effect immediately.
 */
const subscriptionStatus = async (req, res) => {
  if (!isConfigured()) {
    return notConfigured(res);
  }
  try {
    const sdk = getSdk(req, res);
    const currentUser = await getCurrentUser(sdk);
    const customerId = currentUser.attributes.profile.privateData?.stripeCustomerId;

    if (!customerId) {
      return res.status(200).json({ isActive: false, status: 'none' });
    }

    const { data } = await stripeRequest(
      `/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`
    );
    // A brand may have an old canceled subscription alongside a current one.
    const relevant = data.find(s => ['active', 'trialing', 'past_due', 'unpaid'].includes(s.status));
    return res.status(200).json(summarize(relevant));
  } catch (e) {
    return handleError(res, e);
  }
};

/**
 * GET /api/subscription/price
 * IMPLEMENTATION-PLAN.md F9.2: SubscriptionPage must not hardcode the price —
 * this reads the live Stripe Price object for STRIPE_BRAND_SUBSCRIPTION_PRICE_ID,
 * so a price change in Stripe (or a currency/interval change) shows up here
 * without a code deploy. Not user-specific, so no currentUser lookup needed.
 */
const subscriptionPrice = async (req, res) => {
  if (!isConfigured()) {
    return notConfigured(res);
  }
  try {
    const price = await stripeRequest(`/prices/${encodeURIComponent(priceId())}`);
    return res.status(200).json(summarizePrice(price));
  } catch (e) {
    return handleError(res, e);
  }
};

/**
 * POST /api/subscription/create-checkout-session
 * Returns a Stripe-hosted Checkout URL. The brand enters payment details there,
 * on Stripe's domain.
 */
const createCheckoutSession = async (req, res) => {
  if (!isConfigured()) {
    return notConfigured(res);
  }
  try {
    const sdk = getSdk(req, res);
    const currentUser = await getCurrentUser(sdk);
    const customerId = await resolveStripeCustomerId(sdk, currentUser);
    const rootUrl = getRootURL();

    const session = await stripeRequest('/checkout/sessions', {
      method: 'POST',
      body: {
        mode: 'subscription',
        customer: customerId,
        'line_items[0][price]': priceId(),
        'line_items[0][quantity]': 1,
        success_url: `${rootUrl}/subscription?status=success`,
        cancel_url: `${rootUrl}/subscription?status=canceled`,
        client_reference_id: currentUser.id.uuid,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return handleError(res, e);
  }
};

/**
 * POST /api/subscription/billing-portal
 * Hands the brand over to Stripe to update their card or cancel. Keeps us out of
 * the business of storing or displaying payment details.
 */
const createBillingPortalSession = async (req, res) => {
  if (!isConfigured()) {
    return notConfigured(res);
  }
  try {
    const sdk = getSdk(req, res);
    const currentUser = await getCurrentUser(sdk);
    const customerId = currentUser.attributes.profile.privateData?.stripeCustomerId;

    if (!customerId) {
      return res.status(409).json({ error: 'No subscription to manage.' });
    }

    const session = await stripeRequest('/billing_portal/sessions', {
      method: 'POST',
      body: {
        customer: customerId,
        return_url: `${getRootURL()}/subscription`,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return handleError(res, e);
  }
};

module.exports = {
  subscriptionStatus,
  subscriptionPrice,
  createCheckoutSession,
  createBillingPortalSession,
};
