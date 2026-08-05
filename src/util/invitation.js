// Shared invitation-lifetime logic (IMPLEMENTATION-PLAN.md F2.5). A brand
// invites a creator to a project via `transition/inquire` on the creator's
// own creator-profile listing (protectedData.projectId + invitationStatus).
// That transition has no built-in expiry, so "still active" is computed here
// from the transaction's age rather than a state-machine transition.

export const INVITATION_VALIDITY_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const isInvitationExpired = createdAt => {
  if (!createdAt) {
    return false;
  }
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return (Date.now() - created.getTime()) / MS_PER_DAY > INVITATION_VALIDITY_DAYS;
};

/**
 * True while the creator can still act on the invitation: the brand hasn't
 * been declined, and the invitation hasn't aged past its validity window.
 *
 * @param {Object} tx - transaction entity (transition/inquire sale, creator as provider)
 * @returns {boolean}
 */
export const isInvitationActive = tx => {
  const protectedData = tx?.attributes?.protectedData || {};
  if (protectedData.invitationStatus === 'declined') {
    return false;
  }
  return !isInvitationExpired(tx?.attributes?.createdAt);
};
