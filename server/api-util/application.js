/**
 * Shared helpers for the cgc-application process (project applications and
 * price negotiation).
 *
 * This is the authoritative copy: server/api/initiate-privileged.js and
 * server/api/transition-privileged.js use `getAgreedPriceInSubunits` to
 * decide what a brand actually gets charged (see IMPLEMENTATION-PLAN.md 2.6).
 * It has a browser-safe ESM twin at src/util/application.js with identical
 * logic, used only for rendering the same numbers in the UI — keep the two
 * in sync.
 *
 * The offer AMOUNTS live in the transaction's `metadata` (server-writable
 * only), never in `protectedData`, because protectedData can be overwritten
 * by either transacting party's own transition. See
 * IMPLEMENTATION-PLAN.md 2.3b for the full reasoning.
 */

// Transitions in ext/transaction-processes/cgc-application/process.edn that
// carry a new offer amount, in the order they can occur.
const OFFER_TRANSITIONS = ['transition/apply', 'transition/brand-counter'];

// Sharetribe actor role expected to have performed each offer transition.
// customer = creator, provider = brand in THIS process (roles are inverted
// relative to cgc-ugc-approval — see BLUEPRINT.md 1.3).
const OFFER_ACTOR_BY_TRANSITION = {
  'transition/apply': 'customer',
  'transition/brand-counter': 'provider',
};

// Per the brief: at most one proposal from the creator, one counter from the
// brand. No third round.
const MAX_OFFERS = 2;

/**
 * @param {Object} metadata - transaction.attributes.metadata
 * @returns {Array} the offers array, or [] if absent/malformed
 */
const getOffers = metadata => {
  const offers = metadata && metadata.offers;
  return Array.isArray(offers) ? offers : [];
};

/**
 * The price both parties are bound to right now: the most recent offer.
 *
 * @param {Object} metadata - transaction.attributes.metadata
 * @returns {number|null} amount in subunits
 */
const getAgreedPriceInSubunits = metadata => {
  const offers = getOffers(metadata);
  return offers.length > 0 ? offers[offers.length - 1].amountInSubunits : null;
};

/**
 * True only when there is exactly one offer and it was made by the creator
 * (customer) — i.e. the brand has a counter-offer available.
 *
 * @param {Object} metadata - transaction.attributes.metadata
 * @returns {boolean}
 */
const canCounter = metadata => {
  const offers = getOffers(metadata);
  return offers.length === 1 && offers[0].by === 'customer';
};

/**
 * Validates that an `offers` array is exactly what the transaction's own
 * transition history says it should be: same length, same order, same
 * transition name, same actor, at each index. Mirrors the pattern in
 * negotiation.js#isValidNegotiationOffersArray, adapted to this process's
 * transition names.
 *
 * @param {Array} offers
 * @param {Array} txTransitions - transaction.attributes.transitions
 * @returns {boolean}
 */
const isValidOfferHistory = (offers, txTransitions) => {
  if (!Array.isArray(offers) || !Array.isArray(txTransitions)) {
    return false;
  }
  if (offers.length === 0 || offers.length > MAX_OFFERS) {
    return false;
  }

  const relevantTransitions = txTransitions.filter(t => OFFER_TRANSITIONS.includes(t.transition));
  if (relevantTransitions.length !== offers.length) {
    return false;
  }

  return offers.every((offer, i) => {
    const txEntry = relevantTransitions[i];
    const expectedActor = OFFER_ACTOR_BY_TRANSITION[txEntry.transition];
    return (
      offer.transition === txEntry.transition &&
      offer.by === expectedActor &&
      Number.isInteger(offer.amountInSubunits) &&
      offer.amountInSubunits > 0
    );
  });
};

module.exports = {
  OFFER_TRANSITIONS,
  OFFER_ACTOR_BY_TRANSITION,
  MAX_OFFERS,
  getOffers,
  getAgreedPriceInSubunits,
  canCounter,
  isValidOfferHistory,
};
