import { types as sdkTypes } from '../../util/sdkLoader';
import { transitions as applicationTransitions } from '../../transactions/transactionProcessCGCApplication';
import { transitions as ugcTransitions } from '../../transactions/transactionProcessCGCUGC';
import { deriveProjectOverview } from './projectOverviewStats';

const { UUID } = sdkTypes;

const buildApplicant = ({ id, lastTransition }) => ({
  id: new UUID(id),
  attributes: {
    processName: 'cgc-application',
    lastTransition,
  },
});

const buildCollaboration = ({ id, lastTransition, providerId }) => ({
  id: new UUID(id),
  attributes: {
    processName: 'cgc-ugc-approval',
    lastTransition,
  },
  provider: { id: new UUID(providerId) },
  // requiresProduct lives on the PROJECT listing, not this creator-profile
  // listing (see campaignData.js's deriveCampaign) — deriveProjectOverview
  // is given the project listing separately via the projectListing param.
  listing: { attributes: { publicData: {} } },
});

const buildProjectListing = ({ requiresProduct = false } = {}) => ({
  attributes: { publicData: { requiresProduct } },
});

describe('deriveProjectOverview', () => {
  it('returns all zeros for a project with no applicants or collaborations', () => {
    expect(deriveProjectOverview({ applicants: [], collaborations: [] })).toEqual({
      awaitingApproval: 0,
      bookedCreators: 0,
      productsToShip: 0,
      videosToApprove: 0,
    });
  });

  it('counts only "applied" applications as awaiting approval, not countered/declined/accepted', () => {
    const applicants = [
      buildApplicant({ id: 'app-1', lastTransition: applicationTransitions.APPLY }),
      buildApplicant({ id: 'app-2', lastTransition: applicationTransitions.APPLY }),
      buildApplicant({ id: 'app-3', lastTransition: applicationTransitions.BRAND_COUNTER }),
      buildApplicant({ id: 'app-4', lastTransition: applicationTransitions.BRAND_DECLINE }),
      buildApplicant({ id: 'app-5', lastTransition: applicationTransitions.BRAND_ACCEPT }),
    ];

    const overview = deriveProjectOverview({ applicants, collaborations: [] });

    expect(overview.awaitingApproval).toBe(2);
  });

  it('counts purchased-and-not-yet-shipped orders as products to ship, on a requires-product project', () => {
    const collaborations = [
      buildCollaboration({
        id: 'tx-1',
        lastTransition: ugcTransitions.CONFIRM_PAYMENT,
        providerId: 'creator-1',
      }),
      // Already shipped — no longer "to ship".
      buildCollaboration({
        id: 'tx-3',
        lastTransition: ugcTransitions.MARK_SHIPPED,
        providerId: 'creator-3',
      }),
    ];

    const overview = deriveProjectOverview({
      applicants: [],
      collaborations,
      projectListing: buildProjectListing({ requiresProduct: true }),
    });

    expect(overview.productsToShip).toBe(1);
  });

  it("doesn't count purchased orders as products to ship on a project that doesn't require one", () => {
    const collaborations = [
      buildCollaboration({
        id: 'tx-1',
        lastTransition: ugcTransitions.CONFIRM_PAYMENT,
        providerId: 'creator-1',
      }),
    ];

    const overview = deriveProjectOverview({
      applicants: [],
      collaborations,
      projectListing: buildProjectListing({ requiresProduct: false }),
    });

    expect(overview.productsToShip).toBe(0);
  });

  it("counts collaborations whose state needs the brand's review as videos to approve", () => {
    const collaborations = [
      buildCollaboration({
        id: 'tx-1',
        lastTransition: ugcTransitions.SUBMIT_CONTENT,
        providerId: 'creator-1',
      }),
      // Shipped, but not yet submitted for review — shouldn't count.
      buildCollaboration({
        id: 'tx-2',
        lastTransition: ugcTransitions.MARK_SHIPPED,
        providerId: 'creator-2',
      }),
    ];

    const overview = deriveProjectOverview({ applicants: [], collaborations });

    expect(overview.videosToApprove).toBe(1);
  });

  it('counts booked creators as unique providers, not one per collaboration', () => {
    const collaborations = [
      buildCollaboration({
        id: 'tx-1',
        lastTransition: ugcTransitions.CONFIRM_PAYMENT,
        providerId: 'creator-1',
      }),
      // Same creator, a second deliverable/order on the same project.
      buildCollaboration({
        id: 'tx-2',
        lastTransition: ugcTransitions.MARK_SHIPPED,
        providerId: 'creator-1',
      }),
      buildCollaboration({
        id: 'tx-3',
        lastTransition: ugcTransitions.CONFIRM_PAYMENT,
        providerId: 'creator-2',
      }),
    ];

    const overview = deriveProjectOverview({ applicants: [], collaborations });

    expect(overview.bookedCreators).toBe(2);
  });
});
