const { types } = require('sharetribe-flex-sdk');
const { Money } = types;

jest.mock('./integrationSdk');
const { getIntegrationSdk } = require('./integrationSdk');

const {
  isApplicationOfferTransition,
  isCGCCollaborationCheckout,
  isMarkCollaboratingTransition,
  assertNoExistingApplication,
  buildApplicationOfferMetadata,
  buildMarkCollaboratingProtectedData,
  fetchAgreedPriceMoney,
  fetchProjectDeliverables,
} = require('./cgcCheckout');

const APPLICATION_ID = { uuid: 'application-tx-1' };
const CREATOR_LISTING_ID = 'creator-listing-1';
const PROJECT_ID = 'project-listing-1';
const COLLABORATION_TX_ID = { uuid: 'collaboration-tx-1' };
const BRAND_USER_ID = { uuid: 'brand-user-1' };
const OTHER_USER_ID = { uuid: 'someone-else' };

const buildApplicationTxResponse = (overrides = {}) => {
  const {
    processName = 'cgc-application',
    lastTransition = 'transition/brand-accept',
    providerId = BRAND_USER_ID,
    creatorListingId = CREATOR_LISTING_ID,
    projectId = PROJECT_ID,
    collaborationTxId = null,
    offers = [{ by: 'customer', amountInSubunits: 40000, transition: 'transition/apply', at: 't1' }],
    transitions = [{ transition: 'transition/apply', by: 'customer', createdAt: 't1' }],
  } = overrides;

  return {
    data: {
      data: {
        id: APPLICATION_ID,
        attributes: {
          processName,
          lastTransition,
          protectedData: {
            creatorListingId,
            projectId,
            ...(collaborationTxId ? { collaborationTxId } : {}),
          },
          metadata: { offers },
          transitions,
        },
        relationships: {
          provider: { data: { type: 'user', id: providerId } },
        },
      },
      included: [{ type: 'user', id: providerId }],
    },
  };
};

