/**
 * Network health dashboard for the operator console (IMPLEMENTATION-PLAN.md
 * F5.3): brand:creator ratio, projects without applicants, creators without
 * a project, and collaborations approaching their content due date.
 */
const { getIntegrationSdk } = require('../../api-util/integrationSdk');
const { handleError } = require('../../api-util/sdk');
const { assertOperator } = require('./index');
const { indexIncluded } = require('../../api-util/adminDisputes');
const {
  PROJECT_LISTING_TYPE,
  CREATOR_PROFILE_LISTING_TYPE,
  CGC_APPLICATION_PROCESS_NAME,
  CGC_UGC_PROCESS_NAME,
  ACTIVE_UGC_STATES,
  countUsersByType,
  projectsWithoutApplicants,
  creatorsWithoutProjects,
  collaborationsNearingDeadline,
} = require('../../api-util/adminHealth');

const PER_PAGE = 100;

const fetchAllPages = queryFn => {
  const fetchPage = (page, accumulated) =>
    queryFn(page).then(response => {
      const { data, included = [], meta } = response.data;
      const combined = {
        items: accumulated.items.concat(data),
        included: accumulated.included.concat(included),
      };
      const hasMorePages = meta && page < meta.totalPages;
      return hasMorePages ? fetchPage(page + 1, combined) : combined;
    });
  return fetchPage(1, { items: [], included: [] });
};

/**
 * GET /api/admin/health
 */
const listHealth = (req, res) => {
  assertOperator(req, res)
    .then(() => {
      const integrationSdk = getIntegrationSdk();

      const users = fetchAllPages(page => integrationSdk.users.query({ page, perPage: PER_PAGE }));
      const projectListings = fetchAllPages(page =>
        integrationSdk.listings.query({ pub_listingType: PROJECT_LISTING_TYPE, page, perPage: PER_PAGE })
      );
      const creatorProfileListings = fetchAllPages(page =>
        integrationSdk.listings.query({
          pub_listingType: CREATOR_PROFILE_LISTING_TYPE,
          page,
          perPage: PER_PAGE,
          include: ['author'],
        })
      );
      const applicationTransactions = fetchAllPages(page =>
        integrationSdk.transactions.query({
          processNames: CGC_APPLICATION_PROCESS_NAME,
          page,
          perPage: PER_PAGE,
        })
      );
      const activeCollaborations = fetchAllPages(page =>
        integrationSdk.transactions.query({
          processNames: CGC_UGC_PROCESS_NAME,
          states: ACTIVE_UGC_STATES.join(','),
          page,
          perPage: PER_PAGE,
        })
      );

      return Promise.all([
        users,
        projectListings,
        creatorProfileListings,
        applicationTransactions,
        activeCollaborations,
      ]);
    })
    .then(([usersResult, projectsResult, creatorProfilesResult, applicationsResult, collaborationsResult]) => {
      const publishedProjects = projectsResult.items.filter(l => l.attributes.state === 'published');
      const publishedCreatorProfiles = creatorProfilesResult.items.filter(
        l => l.attributes.state === 'published'
      );
      const projectListingsById = projectsResult.items.reduce((acc, l) => {
        acc[l.id.uuid] = l;
        return acc;
      }, {});
      const authorsById = indexIncluded(creatorProfilesResult.included).user || {};

      res.status(200).json({
        userCounts: countUsersByType(usersResult.items),
        projectsWithoutApplicants: projectsWithoutApplicants(
          publishedProjects,
          applicationsResult.items
        ),
        creatorsWithoutProjects: creatorsWithoutProjects(
          publishedCreatorProfiles,
          applicationsResult.items,
          authorsById
        ),
        collaborationsNearingDeadline: collaborationsNearingDeadline(
          collaborationsResult.items,
          projectListingsById
        ),
      });
    })
    .catch(e => handleError(res, e));
};

module.exports = { listHealth };
