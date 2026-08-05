/**
 * Shared logic for the two server-side moments where CGC's application/offer
 * model touches money and metadata:
 *
 * 1. Writing an offer amount to a cgc-application transaction's metadata
 *    (transition/apply, transition/brand-counter) — see
 *    IMPLEMENTATION-PLAN.md 2.3b for why this must happen server-side.
 * 2. Pricing a cgc-ugc-approval checkout on a creator-profile listing from an
 *    ACCEPTED cgc-application, instead of from the listing's own (indicative
 *    only) price — see IMPLEMENTATION-PLAN.md 2.6, a hard security
 *    invariant: the client never gets to say what the price is.
 *
 * Used by server/api/initiate-privileged.js and
 * server/api/transition-privileged.js.
 */

const { getIntegrationSdk } = require('./integrationSdk');
const {
  OFFER_ACTOR_BY_TRANSITION,
  getAgreedPriceInSubunits,
  isValidOfferHistory,
} = require('./application');

const CGC_APPLICATION_PROCESS_NAME = 'cgc-application';
const CGC_UGC_PROCESS_NAME = 'cgc-ugc-approval';
const CREATOR_PROFILE_LISTING_TYPE = 'creator-profile';

const APPLY_TRANSITION = 'transition/apply';
const BRAND_COUNTER_TRANSITION = 'transition/brand-counter';
const MARK_COLLABORATING_TRANSITION = 'transition/mark-collaborating';
const CONFIRM_PAYMENT_TRANSITION = 'transition/confirm-payment';
const CGC_UGC_CHECKOUT_TRANSITIONS = [
  'transition/request-payment',
  'transition/request-payment-after-inquiry',
];
// The two ways a cgc-application transaction reaches :state/accepted.
const APPLICATION_ACCEPTING_TRANSITIONS = [
  'transition/brand-accept',
  'transition/creator-accept-counter',
];

const checkoutError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.statusText = message;
  error.data = {};
  return error;
};

/**
 * True for cgc-application's two offer-bearing transitions
 * (transition/apply always creates a new transaction, so only reaches
 * initiate-privileged.js; transition/brand-counter transitions an existing
 * one, so only reaches transition-privileged.js — callers only need to check
 * the transition name, not which file they're in).
 *
 * @param {string} transitionName
 * @returns {boolean}
 */
exports.isApplicationOfferTransition = transitionName => {
  return [APPLY_TRANSITION, BRAND_COUNTER_TRANSITION].includes(transitionName);
};

/**
 * True when this privileged transition is the moment a brand's payment for a
 * collaboration is captured on a creator-profile listing. Any such checkout
 * MUST be priced from an accepted cgc-application — see
 * IMPLEMENTATION-PLAN.md 2.6.
 *
 * @param {string} transitionName
 * @param {Object} listingPublicData - listing.attributes.publicData
 * @returns {boolean}
 */
exports.isCGCCollaborationCheckout = (transitionName, listingPublicData) => {
  return (
    CGC_UGC_CHECKOUT_TRANSITIONS.includes(transitionName) &&
    listingPublicData?.listingType === CREATOR_PROFILE_LISTING_TYPE
  );
};

/**
 * Finds a resource of a given type/id inside a JSON:API `included` array.
 * Mirrors the pattern already used for this in transition-privileged.js
 * (getListingRelationShip), reused here for the application transaction's
 * provider relationship.
 */
const findIncluded = (included, ref) => {
  return ref && included.find(i => i.type === ref.type && i.id.uuid === ref.id.uuid);
};

/**
 * Rejects a transition/apply attempt if this creator already has a
 * cgc-application transaction for the same project — F2.3's "applying twice
 * is rejected with a readable message" (the UX half lives in
 * ProjectDetailPage.duck.js's fetchOwnApplicationThunk, which keeps a repeat
 * visit from even showing the form; this is the enforced half, since a
 * client can always call the endpoint directly). Uses the regular
 * (cookie-scoped) SDK, not the Integration SDK — this only ever needs to see
 * the signed-in user's own transactions.
 *
 * @param {Object} params
 * @param {Object} params.sdk - request-scoped Marketplace API SDK instance
 * @param {string} params.projectId - the project listing's id (uuid)
 * @returns {Promise<void>} rejects with a 400 checkoutError if a match exists
 */
