/**
 * Operator identity check (IMPLEMENTATION-PLAN.md F5.1, shape per §2.7).
 *
 * An operator account is marked `userType: 'operator'` on its own profile,
 * but that alone is client-writable data — anyone could set it on their own
 * account. The real authorization is that the account's id must ALSO appear
 * in the CGC_OPERATOR_USER_IDS env var, which only the CGC team can set.
 * Both checks are required; userType alone is never trusted as proof.
 */

const OPERATOR_USER_TYPE = 'operator';

const operatorUserIds = () =>
  (process.env.CGC_OPERATOR_USER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

const isOperatorUserId = userId => !!userId && operatorUserIds().includes(userId);

/**
 * @param {Object} user - Marketplace/Integration API user resource
 *   (e.g. sdk.currentUser.show() response data)
 * @returns {boolean}
 */
const isOperatorUser = user => {
  const userType = user?.attributes?.profile?.publicData?.userType;
  return userType === OPERATOR_USER_TYPE && isOperatorUserId(user?.id?.uuid);
};

exports.OPERATOR_USER_TYPE = OPERATOR_USER_TYPE;
exports.isOperatorUserId = isOperatorUserId;
exports.isOperatorUser = isOperatorUser;