describe('cgcCheckout', () => {
  describe('isApplicationOfferTransition', () => {
    it('is true for apply and brand-counter', () => {
      expect(isApplicationOfferTransition('transition/apply')).toBe(true);
      expect(isApplicationOfferTransition('transition/brand-counter')).toBe(true);
    });
    it('is false for anything else', () => {
      expect(isApplicationOfferTransition('transition/brand-accept')).toBe(false);
      expect(isApplicationOfferTransition('transition/request-payment')).toBe(false);
    });
  });

  describe('isCGCCollaborationCheckout', () => {
    it('is true for request-payment / request-payment-after-inquiry on a creator-profile listing', () => {
      expect(
        isCGCCollaborationCheckout('transition/request-payment', { listingType: 'creator-profile' })
      ).toBe(true);
      expect(
        isCGCCollaborationCheckout('transition/request-payment-after-inquiry', {
          listingType: 'creator-profile',
        })
      ).toBe(true);
    });

    it('is false on any other listing type', () => {
      expect(
        isCGCCollaborationCheckout('transition/request-payment', { listingType: 'project' })
      ).toBe(false);
    });

    it('is false for an unrelated transition, even on a creator-profile listing', () => {
      expect(
        isCGCCollaborationCheckout('transition/mark-shipped', { listingType: 'creator-profile' })
      ).toBe(false);
    });
  });

  describe('buildApplicationOfferMetadata', () => {
    it('apply without a proposed price uses the project listing price', () => {
      const result = buildApplicationOfferMetadata({
        orderData: {},
        transitionName: 'transition/apply',
        existingMetadata: {},
        listedPriceInSubunits: 40000,
      });
      expect(result.metadata.offers).toEqual([
        expect.objectContaining({
          by: 'customer',
          amountInSubunits: 40000,
          transition: 'transition/apply',
        }),
      ]);
    });

    it('apply with a proposed price uses that instead of the listed price', () => {
      const result = buildApplicationOfferMetadata({
        orderData: { proposedPriceInSubunits: 55000 },
        transitionName: 'transition/apply',
        existingMetadata: {},
        listedPriceInSubunits: 40000,
      });
      expect(result.metadata.offers[0].amountInSubunits).toBe(55000);
    });

    it('brand-counter requires an explicit amount — no default from listing price', () => {
      expect(() =>
        buildApplicationOfferMetadata({
          orderData: {},
          transitionName: 'transition/brand-counter',
          existingMetadata: { offers: [{ by: 'customer', amountInSubunits: 55000, transition: 'transition/apply' }] },
          listedPriceInSubunits: 40000,
        })
      ).toThrow();
    });

    it('brand-counter with an amount appends a second offer', () => {
      const existingMetadata = {
        offers: [{ by: 'customer', amountInSubunits: 55000, transition: 'transition/apply', at: 't1' }],
      };
      const result = buildApplicationOfferMetadata({
        orderData: { proposedPriceInSubunits: 47500 },
        transitionName: 'transition/brand-counter',
        existingMetadata,
      });
      expect(result.metadata.offers).toHaveLength(2);
      expect(result.metadata.offers[1]).toEqual(
        expect.objectContaining({
          by: 'provider',
          amountInSubunits: 47500,
          transition: 'transition/brand-counter',
        })
      );
    });

    it('rejects a zero, negative, or non-integer proposed amount', () => {
      const attempt = amount =>
        buildApplicationOfferMetadata({
          orderData: { proposedPriceInSubunits: amount },
          transitionName: 'transition/apply',
          existingMetadata: {},
          listedPriceInSubunits: 40000,
        });
      expect(() => attempt(0)).toThrow();
      expect(() => attempt(-500)).toThrow();
      expect(() => attempt(100.5)).toThrow();
    });

    it('rejects apply when neither a proposed amount nor a listed price is available', () => {
      expect(() =>
        buildApplicationOfferMetadata({
          orderData: {},
          transitionName: 'transition/apply',
          existingMetadata: {},
          listedPriceInSubunits: undefined,
        })
      ).toThrow();
    });

    it('rejects when the negotiation cap (2 offers) is already reached', () => {
      const existingMetadata = {
        offers: [
          { by: 'customer', amountInSubunits: 55000, transition: 'transition/apply', at: 't1' },
          { by: 'provider', amountInSubunits: 47500, transition: 'transition/brand-counter', at: 't2' },
        ],
      };
      expect(() =>
        buildApplicationOfferMetadata({
          orderData: { proposedPriceInSubunits: 50000 },
          transitionName: 'transition/brand-counter',
          existingMetadata,
        })
      ).toThrow();
    });

    it('rejects an unknown transition name', () => {
      expect(() =>
        buildApplicationOfferMetadata({
          orderData: { proposedPriceInSubunits: 1000 },
          transitionName: 'transition/brand-accept',
          existingMetadata: {},
        })
      ).toThrow();
    });
  });

  describe('assertNoExistingApplication', () => {
    const setupSdk = txs => ({
      transactions: { query: jest.fn().mockResolvedValue({ data: { data: txs } }) },
    });

    it('resolves when the creator has no application for this project', async () => {
      const sdk = setupSdk([
        { attributes: { protectedData: { projectId: 'other-project' } } },
      ]);
      await expect(
        assertNoExistingApplication({ sdk, projectId: 'project-1' })
      ).resolves.toBeUndefined();
    });

    it('resolves when the creator has no applications at all', async () => {
      const sdk = setupSdk([]);
      await expect(
        assertNoExistingApplication({ sdk, projectId: 'project-1' })
      ).resolves.toBeUndefined();
    });

    it('rejects with a readable message when an application for this project already exists', async () => {
      const sdk = setupSdk([
        { attributes: { protectedData: { projectId: 'project-1' } } },
      ]);
      await expect(
        assertNoExistingApplication({ sdk, projectId: 'project-1' })
      ).rejects.toThrow(/already applied/);
    });

    it('scopes the query to the current user\'s own orders on cgc-application', async () => {
      const sdk = setupSdk([]);
      await assertNoExistingApplication({ sdk, projectId: 'project-1' });
      expect(sdk.transactions.query).toHaveBeenCalledWith(
        expect.objectContaining({ only: 'order', processNames: ['cgc-application'] })
      );
    });
  });

  describe('fetchAgreedPriceMoney', () => {
    const listing = { id: { uuid: CREATOR_LISTING_ID } };

    beforeEach(() => {
      getIntegrationSdk.mockReset();
    });

    const setupSdk = txResponse => {
      const show = jest.fn().mockResolvedValue(txResponse);
      getIntegrationSdk.mockReturnValue({ transactions: { show } });
      return show;
    };

    it('rejects when applicationId is missing — never falls back to the listing price silently', async () => {
      await expect(
        fetchAgreedPriceMoney({
          applicationId: null,
          listing,
          currentUserId: BRAND_USER_ID,
          currency: 'USD',
          Money,
        })
      ).rejects.toThrow(/Missing applicationId/);
    });

    it('resolves the agreed price as Money, plus the project id, when everything checks out', async () => {
      setupSdk(buildApplicationTxResponse());
      const result = await fetchAgreedPriceMoney({
        applicationId: 'application-tx-1',
        listing,
        currentUserId: BRAND_USER_ID,
        currency: 'USD',
        Money,
      });
      expect(result).toEqual({
        agreedPriceMoney: new Money(40000, 'USD'),
        projectId: PROJECT_ID,
      });
    });

    it('uses the last offer (brand counter) as the agreed price when one exists', async () => {
      setupSdk(
        buildApplicationTxResponse({
          offers: [
            { by: 'customer', amountInSubunits: 55000, transition: 'transition/apply', at: 't1' },
            { by: 'provider', amountInSubunits: 47500, transition: 'transition/brand-counter', at: 't2' },
          ],
          transitions: [
            { transition: 'transition/apply', by: 'customer', createdAt: 't1' },
            { transition: 'transition/brand-counter', by: 'provider', createdAt: 't2' },
            { transition: 'transition/creator-accept-counter', by: 'customer', createdAt: 't3' },
          ],
          lastTransition: 'transition/creator-accept-counter',
        })
      );
      const result = await fetchAgreedPriceMoney({
        applicationId: 'application-tx-1',
        listing,
        currentUserId: BRAND_USER_ID,
        currency: 'USD',
        Money,
      });
      expect(result.agreedPriceMoney).toEqual(new Money(47500, 'USD'));
    });

    it('rejects a transaction that is not from the cgc-application process', async () => {
      setupSdk(buildApplicationTxResponse({ processName: 'default-inquiry' }));
      await expect(
        fetchAgreedPriceMoney({
          applicationId: 'application-tx-1',
          listing,
          currentUserId: BRAND_USER_ID,
          currency: 'USD',
          Money,
        })
      ).rejects.toThrow(/cgc-application transaction/);
    });

    it('rejects an application that has not been accepted yet', async () => {
      setupSdk(buildApplicationTxResponse({ lastTransition: 'transition/apply' }));
      await expect(
        fetchAgreedPriceMoney({
          applicationId: 'application-tx-1',
          listing,
          currentUserId: BRAND_USER_ID,
          currency: 'USD',
          Money,
        })
      ).rejects.toThrow(/not been accepted/);
    });

    it("rejects when the application doesn't belong to the checking-out user", async () => {
      setupSdk(buildApplicationTxResponse());
      await expect(
        fetchAgreedPriceMoney({
          applicationId: 'application-tx-1',
          listing,
          currentUserId: OTHER_USER_ID,
          currency: 'USD',
          Money,
        })
      ).rejects.toThrow(/does not belong/);
    });

    it('rejects when the creatorListingId does not match the listing being checked out', async () => {
      setupSdk(buildApplicationTxResponse({ creatorListingId: 'a-different-listing' }));
      await expect(
        fetchAgreedPriceMoney({
          applicationId: 'application-tx-1',
          listing,
          currentUserId: BRAND_USER_ID,
          currency: 'USD',
          Money,
        })
      ).rejects.toThrow(/creatorListingId/);
    });

    it('rejects an application that has already been used for a collaboration', async () => {
      setupSdk(buildApplicationTxResponse({ collaborationTxId: 'already-used-tx' }));
      await expect(
        fetchAgreedPriceMoney({
          applicationId: 'application-tx-1',
          listing,
          currentUserId: BRAND_USER_ID,
          currency: 'USD',
          Money,
        })
      ).rejects.toThrow(/already been used/);
    });

    it('rejects when the offer history is internally inconsistent (tampering)', async () => {
      setupSdk(
        buildApplicationTxResponse({
          // Claims a brand-counter offer exists, but the transition history
          // only shows a plain `apply`.
          offers: [
            { by: 'customer', amountInSubunits: 55000, transition: 'transition/apply', at: 't1' },
            { by: 'provider', amountInSubunits: 1, transition: 'transition/brand-counter', at: 't2' },
          ],
          transitions: [{ transition: 'transition/apply', by: 'customer', createdAt: 't1' }],
        })
      );
      await expect(
        fetchAgreedPriceMoney({
          applicationId: 'application-tx-1',
          listing,
          currentUserId: BRAND_USER_ID,
          currency: 'USD',
          Money,
        })
      ).rejects.toThrow(/offer history/);
    });
  });

  describe('isMarkCollaboratingTransition', () => {
    it('is true only for transition/mark-collaborating', () => {
      expect(isMarkCollaboratingTransition('transition/mark-collaborating')).toBe(true);
      expect(isMarkCollaboratingTransition('transition/brand-accept')).toBe(false);
      expect(isMarkCollaboratingTransition('transition/request-payment')).toBe(false);
    });
  });

  describe('buildMarkCollaboratingProtectedData', () => {
    const applicationTx = (protectedDataOverrides = {}) => ({
      attributes: {
        protectedData: { creatorListingId: CREATOR_LISTING_ID, ...protectedDataOverrides },
      },
    });

    const buildCollaborationTxResponse = (overrides = {}) => {
      const {
        processName = 'cgc-ugc-approval',
        lastTransition = 'transition/confirm-payment',
        customerId = BRAND_USER_ID,
        listingId = CREATOR_LISTING_ID,
      } = overrides;
      return {
        data: {
          data: {
            id: COLLABORATION_TX_ID,
            attributes: { processName, lastTransition },
            relationships: {
              customer: { data: { type: 'user', id: customerId } },
              listing: { data: { type: 'listing', id: { uuid: listingId } } },
            },
          },
          included: [{ type: 'user', id: customerId }],
        },
      };
    };

    beforeEach(() => {
      getIntegrationSdk.mockReset();
    });

    const setupSdk = txResponse => {
      const show = jest.fn().mockResolvedValue(txResponse);
      getIntegrationSdk.mockReturnValue({ transactions: { show } });
      return show;
    };

    it('rejects when collaborationTxId is missing', async () => {
      await expect(
        buildMarkCollaboratingProtectedData({
          orderData: {},
          applicationTx: applicationTx(),
          currentUserId: BRAND_USER_ID,
        })
      ).rejects.toThrow(/Missing collaborationTxId/);
    });

    it('rejects when the application is already linked to a collaboration', async () => {
      await expect(
        buildMarkCollaboratingProtectedData({
          orderData: { collaborationTxId: COLLABORATION_TX_ID },
          applicationTx: applicationTx({ collaborationTxId: 'already-linked-tx' }),
          currentUserId: BRAND_USER_ID,
        })
      ).rejects.toThrow(/already been linked/);
    });

    it('resolves the protectedData write when everything checks out', async () => {
      setupSdk(buildCollaborationTxResponse());
      const result = await buildMarkCollaboratingProtectedData({
        orderData: { collaborationTxId: COLLABORATION_TX_ID },
        applicationTx: applicationTx(),
        currentUserId: BRAND_USER_ID,
      });
      expect(result).toEqual({ protectedData: { collaborationTxId: COLLABORATION_TX_ID.uuid } });
    });

    it('rejects a transaction that is not from the cgc-ugc-approval process', async () => {
      setupSdk(buildCollaborationTxResponse({ processName: 'cgc-application' }));
      await expect(
        buildMarkCollaboratingProtectedData({
          orderData: { collaborationTxId: COLLABORATION_TX_ID },
          applicationTx: applicationTx(),
          currentUserId: BRAND_USER_ID,
        })
      ).rejects.toThrow(/cgc-ugc-approval transaction/);
    });

    it('rejects a collaboration transaction that has not been paid yet', async () => {
      setupSdk(buildCollaborationTxResponse({ lastTransition: 'transition/request-payment' }));
      await expect(
        buildMarkCollaboratingProtectedData({
          orderData: { collaborationTxId: COLLABORATION_TX_ID },
          applicationTx: applicationTx(),
          currentUserId: BRAND_USER_ID,
        })
      ).rejects.toThrow(/not been paid/);
    });

    it("rejects when the collaboration doesn't belong to the current user", async () => {
      setupSdk(buildCollaborationTxResponse({ customerId: OTHER_USER_ID }));
      await expect(
        buildMarkCollaboratingProtectedData({
          orderData: { collaborationTxId: COLLABORATION_TX_ID },
          applicationTx: applicationTx(),
          currentUserId: BRAND_USER_ID,
        })
      ).rejects.toThrow(/does not belong/);
    });

    it("rejects when the collaboration's listing does not match the application", async () => {
      setupSdk(buildCollaborationTxResponse({ listingId: 'a-different-listing' }));
      await expect(
        buildMarkCollaboratingProtectedData({
          orderData: { collaborationTxId: COLLABORATION_TX_ID },
          applicationTx: applicationTx(),
          currentUserId: BRAND_USER_ID,
        })
      ).rejects.toThrow(/does not match/);
    });
  });

  describe('fetchProjectDeliverables', () => {
    beforeEach(() => {
      getIntegrationSdk.mockReset();
    });

    it('resolves [] without calling the SDK when projectId is missing', async () => {
      const result = await fetchProjectDeliverables({ projectId: null });
      expect(result).toEqual([]);
      expect(getIntegrationSdk).not.toHaveBeenCalled();
    });

    it("seeds each of the project's deliverables with an empty versions array", async () => {
      const show = jest.fn().mockResolvedValue({
        data: {
          data: {
            attributes: {
              publicData: {
                deliverables: [
                  { id: 'd0', type: 'video', platform: 'tiktok', spec: '30s', quantity: 2 },
                  { id: 'd1', type: 'photo', platform: 'instagram-static', spec: 'square', quantity: 1 },
                ],
              },
            },
          },
        },
      });
      getIntegrationSdk.mockReturnValue({ listings: { show } });

      const result = await fetchProjectDeliverables({ projectId: PROJECT_ID });

      expect(show).toHaveBeenCalledWith({ id: PROJECT_ID });
      expect(result).toEqual([
        { id: 'd0', type: 'video', platform: 'tiktok', spec: '30s', quantity: 2, versions: [] },
        { id: 'd1', type: 'photo', platform: 'instagram-static', spec: 'square', quantity: 1, versions: [] },
      ]);
    });

    it('resolves [] when the project listing has no deliverables', async () => {
      const show = jest.fn().mockResolvedValue({ data: { data: { attributes: { publicData: {} } } } });
      getIntegrationSdk.mockReturnValue({ listings: { show } });

      const result = await fetchProjectDeliverables({ projectId: PROJECT_ID });
      expect(result).toEqual([]);
    });
  });
});
