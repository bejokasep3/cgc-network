/**
 * Creator applications and brand access requests (IMPLEMENTATION-PLAN.md
 * F4.1). Both are gated by Sharetribe's built-in user approval (Console:
 * Access control -> approval on, F0.2) — a submission here doesn't itself
 * flip the user's `state`, it only gives the operator what they need to
 * review it (F5.2).
 *
 * Written via the Integration SDK, not the caller's own trusted SDK: the
 * plan explicitly requires this because privateData.application /
 * .accessRequest is what an operator judges the account on, and the regular
 * SDK would let the user rewrite their own submission (e.g. inflate a
 * follower count) after the fact just as easily as submitting it.
 *
 * privateData updates are a shallow, top-level merge (confirmed against
 * Sharetribe's Integration API reference), so writing `application` here
 * never touches sibling keys like `shippingAddress` (F4.2) or `inviteCode`.
 *
 * A submitted invite code (F5.3) is looked up and, if it's still usable
 * (published, under its use limit, not expired), redeemed — its usedCount
 * is incremented. An invalid/expired/exhausted code never blocks the
 * application itself; it's just not redeemed, and the raw text is still
 * saved to privateData.inviteCode so the operator can see what was claimed.
 */
const { getSdk, handleError } = require('../api-util/sdk');
const { getIntegrationSdk } = require('../api-util/integrationSdk');
const {
  applicationError,
  validateCreatorApplication,
  validateAccessRequest,
} = require('../api-util/applications');
const {
  findInviteCodeListing,
  redeemInviteCode,
  isUsableInviteCode,
} = require('../api-util/adminInvites');

const isNonEmptyString = v => typeof v === 'string' && v.trim().length > 0;

module.exports = (req, res) => {
  const { type, inviteCode, ...body } = req.body || {};
  const sdk = getSdk(req, res);
  let currentUserId;

  // getIntegrationSdk() throws synchronously (e.g. missing
  // SHARETRIBE_INTEGRATION_CLIENT_ID/SECRET). Done here, before the promise
  // chain, so that failure goes through handleError like every other error
  // in this handler, instead of falling through to Express's default HTML
  // error page (which the frontend's res.json() can't parse).
  let integrationSdk;
  try {
    integrationSdk = getIntegrationSdk();
  } catch (e) {
    return handleError(res, e);
  }

  sdk.currentUser
    .show()
    .then(response => {
      const currentUser = response.data.data;
      currentUserId = currentUser.id;
      const userType = currentUser.attributes.profile.publicData?.userType;

      if (!['creator', 'brand'].includes(type)) {
        throw applicationError(400, `Unknown application type: ${type}`);
      }
      if (type === 'creator' && userType !== 'creator') {
        throw applicationError(403, 'Only creator accounts can submit a creator application.');
      }
      if (type === 'brand' && userType !== 'brand') {
        throw applicationError(403, 'Only brand accounts can request access.');
      }

      const trimmedCode = type === 'creator' && isNonEmptyString(inviteCode) ? inviteCode.trim() : null;
      return trimmedCode
        ? findInviteCodeListing(integrationSdk, trimmedCode).then(listing => ({
            trimmedCode,
            inviteCodeListing: listing,
          }))
        : { trimmedCode, inviteCodeListing: null };
    })
    .then(({ trimmedCode, inviteCodeListing }) => {
      const privateData =
        type === 'creator'
          ? {
              application: validateCreatorApplication(body),
              ...(trimmedCode ? { inviteCode: trimmedCode } : {}),
            }
          : { accessRequest: validateAccessRequest(body) };

      return integrationSdk.users
        .updateProfile({ id: currentUserId, privateData })
        .then(() =>
          inviteCodeListing && isUsableInviteCode(inviteCodeListing)
            ? redeemInviteCode(integrationSdk, inviteCodeListing)
            : null
        );
    })
    .then(() => {
      res.status(200).json({ success: true });
    })
    .catch(e => {
      handleError(res, e);
    });
};
