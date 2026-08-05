/**
 * Invite code CRUD for the operator console (IMPLEMENTATION-PLAN.md F5.3).
 */
const { getIntegrationSdk } = require('../../api-util/integrationSdk');
const { handleError } = require('../../api-util/sdk');
const { assertOperator } = require('./index');
const {
  INVITE_CODE_LISTING_TYPE,
  randomCode,
  findInviteCodeListing,
  serializeInviteCode,
  validateCreateInviteCodeBody,
  validateRevokeInviteCodeBody,
} = require('../../api-util/adminInvites');

const PER_PAGE = 100;
const MAX_GENERATION_ATTEMPTS = 5;

// Collisions are astronomically unlikely at 33^6 combinations, but cheap to
// guard against anyway rather than trust probability alone.
const generateUniqueCode = (integrationSdk, attemptsLeft = MAX_GENERATION_ATTEMPTS) => {
  const code = randomCode();
  return findInviteCodeListing(integrationSdk, code).then(existing => {
    if (!existing) {
      return code;
    }
    if (attemptsLeft <= 1) {
      throw new Error('Could not generate a unique invite code.');
    }
    return generateUniqueCode(integrationSdk, attemptsLeft - 1);
  });
};

/**
 * GET /api/admin/invites
 */
const listInviteCodes = (req, res) => {
  assertOperator(req, res)
    .then(() => {
      const integrationSdk = getIntegrationSdk();
      const fetchPage = (page, accumulated) =>
        integrationSdk.listings
          .query({ pub_listingType: INVITE_CODE_LISTING_TYPE, page, perPage: PER_PAGE })
          .then(response => {
            const { data, meta } = response.data;
            const combined = accumulated.concat(data);
            const hasMorePages = meta && page < meta.totalPages;
            return hasMorePages ? fetchPage(page + 1, combined) : combined;
          });
      return fetchPage(1, []);
    })
    .then(listings => {
      res.status(200).json({ inviteCodes: listings.map(serializeInviteCode) });
    })
    .catch(e => handleError(res, e));
};

/**
 * POST /api/admin/invites
 * Body: { note, maxUses, expiresAt }
 */
const createInviteCode = (req, res) => {
  let operatorUser;
  assertOperator(req, res)
    .then(operator => {
      operatorUser = operator;
      const { note, maxUses, expiresAt } = validateCreateInviteCodeBody(req.body);
      const integrationSdk = getIntegrationSdk();
      return generateUniqueCode(integrationSdk).then(code => ({ code, note, maxUses, expiresAt }));
    })
    .then(({ code, note, maxUses, expiresAt }) =>
      getIntegrationSdk().listings.create({
        title: code,
        authorId: operatorUser.id,
        state: 'published',
        publicData: {
          listingType: INVITE_CODE_LISTING_TYPE,
          code,
          note,
          maxUses,
          usedCount: 0,
          expiresAt,
        },
      })
    )
    .then(() => {
      res.status(200).json({ success: true });
    })
    .catch(e => handleError(res, e));
};

/**
 * POST /api/admin/invites/revoke
 * Body: { listingId }
 */
const revokeInviteCode = (req, res) => {
  assertOperator(req, res)
    .then(() => {
      const { listingId } = validateRevokeInviteCodeBody(req.body);
      return getIntegrationSdk().listings.close({ id: listingId });
    })
    .then(() => {
      res.status(200).json({ success: true });
    })
    .catch(e => handleError(res, e));
};

module.exports = { listInviteCodes, createInviteCode, revokeInviteCode };
