/**
 * Operator identity (IMPLEMENTATION-PLAN.md F5.1).
 *
 * isOperatorUserType is a client-side hint only — it reads publicData the
 * account owner could set on themselves, so it's fine for deciding whether
 * to show an "Admin console" link, but never for actually gating /admin/*
 * content. The real check happens server-side against CGC_OPERATOR_USER_IDS
 * (see server/api-util/operator.js) and must be re-asked via
 * fetchAdminStatus before any admin page renders real data.
 */

const OPERATOR_USER_TYPE = 'operator';

/**
 * @param {Object} currentUser - API entity
 * @returns {boolean}
 */
export const isOperatorUserType = currentUser =>
  currentUser?.attributes?.profile?.publicData?.userType === OPERATOR_USER_TYPE;