exports.assertNoExistingApplication = ({ sdk, projectId }) => {
  return sdk.transactions
    .query({
      only: 'order',
      processNames: [CGC_APPLICATION_PROCESS_NAME],
      'fields.transaction': ['protectedData'],
    })
    .then(response => {
      const alreadyApplied = response.data.data.some(
        tx => tx.attributes.protectedData?.projectId === projectId
      );
      if (alreadyApplied) {
        throw checkoutError(400, 'You have already applied to this project.');
      }
    });
};

/**
 * Fetches the cgc-application transaction the client claims backs this
 * checkout, validates it thoroughly, and returns the agreed price plus the
 * project listing id it came from (used by fetchProjectDeliverables below to
 * seed the collaboration's deliverables — see IMPLEMENTATION-PLAN.md F3.1).
 * Every check exists because `orderData` comes straight from the browser and
 * cannot be trusted — see IMPLEMENTATION-PLAN.md 2.6.
 *
 * @param {Object} params
 * @param {string} params.applicationId - transaction id claimed by the client
 * @param {Object} params.listing - the creator-profile listing being checked
 *   out (full API entity, as returned by sdk.listings.show)
 * @param {Object} params.currentUserId - the checking-out user's id, `{ uuid }`
 * @param {string} params.currency
 * @param {Function} params.Money - sharetribe-flex-sdk's Money constructor,
 *   passed in so this file doesn't need its own SDK dependency
 * @returns {Promise<{ agreedPriceMoney: Money, projectId: string }>}
 */
exports.fetchAgreedPriceMoney = ({ applicationId, listing, currentUserId, currency, Money }) => {
  if (!applicationId) {
    return Promise.reject(
      checkoutError(
        400,
        'Missing applicationId: a creator-profile checkout requires an accepted application.'
      )
    );
  }

  let integrationSdk;
  try {
    integrationSdk = getIntegrationSdk();
  } catch (e) {
    return Promise.reject(e);
  }

  // `applicationId` is a UUID from the `sharetribe-flex-sdk` package (it was
  // deserialized off the request body by server/api-util/sdk.js), but
  // `integrationSdk` comes from the separate `sharetribe-flex-integration-sdk`
  // package, whose params serializer only recognizes its own UUID class
  // (see its src/params_serializer.js). Passing the wrong package's UUID
  // instance isn't a no-op — it fails the `instanceof` check and throws
  // "Don't know how to serialize query parameter 'id'". Unwrapping to the
  // raw string sidesteps the mismatch entirely.
  return integrationSdk.transactions
    .show({ id: applicationId.uuid || applicationId, include: ['provider'] })
    .then(response => {
      const tx = response.data.data;
      const included = response.data.included || [];

      if (tx?.attributes?.processName !== CGC_APPLICATION_PROCESS_NAME) {
        throw checkoutError(400, 'applicationId does not point to a cgc-application transaction.');
      }
      if (!APPLICATION_ACCEPTING_TRANSITIONS.includes(tx.attributes.lastTransition)) {
        throw checkoutError(400, 'This application has not been accepted yet.');
      }

      const providerRef = tx.relationships?.provider?.data;
      const provider = findIncluded(included, providerRef);
      if (!provider || provider.id.uuid !== currentUserId?.uuid) {
        throw checkoutError(403, 'This application does not belong to the current user.');
      }

      const protectedData = tx.attributes.protectedData || {};
      if (protectedData.creatorListingId !== listing.id.uuid) {
        throw checkoutError(
          400,
          "The application's creatorListingId does not match the listing being checked out."
        );
      }
      if (protectedData.collaborationTxId) {
        throw checkoutError(
          400,
          'This application has already been used to start a collaboration.'
        );
      }

      const metadata = tx.attributes.metadata || {};
      if (!isValidOfferHistory(metadata.offers, tx.attributes.transitions)) {
        throw checkoutError(400, "The application's offer history is invalid.");
      }

      const agreedPriceInSubunits = getAgreedPriceInSubunits(metadata);
      if (!Number.isInteger(agreedPriceInSubunits) || agreedPriceInSubunits <= 0) {
        throw checkoutError(400, 'The application has no valid agreed price.');
      }

      return {
        agreedPriceMoney: new Money(agreedPriceInSubunits, currency),
        projectId: protectedData.projectId,
      };
    });
};

