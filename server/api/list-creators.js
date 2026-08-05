const { getIntegrationSdk } = require('../api-util/integrationSdk');
const { handleError, serialize } = require('../api-util/sdk');

const PER_PAGE = 100;
const CREATOR_USER_TYPE = 'creator';
const CREATOR_PROFILE_LISTING_TYPE = 'creator-profile';
const PUBLISHED_STATE = 'published';

// Lists creator (provider) user accounts directly, rather than via a listing
// search — the regular Marketplace SDK can only query listings, so this uses
// the Integration API (separate app credentials, see api-util/integrationSdk.js)
// to page through users and keep the ones with userType "provider".
//
// This intentionally fetches all users and filters in code: the Integration
// API's users.query does not support filtering by profile publicData the way
// listings.query does with pub_* params, so there's no server-side shortcut.
module.exports = (req, res) => {
  let integrationSdk;
  try {
    integrationSdk = getIntegrationSdk();
  } catch (e) {
    return handleError(res, e);
  }

  const fetchAllPages = (queryFn, extractItems) => {
    const fetchPage = (page, accumulated) => {
      return queryFn(page).then(response => {
        const { data, included = [], meta } = response.data;
        const items = extractItems ? extractItems(data) : data;
        const combined = accumulated.items.concat(items);
        const combinedIncluded = accumulated.included.concat(included);

        const hasMorePages = meta && page < meta.totalPages;
        return hasMorePages
          ? fetchPage(page + 1, { items: combined, included: combinedIncluded })
          : { items: combined, included: combinedIncluded };
      });
    };
    return fetchPage(1, { items: [], included: [] });
  };

  const fetchUsers = fetchAllPages(page =>
    integrationSdk.users.query({
      page,
      perPage: PER_PAGE,
      include: ['profileImage'],
      // Sparse fieldsets: image variant URLs are only returned for variants
      // explicitly requested here — without this, the included profileImage
      // comes back with no usable variants and every avatar/thumbnail falls
      // back to "no image", even for creators who did upload a photo.
      'fields.image': ['variants.square-small', 'variants.square-small2x'],
    })
  );

  // Every listing, so each creator card can link straight to the listing
  // "Collab" needs as its inquiry target. Filtered in code rather than via
  // query params (same reasoning as the users query above — safer than
  // guessing at Integration API filter support) down to published
  // creator-profile listings only; a creator with no published listing yet
  // has nothing to link to, so the frontend disables the button in that
  // case instead of linking to a broken page.
  const fetchCreatorProfileListings = fetchAllPages(page =>
    // include: ['author'] is required for relationships.author.data to be
    // populated at all on the Integration API — without it every listing's
    // `relationships` comes back empty, so listingByAuthorId below would
    // never match anyone and every creator's listingId would be null.
    integrationSdk.listings.query({ page, perPage: PER_PAGE, include: ['author'] })
  );

  Promise.all([fetchUsers, fetchCreatorProfileListings])
    .then(([{ items: users, included }, { items: allListings }]) => {
      const profileImagesById = included
        .filter(res => res.type === 'image')
        .reduce((acc, image) => ({ ...acc, [image.id.uuid]: image }), {});

      const listings = allListings.filter(
        listing =>
          listing.attributes?.publicData?.listingType === CREATOR_PROFILE_LISTING_TYPE &&
          listing.attributes?.state === PUBLISHED_STATE
      );

      // First published listing per author wins — a creator is only
      // expected to have one live creator-profile listing at a time.
      const listingByAuthorId = listings.reduce((acc, listing) => {
        const authorId = listing.relationships?.author?.data?.id?.uuid;
        return authorId && !acc[authorId] ? { ...acc, [authorId]: listing } : acc;
      }, {});

      const creators = users
        .filter(user => user.attributes?.profile?.publicData?.userType === CREATOR_USER_TYPE)
        .map(user => {
          const profileImageRef = user.relationships?.profileImage?.data;
          const profileImage = profileImageRef ? profileImagesById[profileImageRef.id.uuid] : null;
          const listing = listingByAuthorId[user.id.uuid] || null;
          const listingPublicData = listing?.attributes?.publicData || {};

          return {
            id: user.id,
            displayName: user.attributes?.profile?.displayName || null,
            profileImage,
            listingId: listing?.id || null,
            // Used by ProjectInvitePage (F2.5) to suggest creators whose
            // niche/platforms match a project, and by ExploreCreatorsPage to
            // show the same tags shown elsewhere for a creator's listing.
            contentNiche: listingPublicData.contentNiche || [],
            platforms: listingPublicData.platforms || [],
          };
        });

      res
        .status(200)
        .set('Content-Type', 'application/transit+json')
        .send(serialize({ creators }))
        .end();
    })
    .catch(e => handleError(res, e));
};
