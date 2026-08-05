/**
 * Base gate for the operator console (IMPLEMENTATION-PLAN.md F5.1).
 *
 * Every future admin endpoint (F5.2+: application queue, invite codes,
 * dispute mediation) must call assertOperator first and only then touch the
 * Integration API — the client-side check in src/util/operator.js is a UI
 * convenience (skip the flash of admin content, bounce fast), never the
 * actual security boundary. That boundary is this file, re-checked on every
 * request, because userType alone is data the account owner could set on
 * themselves (see api-util/operator.js).
 */
const { getSdk, handleError } = require('../../api-util/sdk');
const { isOperatorUser } = require('../../api-util/operator');

const operatorError = () => {
  const error = new Error('Not authorized as an operator.');
  error.status = 403;
  error.statusText = error.message;
  error.data = {};
  return error;
};

/**
 * Resolves to the current user if — and only if — they're a verified
 * operator (userType 'operator' AND their id is in CGC_OPERATOR_USER_IDS).
 * Rejects with a 403 otherwise. Import this in any admin/*.js endpoint
 * before reading or writing anything via the Integration API.
 *
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @returns {Promise<Object>} the current user resource
 */
const assertOperator = (req, res) =>
  getSdk(req, res)
    .currentUser.show()
    .then(response => {
      const currentUser = response.data.data;
      if (!isOperatorUser(currentUser)) {
        throw operatorError();
      }
      return currentUser;
    });

/**
 * GET /api/admin/status
 * Lets the client ask "am I allowed in here" before rendering any /admin/*
 * page, without that check ever being trusted as the real gate.
 */
const adminStatus = (req, res) => {
  assertOperator(req, res)
    .then(() => res.status(200).json({ isOperator: true }))
    .catch(e => handleError(res, e, { skipErrorLogging: true }));
};

module.exports = { assertOperator, adminStatus };