/**
 * Seeds a fresh collaboration's `protectedData.deliverables` from the
 * project listing's own `publicData.deliverables` (see
 * src/containers/PostProjectPage/PostProjectForm.js for that shape:
 * `{ id, type, platform, spec, quantity }`) — done server-side, from the
 * project listing itself rather than trusting whatever the client sends, so
 * a brand can't quietly change what they're paying for at checkout
 * (IMPLEMENTATION-PLAN.md F3.1). Each entry gets an empty `versions` array,
 * appended to by the creator over the course of the collaboration (see
 * TransactionPage.js's onSubmitDeliverables).
 *
 * @param {Object} params
 * @param {string} params.projectId
 * @returns {Promise<Array>} deliverables, or [] if the project has none / is unreachable
 */
exports.fetchProjectDeliverables = ({ projectId }) => {
  if (!projectId) {
    return Promise.resolve([]);
  }

  let integrationSdk;
  try {
    integrationSdk = getIntegrationSdk();
  } catch (e) {
    return Promise.reject(e);
  }

  return integrationSdk.listings.show({ id: projectId }).then(response => {
    const listing = response.data.data;
    const deliverables = listing?.attributes?.publicData?.deliverables;
    return Array.isArray(deliverables)
      ? deliverables.map(d => ({ ...d, versions: [] }))
      : [];
  });
};

/**
 * True for cgc-application's transition/mark-collaborating — the privileged,
 * provider(brand)-actor transition that links a just-paid cgc-ugc-approval
 * transaction back onto the application it came from. See
 * IMPLEMENTATION-PLAN.md 2.6 and the comment on this transition in
 * ext/transaction-processes/cgc-application/process.edn for why this must be
 * privileged even though it only writes protectedData.
 *
 * @param {string} transitionName
 * @returns {boolean}
 */
exports.isMarkCollaboratingTransition = transitionName => {
  return transitionName === MARK_COLLABORATING_TRANSITION;
};

/**
 * Verifies the collaboration transaction the client claims was just paid for
 * really exists, really belongs to this application, and really has been
 * paid — then returns the protectedData write that links the two. Every
 * check exists because a privileged transition's orderData still comes
 * straight from the browser and cannot be trusted (IMPLEMENTATION-PLAN.md
 * 2.6).
 *
 * @param {Object} params
 * @param {Object} params.orderData - `{ collaborationTxId }` from the client
 * @param {Object} params.applicationTx - the cgc-application transaction
 *   being transitioned (the one bodyParams.id points to), full API entity
 * @param {Object} params.currentUserId - the transitioning user's id,
 *   `{ uuid }` (the brand, provider role on cgc-application)
 * @returns {Promise<{ protectedData: Object }>}
 */
