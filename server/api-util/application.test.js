const {
  getOffers,
  getAgreedPriceInSubunits,
  canCounter,
  isValidOfferHistory,
} = require('./application');

const applyByCustomer = (amountInSubunits, at = '2026-08-02T10:00:00.000Z') => ({
  by: 'customer',
  amountInSubunits,
  transition: 'transition/apply',
  at,
});
const counterByProvider = (amountInSubunits, at = '2026-08-03T09:00:00.000Z') => ({
  by: 'provider',
  amountInSubunits,
  transition: 'transition/brand-counter',
  at,
});

const txEntry = (transition, by, createdAt) => ({ transition, by, createdAt });

describe('application utils (server copy)', () => {
  describe('getOffers / getAgreedPriceInSubunits', () => {
    it('returns null when there are no offers yet', () => {
      expect(getAgreedPriceInSubunits({})).toBeNull();
      expect(getAgreedPriceInSubunits({ offers: [] })).toBeNull();
      expect(getAgreedPriceInSubunits(null)).toBeNull();
      expect(getOffers(null)).toEqual([]);
    });

    it('returns the listed price when the creator applied as-is', () => {
      const metadata = { offers: [applyByCustomer(40000)] };
      expect(getAgreedPriceInSubunits(metadata)).toBe(40000);
    });

    it('returns the brand counter-offer amount once one exists, not the original', () => {
      const metadata = { offers: [applyByCustomer(55000), counterByProvider(47500)] };
      expect(getAgreedPriceInSubunits(metadata)).toBe(47500);
    });
  });

  describe('canCounter', () => {
    it('is true when the creator has made exactly one offer', () => {
      expect(canCounter({ offers: [applyByCustomer(55000)] })).toBe(true);
    });

    it('is false before any offer exists', () => {
      expect(canCounter({ offers: [] })).toBe(false);
      expect(canCounter({})).toBe(false);
    });

    it('is false once the brand has already countered (one round used)', () => {
      const metadata = { offers: [applyByCustomer(55000), counterByProvider(47500)] };
      expect(canCounter(metadata)).toBe(false);
    });
  });

  describe('isValidOfferHistory', () => {
    it('accepts a single creator offer matching a single apply transition', () => {
      const offers = [applyByCustomer(40000)];
      const txTransitions = [txEntry('transition/apply', 'customer', '2026-08-02T10:00:00.000Z')];
      expect(isValidOfferHistory(offers, txTransitions)).toBe(true);
    });

    it('accepts an apply followed by a brand counter', () => {
      const offers = [applyByCustomer(55000), counterByProvider(47500)];
      const txTransitions = [
        txEntry('transition/apply', 'customer', '2026-08-02T10:00:00.000Z'),
        txEntry('transition/brand-counter', 'provider', '2026-08-03T09:00:00.000Z'),
      ];
      expect(isValidOfferHistory(offers, txTransitions)).toBe(true);
    });

    it('ignores unrelated transitions in history (e.g. creator-accept-counter)', () => {
      const offers = [applyByCustomer(55000), counterByProvider(47500)];
      const txTransitions = [
        txEntry('transition/apply', 'customer', '2026-08-02T10:00:00.000Z'),
        txEntry('transition/brand-counter', 'provider', '2026-08-03T09:00:00.000Z'),
        txEntry('transition/creator-accept-counter', 'customer', '2026-08-04T09:00:00.000Z'),
      ];
      expect(isValidOfferHistory(offers, txTransitions)).toBe(true);
    });

    it('rejects an empty offers array', () => {
      expect(isValidOfferHistory([], [])).toBe(false);
      expect(isValidOfferHistory(null, [])).toBe(false);
    });

    it('rejects more than two offers, regardless of transition history', () => {
      const offers = [applyByCustomer(55000), counterByProvider(47500), applyByCustomer(60000)];
      const txTransitions = [
        txEntry('transition/apply', 'customer', '2026-08-02T10:00:00.000Z'),
        txEntry('transition/brand-counter', 'provider', '2026-08-03T09:00:00.000Z'),
      ];
      expect(isValidOfferHistory(offers, txTransitions)).toBe(false);
    });

    it('rejects when the offer count does not match the transition history count', () => {
      // Claims a brand counter happened, but the transaction history says it didn't.
      const offers = [applyByCustomer(55000), counterByProvider(47500)];
      const txTransitions = [txEntry('transition/apply', 'customer', '2026-08-02T10:00:00.000Z')];
      expect(isValidOfferHistory(offers, txTransitions)).toBe(false);
    });

    it('rejects when the actor on an offer does not match who actually performed the transition', () => {
      // Tampering attempt: claims the brand (provider) made the initial apply.
      const forgedOffers = [{ ...applyByCustomer(40000), by: 'provider' }];
      const txTransitions = [txEntry('transition/apply', 'customer', '2026-08-02T10:00:00.000Z')];
      expect(isValidOfferHistory(forgedOffers, txTransitions)).toBe(false);
    });

    it('rejects a non-positive or non-integer amount', () => {
      const zeroOffer = [{ ...applyByCustomer(0) }];
      const floatOffer = [{ ...applyByCustomer(100.5) }];
      const txTransitions = [txEntry('transition/apply', 'customer', '2026-08-02T10:00:00.000Z')];
      expect(isValidOfferHistory(zeroOffer, txTransitions)).toBe(false);
      expect(isValidOfferHistory(floatOffer, txTransitions)).toBe(false);
    });
  });
});
