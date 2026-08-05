/**
 * Network health metrics (IMPLEMENTATION-PLAN.md F5.3): brand:creator ratio,
 * projects without applicants, creators without a project, and
 * collaborations approaching their content due date.
 *
 * Kept as pure functions over already-fetched arrays (server/api/admin/
 * health.js does the actual Integration API fetching) so the aggregation
 * logic itself is unit-testable without live credentials.
 */

const PROJECT_LISTING_TYPE = 'project';
exports.PROJECT_LISTING_TYPE = PROJECT_LISTING_TYPE;

const CREATOR_PROFILE_LISTING_TYPE = 'creator-profile';
exports.CREATOR_PROFILE_LISTING_TYPE = CREATOR_PROFILE_LISTING_TYPE;

const CGC_APPLICATION_PROCESS_NAME = 'cgc-application';
exports.CGC_APPLICATION_PROCESS_NAME = CGC_APPLICATION_PROCESS_NAME;

const CGC_UGC_PROCESS_NAME = 'cgc-ugc-approval';
exports.CGC_UGC_PROCESS_NAME = CGC_UGC_PROCESS_NAME;

// Non-terminal, non-disputed states — mirrors `states` in
// src/transactions/transactionProcessCGCUGC.js. Disputed collaborations are
// excluded since they already have their own dedicated admin view. Keep in
// sync if process.edn changes (same caveat server/api/delete-account.js's
// own hardcoded state lists already carry).
const ACTIVE_UGC_STATES = [
  'state/purchased',
  'state/shipped',
  'state/product-received',
  'state/content-submitted',
  'state/revision-requested-1',
  'state/content-submitted-revised-1',
  'state/revision-requested-2',
  'state/content-submitted-revised-2',
];
exports.ACTIVE_UGC_STATES = ACTIVE_UGC_STATES;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {Array<Object>} users - Integration API user resources
 * @returns {{brand: number, creator: number}}
 */
exports.countUsersByType = users => {
  return (users || []).reduce(
    (acc, user) => {
      if (user?.attributes?.state !== 'active') {
        return acc;
      }
      const userType = user?.attributes?.profile?.publicData?.userType;
      if (userType === 'brand' || userType === 'creator') {
        acc[userType] += 1;
      }
      return acc;
    },
    { brand: 0, creator: 0 }
  );
};

/**
 * @param {Array<Object>} projectListings - published `project` listings
 * @param {Array<Object>} applicationTransactions - cgc-application
 *   transactions, each with relationships.listing.data.id.uuid
 * @returns {Array<{id: string, title: string}>}
 */
exports.projectsWithoutApplicants = (projectListings, applicationTransactions) => {
  const projectIdsWithApplicants = new Set(
    (applicationTransactions || [])
      .map(tx => tx.relationships?.listing?.data?.id?.uuid)
      .filter(Boolean)
  );
  return (projectListings || [])
    .filter(listing => !projectIdsWithApplicants.has(listing.id.uuid))
    .map(listing => ({ id: listing.id.uuid, title: listing.attributes.title }));
};

/**
 * @param {Array<Object>} creatorProfileListings - published `creator-profile`
 *   listings, each with relationships.author.data.id.uuid
 * @param {Array<Object>} applicationTransactions - cgc-application
 *   transactions, each with relationships.customer.data.id.uuid
 * @param {Object} authorsById - { [uuid]: user resource }, so the creator's
 *   real display name is used rather than their package listing's title
 * @returns {Array<{id: string, displayName: string}>}
 */
exports.creatorsWithoutProjects = (creatorProfileListings, applicationTransactions, authorsById = {}) => {
  const creatorIdsWithApplications = new Set(
    (applicationTransactions || [])
      .map(tx => tx.relationships?.customer?.data?.id?.uuid)
      .filter(Boolean)
  );
  return (creatorProfileListings || [])
    .filter(listing => {
      const authorId = listing.relationships?.author?.data?.id?.uuid;
      return authorId && !creatorIdsWithApplications.has(authorId);
    })
    .map(listing => {
      const authorId = listing.relationships.author.data.id.uuid;
      return {
        id: authorId,
        displayName: authorsById[authorId]?.attributes?.profile?.displayName || null,
      };
    });
};

/**
 * @param {Array<Object>} activeTransactions - cgc-ugc-approval transactions
 *   in ACTIVE_UGC_STATES, each with protectedData.projectId
 * @param {Object} projectListingsById - { [uuid]: listing } for every
 *   distinct projectId referenced
 * @param {Object} [options]
 * @param {number} [options.withinDays] - default 3
 * @param {Date} [options.now] - injectable for tests
 * @returns {Array<{id: string, listingTitle: string, dueDate: string, daysRemaining: number}>}
 *   daysRemaining is negative when already overdue. Sorted soonest first.
 */
exports.collaborationsNearingDeadline = (activeTransactions, projectListingsById, options = {}) => {
  const { withinDays = 3, now = new Date() } = options;

  return (activeTransactions || [])
    .map(tx => {
      const projectId = tx.attributes?.protectedData?.projectId;
      const project = projectId ? projectListingsById?.[projectId] : null;
      const dueDate = project?.attributes?.publicData?.contentDueDate;
      if (!dueDate) {
        return null;
      }
      const daysRemaining = Math.ceil((new Date(dueDate).getTime() - now.getTime()) / MS_PER_DAY);
      return daysRemaining <= withinDays
        ? {
            id: tx.id.uuid,
            listingTitle: project.attributes.title,
            dueDate,
            daysRemaining,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
};
