/**
 * Dispute mediation (IMPLEMENTATION-PLAN.md F5.3, BLUEPRINT §5).
 *
 * Both resolutions are transitions with :actor :actor.role/operator in
 * cgc-ugc-approval/process.edn — mark-received-from-disputed (pay the
 * creator) and cancel-from-disputed (refund the brand) — which only the
 * Integration API can invoke (confirmed: operator-actor transitions are
 * documented as Integration-API-only). Neither transition takes params;
 * every effect (payout, refund) is computed from the transaction/listing
 * itself by the process's own actions.
 */

const CGC_UGC_PROCESS_NAME = 'cgc-ugc-approval';
exports.CGC_UGC_PROCESS_NAME = CGC_UGC_PROCESS_NAME;

const DISPUTED_STATE = 'state/disputed';
exports.DISPUTED_STATE = DISPUTED_STATE;

const RESOLUTION_TRANSITIONS = {
  payCreator: 'transition/mark-received-from-disputed',
  refundBrand: 'transition/cancel-from-disputed',
};
exports.RESOLUTION_TRANSITIONS = RESOLUTION_TRANSITIONS;

const adminDisputesError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.statusText = message;
  error.data = {};
  return error;
};
exports.adminDisputesError = adminDisputesError;

/**
 * @param {Object} body - req.body for POST /api/admin/disputes/resolve
 * @returns {{transactionId: string, resolution: 'payCreator'|'refundBrand'}}
 */
exports.validateResolveBody = body => {
  const { transactionId, resolution } = body || {};
  if (typeof transactionId !== 'string' || !transactionId.trim()) {
    throw adminDisputesError(400, 'Missing transactionId.');
  }
  if (!RESOLUTION_TRANSITIONS[resolution]) {
    throw adminDisputesError(400, `Unknown resolution: ${resolution}`);
  }
  return { transactionId: transactionId.trim(), resolution };
};

/**
 * @param {Object} tx - Integration API transaction resource (expects
 *   include: ['customer', 'provider', 'listing'] and their entities in
 *   `included`)
 * @param {Object} entitiesById - { [type]: { [uuid]: resource } }, built by
 *   indexIncluded() below
 * @returns {Object}
 */
const serializeDisputedTransaction = (tx, entitiesById) => {
  const customerId = tx.relationships?.customer?.data?.id?.uuid;
  const providerId = tx.relationships?.provider?.data?.id?.uuid;
  const listingId = tx.relationships?.listing?.data?.id?.uuid;
  const customer = customerId ? entitiesById.user?.[customerId] : null;
  const provider = providerId ? entitiesById.user?.[providerId] : null;
  const listing = listingId ? entitiesById.listing?.[listingId] : null;
  const price = tx.attributes?.payinTotal;

  const transitions = (tx.attributes?.transitions || []).map(t => ({
    transition: t.transition,
    createdAt: t.createdAt,
  }));
  const disputedAt = [...transitions].reverse().find(t => t.transition && t.transition.includes('dispute'))
    ?.createdAt;

  return {
    id: tx.id.uuid,
    listingTitle: listing?.attributes?.title || null,
    customerName: customer?.attributes?.profile?.displayName || null,
    providerName: provider?.attributes?.profile?.displayName || null,
    priceAmount: price?.amount ?? null,
    priceCurrency: price?.currency ?? null,
    disputedAt: disputedAt || null,
    transitions,
  };
};
exports.serializeDisputedTransaction = serializeDisputedTransaction;

/**
 * Indexes an Integration API `included` array by type and id, so serializers
 * can look up a relationship's full entity without re-fetching it.
 *
 * @param {Array<Object>} included
 * @returns {Object} { [type]: { [uuid]: resource } }
 */
exports.indexIncluded = included =>
  (included || []).reduce((acc, entity) => {
    const type = entity.type;
    const id = entity.id?.uuid;
    if (!type || !id) {
      return acc;
    }
    acc[type] = acc[type] || {};
    acc[type][id] = entity;
    return acc;
  }, {});
