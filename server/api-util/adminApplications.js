/**
 * The operator's application queue (IMPLEMENTATION-PLAN.md F5.2).
 *
 * Sharetribe's Integration API has a real users/approve endpoint (confirmed
 * against https://www.sharetribe.com/api-reference/integration.html before
 * writing this, per the plan's own instruction) but no reject/ban endpoint —
 * a user can only be 'active', 'pendingApproval', or 'banned', and there is
 * no documented way to move a user INTO 'banned' via the API. So "reject"
 * and "request more info" don't change the account's real state: they write
 * a decision record to the user's own privateData.applicationDecision
 * (readable back on /pending, PendingPage.js) and simply leave the account
 * in pendingApproval — which already blocks listing/transacting — instead
 * of ever calling users/approve for them. The queue itself then filters by
 * that decision so already-handled applicants don't clutter the daily view.
 */

const PENDING_APPROVAL_STATE = 'pendingApproval';
const APPLICANT_USER_TYPES = ['creator', 'brand'];
const DECISION_STATUSES = ['rejected', 'moreInfoRequested'];

const adminApplicationsError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.statusText = message;
  error.data = {};
  return error;
};
exports.adminApplicationsError = adminApplicationsError;

/**
 * @param {Object} user - Integration API user resource
 * @returns {boolean}
 */
const isPendingApplicant = user =>
  user?.attributes?.state === PENDING_APPROVAL_STATE &&
  APPLICANT_USER_TYPES.includes(user?.attributes?.profile?.publicData?.userType);
exports.isPendingApplicant = isPendingApplicant;

/**
 * Shapes a raw Integration API user resource down to what the queue UI
 * needs — never the whole user entity, so nothing beyond application-review
 * material leaks to the client.
 *
 * @param {Object} user - Integration API user resource
 * @returns {Object}
 */
const serializeApplicant = user => {
  const profile = user.attributes.profile || {};
  const publicData = profile.publicData || {};
  const privateData = profile.privateData || {};
  const userType = publicData.userType;

  return {
    id: user.id.uuid,
    email: user.attributes.email || null,
    displayName: profile.displayName || null,
    userType,
    createdAt: user.attributes.createdAt,
    application: userType === 'creator' ? privateData.application || null : null,
    accessRequest: userType === 'brand' ? privateData.accessRequest || null : null,
    decision: privateData.applicationDecision || null,
    // Which invite code (F5.3), if any, this applicant claimed at /apply.
    inviteCode: userType === 'creator' ? privateData.inviteCode || null : null,
  };
};
exports.serializeApplicant = serializeApplicant;

/**
 * @param {Object} body - req.body for POST /api/admin/applications/approve
 * @returns {{userId: string}}
 */
exports.validateApproveBody = body => {
  const { userId } = body || {};
  if (typeof userId !== 'string' || !userId.trim()) {
    throw adminApplicationsError(400, 'Missing userId.');
  }
  return { userId: userId.trim() };
};

/**
 * @param {Object} body - req.body for POST /api/admin/applications/decide
 * @returns {{userId: string, status: 'rejected'|'moreInfoRequested', note: string}}
 */
exports.validateDecisionBody = body => {
  const { userId, status, note } = body || {};
  if (typeof userId !== 'string' || !userId.trim()) {
    throw adminApplicationsError(400, 'Missing userId.');
  }
  if (!DECISION_STATUSES.includes(status)) {
    throw adminApplicationsError(400, `Unknown decision status: ${status}`);
  }
  if (typeof note !== 'string' || !note.trim()) {
    throw adminApplicationsError(
      400,
      status === 'rejected' ? 'A reason is required to reject an applicant.' : 'A note is required.'
    );
  }
  return { userId: userId.trim(), status, note: note.trim() };
};
