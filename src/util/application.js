/**
 * Shared helpers for the cgc-application process (project applications and
 * price negotiation). Read-only / display-oriented — this file is safe to
 * import from the browser.
 *
 * The offer AMOUNTS live in the transaction's `metadata` (server-writable
 * only), never in `protectedData`, because protectedData can be overwritten
 * by either transacting party's own transition. See
 * IMPLEMENTATION-PLAN.md 2.3b for the full reasoning.
 *
 * This file has a CommonJS twin at server/api-util/application.js with
 * identical logic — keep the two in sync. The server copy is the one that
 * actually gates money (IMPLEMENTATION-PLAN.md 2.6); this copy is for
 * rendering the same numbers in the UI.
 */

// Transitions in ext/transaction-processes/cgc-application/process.edn that
// carry a new offer amount, in the order they can occur.
export const OFFER_TRANSITIONS = ['transition/apply', 'transition/brand-counter'];

// Sharetribe actor role expected to have performed each offer transition.
// customer = creator, provider = brand in THIS process (roles are inverted
// relative to cgc-ugc-approval — see BLUEPRINT.md 1.3).
export const OFFER_ACTOR_BY_TRANSITION = {
  'transition/apply': 'customer',
  'transition/brand-counter': 'provider',
};

// Per the brief: at most one proposal from the creator, one counter from the
// brand. No third round.
export const MAX_OFFERS = 2;

/**
 * @param {Object} metadata - transaction.attributes.metadata
 * @returns {Array} the offers array, or [] if absent/malformed
 */
export const getOffers = metadata => {
  const offers = metadata?.offers;
  return Array.isArray(offers) ? offers : [];
};

/**
 * The price both parties are bound to right now: the most recent offer.
 * Before any offer exists (shouldn't happen once `apply` has run — apply
 * always writes the first offer) this returns null.
 *
 * @param {Object} metadata - transaction.attributes.metadata
 * @returns {number|null} amount in subunits
 */
export const getAgreedPriceInSubunits = metadata => {
  const offers = getOffers(metadata);
  return offers.length > 0 ? offers[offers.length - 1].amountInSubunits : null;
};

/**
 * True only when there is exactly one offer and it was made by the creator
 * (customer) — i.e. the brand has a counter-offer available. Once the brand
 * has countered, or if the creator applied at the listed price and the brand
 * has not yet responded, this returns false: there is nothing further to
 * counter (BLUEPRINT.md D2 — at most one brand counter).
 *
 * @param {Object} metadata - transaction.attributes.metadata
 * @returns {boolean}
 */
export const canCounter = metadata => {
  const offers = getOffers(metadata);
  return offers.length === 1 && offers[0].by === 'customer';
};

/**
 * Validates that an `offers` array is exactly what the transaction's own
 * transition history says it should be: same length, same order, same
 * transition name, same actor, at each index. This is what stops either
 * party from forging an offer amount by replaying update-protected-data-style
 * tampering — mirrors the pattern in
 * server/api-util/negotiation.js#isValidNegotiationOffersArray, adapted to
 * this process's transition names.
 *
 * @param {Array} offers
 * @param {Array} txTransitions - transaction.attributes.transitions
 * @returns {boolean}
 */
export const isValidOfferHistory = (offers, txTransitions) => {
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
