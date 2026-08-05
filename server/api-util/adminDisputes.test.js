const {
  validateResolveBody,
  serializeDisputedTransaction,
  indexIncluded,
} = require('./adminDisputes');

describe('validateResolveBody', () => {
  it('accepts a valid payCreator resolution', () => {
    expect(validateResolveBody({ transactionId: 'tx-1', resolution: 'payCreator' })).toEqual({
      transactionId: 'tx-1',
      resolution: 'payCreator',
    });
  });

  it('accepts a valid refundBrand resolution', () => {
    expect(validateResolveBody({ transactionId: 'tx-1', resolution: 'refundBrand' })).toEqual({
      transactionId: 'tx-1',
      resolution: 'refundBrand',
    });
  });

  it('rejects an unknown resolution', () => {
    expect(() => validateResolveBody({ transactionId: 'tx-1', resolution: 'shrug' })).toThrow(
      'Unknown resolution: shrug'
    );
  });

  it('rejects a missing transactionId', () => {
    expect(() => validateResolveBody({ resolution: 'payCreator' })).toThrow(
      'Missing transactionId.'
    );
  });
});

describe('indexIncluded', () => {
  it('groups entities by type and id', () => {
    const included = [
      { type: 'user', id: { uuid: 'u1' }, attributes: { profile: { displayName: 'Jamie' } } },
      { type: 'listing', id: { uuid: 'l1' }, attributes: { title: 'Test project' } },
    ];
    const result = indexIncluded(included);
    expect(result.user.u1.attributes.profile.displayName).toBe('Jamie');
    expect(result.listing.l1.attributes.title).toBe('Test project');
  });

  it('returns an empty object for no included entities', () => {
    expect(indexIncluded([])).toEqual({});
    expect(indexIncluded(undefined)).toEqual({});
  });
});

describe('serializeDisputedTransaction', () => {
  const buildTx = () => ({
    id: { uuid: 'tx-1' },
    attributes: {
      payinTotal: { amount: 5000, currency: 'USD' },
      transitions: [
        { transition: 'transition/request-payment', createdAt: '2026-01-01T00:00:00.000Z' },
        { transition: 'transition/confirm-payment', createdAt: '2026-01-02T00:00:00.000Z' },
        { transition: 'transition/submit-content', createdAt: '2026-01-05T00:00:00.000Z' },
        { transition: 'transition/dispute', createdAt: '2026-01-06T00:00:00.000Z' },
      ],
    },
    relationships: {
      customer: { data: { id: { uuid: 'customer-1' } } },
      provider: { data: { id: { uuid: 'provider-1' } } },
      listing: { data: { id: { uuid: 'listing-1' } } },
    },
  });

  const buildEntities = () =>
    indexIncluded([
      {
        type: 'user',
        id: { uuid: 'customer-1' },
        attributes: { profile: { displayName: 'Acme Brand' } },
      },
      {
        type: 'user',
        id: { uuid: 'provider-1' },
        attributes: { profile: { displayName: 'Jamie Creator' } },
      },
      { type: 'listing', id: { uuid: 'listing-1' }, attributes: { title: 'Summer campaign' } },
    ]);

  it('resolves customer, provider, and listing names', () => {
    const result = serializeDisputedTransaction(buildTx(), buildEntities());
    expect(result.customerName).toBe('Acme Brand');
    expect(result.providerName).toBe('Jamie Creator');
    expect(result.listingTitle).toBe('Summer campaign');
  });

  it('surfaces the price', () => {
    const result = serializeDisputedTransaction(buildTx(), buildEntities());
    expect(result.priceAmount).toBe(5000);
    expect(result.priceCurrency).toBe('USD');
  });

  it('finds the disputedAt timestamp from the transition history', () => {
    const result = serializeDisputedTransaction(buildTx(), buildEntities());
    expect(result.disputedAt).toBe('2026-01-06T00:00:00.000Z');
  });

  it('carries the full transition history through', () => {
    const result = serializeDisputedTransaction(buildTx(), buildEntities());
    expect(result.transitions).toHaveLength(4);
  });

  it('handles missing related entities gracefully', () => {
    const result = serializeDisputedTransaction(buildTx(), {});
    expect(result.customerName).toBeNull();
    expect(result.providerName).toBeNull();
    expect(result.listingTitle).toBeNull();
  });
});
