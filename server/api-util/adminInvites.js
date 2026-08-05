/**
 * Invite codes (IMPLEMENTATION-PLAN.md F5.3, BLUEPRINT C1b).
 *
 * Stored as plain listings, authored by whichever operator created them —
 * NOT registered in src/config/configListing.js's listingTypes array, since
 * they're never meant to go through the public listing UI (EditListingWizard,
 * SearchPage, ListingPage). Sharetribe's listings/create endpoint only
 * requires title/authorId/state (confirmed against the Integration API
 * reference before writing this), so a listing doesn't need a registered
 * "listing type" to exist — that's purely an app-level rendering convention.
 * publicData.listingType here is just an opaque tag this admin code uses to
 * find its own records via pub_listingType.
 *
 * Revoking a code closes the listing (mirrors how every other entity in this
 * app already represents an inactive state) instead of deleting it, so past
 * redemptions stay attributable.
 */

const INVITE_CODE_LISTING_TYPE = 'invite-code';
exports.INVITE_CODE_LISTING_TYPE = INVITE_CODE_LISTING_TYPE;

// Excludes visually ambiguous characters (0/O, 1/I) since these are meant to
// be read aloud or typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const randomCode = () => {
  let suffix = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `CGC-${suffix}`;
};
exports.randomCode = randomCode;

const adminInvitesError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.statusText = message;
  error.data = {};
  return error;
};
exports.adminInvitesError = adminInvitesError;

/**
 * @param {Object} listing - Integration API listing resource
 * @returns {Object}
 */
const serializeInviteCode = listing => {
  const publicData = listing.attributes.publicData || {};
  return {
    id: listing.id.uuid,
    code: publicData.code,
    note: publicData.note || null,
    maxUses: publicData.maxUses,
    usedCount: publicData.usedCount || 0,
    expiresAt: publicData.expiresAt || null,
    revoked: listing.attributes.state !== 'published',
    createdAt: listing.attributes.createdAt,
  };
};
exports.serializeInviteCode = serializeInviteCode;

/**
 * @param {Object} body - req.body for POST /api/admin/invites
 * @returns {{note: string, maxUses: number, expiresAt: string|null}}
 */
exports.validateCreateInviteCodeBody = body => {
  const { note, maxUses, expiresAt } = body || {};
  const parsedMaxUses = Number.parseInt(maxUses, 10);
  if (!Number.isInteger(parsedMaxUses) || parsedMaxUses < 1) {
    throw adminInvitesError(400, 'maxUses must be a positive integer.');
  }
  if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
    throw adminInvitesError(400, 'expiresAt must be a valid date.');
  }
  return {
    note: typeof note === 'string' ? note.trim() : '',
    maxUses: parsedMaxUses,
    expiresAt: expiresAt || null,
  };
};

/**
 * @param {Object} body - req.body for POST /api/admin/invites/revoke
 * @returns {{listingId: string}}
 */
exports.validateRevokeInviteCodeBody = body => {
  const { listingId } = body || {};
  if (typeof listingId !== 'string' || !listingId.trim()) {
    throw adminInvitesError(400, 'Missing listingId.');
  }
  return { listingId: listingId.trim() };
};

/**
 * Finds the invite-code listing for a code, or null. Shared by the admin
 * invites endpoints (checking for collisions) and the /apply flow
 * (server/api/applications.js, checking whether a submitted code redeems).
 *
 * @param {Object} integrationSdk
 * @param {string} code
 * @returns {Promise<Object|null>}
 */
const findInviteCodeListing = (integrationSdk, code) =>
  integrationSdk.listings
    .query({ pub_listingType: INVITE_CODE_LISTING_TYPE, pub_code: code })
    .then(response => response.data.data[0] || null);
exports.findInviteCodeListing = findInviteCodeListing;

/**
 * Increments a code's usedCount by one. publicData updates are a shallow
 * top-level merge, so this never touches the code/note/maxUses/expiresAt
 * fields sitting alongside it.
 *
 * @param {Object} integrationSdk
 * @param {Object} listing - the invite-code listing being redeemed
 * @returns {Promise}
 */
const redeemInviteCode = (integrationSdk, listing) => {
  const usedCount = (listing.attributes.publicData?.usedCount || 0) + 1;
  return integrationSdk.listings.update({ id: listing.id, publicData: { usedCount } });
};
exports.redeemInviteCode = redeemInviteCode;

/**
 * Whether a fetched invite-code listing can still be redeemed right now.
 * Used by the /apply flow (server/api-util/applications.js), NOT by the
 * admin queue — the queue shows revoked/exhausted/expired codes too, for
 * the record.
 *
 * @param {Object} listing - Integration API listing resource
 * @returns {boolean}
 */
const isUsableInviteCode = listing => {
  if (!listing || listing.attributes.state !== 'published') {
    return false;
  }
  const { maxUses, usedCount = 0, expiresAt } = listing.attributes.publicData || {};
  if (Number.isFinite(maxUses) && usedCount >= maxUses) {
    return false;
  }
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return false;
  }
  return true;
};
exports.isUsableInviteCode = isUsableInviteCode;
