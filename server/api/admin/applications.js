/**
 * The operator's application queue (IMPLEMENTATION-PLAN.md F5.2). Every
 * handler here calls assertOperator (server/api/admin/index.js) first —
 * that's the real gate, not the client's own check.
 */
const { getIntegrationSdk } = require('../../api-util/integrationSdk');
const { handleError } = require('../../api-util/sdk');
const { assertOperator } = require('./index');
const {
  isPendingApplicant,
  serializeApplicant,
  validateApproveBody,
  validateDecisionBody,
} = require('../../api-util/adminApplications');

const PER_PAGE = 100;

// Same "fetch every page, filter in code" approach as list-creators.js — the
// Integration API's users.query can't filter by state directly (confirmed
// against the API reference), only by top-level fields like createdAt.
const fetchAllPendingApplicants = integrationSdk => {
  const fetchPage = (page, accumulated) =>
    integrationSdk.users.query({ page, perPage: PER_PAGE }).then(response => {
      const { data, meta } = response.data;
      const combined = accumulated.concat(data.filter(isPendingApplicant));
      const hasMorePages = meta && page < meta.totalPages;
      return hasMorePages ? fetchPage(page + 1, combined) : combined;
    });
  return fetchPage(1, []);
};

/**
 * GET /api/admin/applications
 */
const listApplicants = (req, res) => {
  assertOperator(req, res)
    .then(() => fetchAllPendingApplicants(getIntegrationSdk()))
    .then(users => {
      res.status(200).json({ applicants: users.map(serializeApplicant) });
    })
    .catch(e => handleError(res, e));
};

/**
 * POST /api/admin/applications/approve
 * Body: { userId }
 */
const approveApplicant = (req, res) => {
  assertOperator(req, res)
    .then(() => {
      const { userId } = validateApproveBody(req.body);
      return getIntegrationSdk().users.approve({ id: userId });
    })
    .then(() => {
      res.status(200).json({ success: true });
    })
    .catch(e => handleError(res, e));
};

/**
 * POST /api/admin/applications/decide
 * Body: { userId, status: 'rejected'|'moreInfoRequested', note }
 *
 * Does not change the account's real Sharetribe state (no reject/ban
 * endpoint exists) — records the decision on the applicant's own
 * privateData instead. See adminApplications.js's module doc for why.
 */
const decideApplicant = (req, res) => {
  assertOperator(req, res)
    .then(() => {
      const { userId, status, note } = validateDecisionBody(req.body);
      return getIntegrationSdk().users.updateProfile({
        id: userId,
        privateData: {
          applicationDecision: { status, note, decidedAt: new Date().toISOString() },
        },
      });
    })
    .then(() => {
      res.status(200).json({ success: true });
    })
    .catch(e => handleError(res, e));
};

module.exports = { listApplicants, approveApplicant, decideApplicant };