exports.buildMarkCollaboratingProtectedData = ({ orderData, applicationTx, currentUserId }) => {
  const collaborationTxId = orderData?.collaborationTxId;
  if (!collaborationTxId) {
    return Promise.reject(
      checkoutError(
        400,
        'Missing collaborationTxId: mark-collaborating requires the paid transaction id.'
      )
    );
  }

  const existingProtectedData = applicationTx?.attributes?.protectedData || {};
  if (existingProtectedData.collaborationTxId) {
    return Promise.reject(
      checkoutError(400, 'This application has already been linked to a collaboration.')
    );
  }

  let integrationSdk;
  try {
    integrationSdk = getIntegrationSdk();
  } catch (e) {
    return Promise.reject(e);
  }

  // Same cross-package UUID mismatch as fetchAgreedPriceMoney above —
  // unwrap to the raw string before handing it to integrationSdk.
  return integrationSdk.transactions
    .show({ id: collaborationTxId.uuid || collaborationTxId, include: ['customer', 'listing'] })
    .then(response => {
      const tx = response.data.data;
      const included = response.data.included || [];

      if (tx?.attributes?.processName !== CGC_UGC_PROCESS_NAME) {
        throw checkoutError(
          400,
          'collaborationTxId does not point to a cgc-ugc-approval transaction.'
        );
      }
      if (tx.attributes.lastTransition !== CONFIRM_PAYMENT_TRANSITION) {
        throw checkoutError(400, 'The collaboration transaction has not been paid yet.');
      }

      const customerRef = tx.relationships?.customer?.data;
      const customer = findIncluded(included, customerRef);
      if (!customer || customer.id.uuid !== currentUserId?.uuid) {
        throw checkoutError(
          403,
          'This collaboration transaction does not belong to the current user.'
        );
      }

      const listingRef = tx.relationships?.listing?.data;
      if (!listingRef || listingRef.id.uuid !== existingProtectedData.creatorListingId) {
        throw checkoutError(
          400,
          "The collaboration transaction's listing does not match this application."
        );
      }

      return { protectedData: { collaborationTxId: collaborationTxId.uuid || collaborationTxId } };
    });
};

/**
 * Builds the `{ metadata }` params for cgc-application's transition/apply or
 * transition/brand-counter: appends exactly one new offer to whatever is
 * already there. Throws (rather than silently clamping) if the negotiation
 * cap is exceeded or the amount is missing/invalid — a caught error here
 * becomes an HTTP 400, which is what should happen when the caller is
 * confused or tampering.
 *
 * transition/apply may omit `proposedPriceInSubunits` (applying at the
 * listed price); transition/brand-counter must always supply one explicitly
 * — there is no sensible default for a counter-offer.
 *
 * @param {Object} params
 * @param {Object} params.orderData - `{ proposedPriceInSubunits }` from the client
 * @param {string} params.transitionName
 * @param {Object} params.existingMetadata - transaction.attributes.metadata,
 *   or {} for a brand-new transaction (transition/apply)
 * @param {number} [params.listedPriceInSubunits] - the project listing's own
 *   price; only consulted for transition/apply
 * @returns {{ metadata: Object }}
 */
exports.buildApplicationOfferMetadata = ({
  orderData,
  transitionName,
  existingMetadata,
  listedPriceInSubunits,
}) => {
  const actorRole = OFFER_ACTOR_BY_TRANSITION[transitionName];
  if (!actorRole) {
    throw checkoutError(400, `${transitionName} is not an offer-bearing transition.`);
  }

  const { proposedPriceInSubunits } = orderData || {};
  const isApply = transitionName === APPLY_TRANSITION;
  // Only fall back to the listed price when no proposed price was sent at
  // all. A proposed price that IS present but invalid (a float, zero,
  // negative, a string) must fail loudly below — silently substituting the
  // listed price for garbage input would let a confused or malicious client
  // get a price it never actually asked for.
  const proposedPriceGiven = proposedPriceInSubunits !== undefined && proposedPriceInSubunits !== null;
  const amountInSubunits = proposedPriceGiven
    ? proposedPriceInSubunits
    : isApply
    ? listedPriceInSubunits
    : null;

  if (!Number.isInteger(amountInSubunits) || amountInSubunits <= 0) {
    throw checkoutError(400, 'Missing or invalid offer amount.');
  }

  const existingOffers = (existingMetadata && existingMetadata.offers) || [];
  if (existingOffers.length >= 2) {
    throw checkoutError(
      400,
      'This application has already used its one round of negotiation.'
    );
  }

  const newOffer = {
    by: actorRole,
    amountInSubunits,
    transition: transitionName,
    at: new Date().toISOString(),
  };

  return { metadata: { offers: [...existingOffers, newOffer] } };
};
