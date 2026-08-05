/**
 * Dispute mediation for the operator console (IMPLEMENTATION-PLAN.md F5.3).
 */
const { getIntegrationSdk } = require('../../api-util/integrationSdk');
const { handleError } = require('../../api-util/sdk');
const { assertOperator } = require('./index');
const {
  CGC_UGC_PROCESS_NAME,
  DISPUTED_STATE,
  RESOLUTION_TRANSITIONS,
  serializeDisputedTransaction,
  indexIncluded,
  validateResolveBody,
} = require('../../api-util/adminDisputes');

/**
 * GET /api/admin/disputes
 */
const listDisputes = (req, res) => {
  assertOperator(req, res)
    .then(() =>
      getIntegrationSdk().transactions.query({
        processNames: CGC_UGC_PROCESS_NAME,
        states: DISPUTED_STATE,
        include: ['customer', 'provider', 'listing'],
      })
    )
    .then(response => {
      const { data, included = [] } = response.data;
      const entitiesById = indexIncluded(included);
      const disputes = data.map(tx => serializeDisputedTransaction(tx, entitiesById));
      res.status(200).json({ disputes });
    })
    .catch(e => handleError(res, e));
};

/**
 * POST /api/admin/disputes/resolve
 * Body: { transactionId, resolution: 'payCreator'|'refundBrand' }
 */
const resolveDispute = (req, res) => {
  assertOperator(req, res)
    .then(() => {
      const { transactionId, resolution } = validateResolveBody(req.body);
      return getIntegrationSdk().transactions.transition({
        id: transactionId,
        transition: RESOLUTION_TRANSITIONS[resolution],
        params: {},
      });
    })
    .then(() => {
      res.status(200).json({ success: true });
    })
    .catch(e => handleError(res, e));
};

module.exports = { listDisputes, resolveDispute };
