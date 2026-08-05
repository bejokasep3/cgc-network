const {
  randomCode,
  serializeInviteCode,
  validateCreateInviteCodeBody,
  validateRevokeInviteCodeBody,
  isUsableInviteCode,
} = require('./adminInvites');

describe('randomCode', () => {
  it('matches the CGC-XXXXXX shape', () => {
    expect(randomCode()).toMatch(/^CGC-[A-Z0-9]{6}$/);
  });

  it('excludes visually ambiguous characters', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(randomCode()).not.toMatch(/[01OI]/);
    }
  });

  it('is not deterministic', () => {
    const codes = new Set(Array.from({ length: 20 }, () => randomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

const buildListing = ({
  state = 'published',
  code = 'CGC-ABC123',
  note = 'For a specific creator',
  maxUses = 1,
  usedCount = 0,
  expiresAt = null,
  createdAt = '2026-01-01T00:00:00.000Z',
} = {}) => ({
  id: { uuid: 'listing-1' },
  attributes: {
    state,
    createdAt,
    publicData: { listingType: 'invite-code', code, note, maxUses, usedCount, expiresAt },
  },
});

describe('serializeInviteCode', () => {
  it('marks a published listing as not revoked', () => {
    expect(serializeInviteCode(buildListing({ state: 'published' })).revoked).toBe(false);
  });

  it('marks a closed listing as revoked', () => {
    expect(serializeInviteCode(buildListing({ state: 'closed' })).revoked).toBe(true);
  });

  it('surfaces the code fields', () => {
    const result = serializeInviteCode(
      buildListing({ code: 'CGC-XYZ789', note: 'hi', maxUses: 3, usedCount: 1 })
    );
    expect(result).toEqual(
      expect.objectContaining({
        code: 'CGC-XYZ789',
        note: 'hi',
        maxUses: 3,
        usedCount: 1,
      })
    );
  });
});

describe('validateCreateInviteCodeBody', () => {
  it('accepts a valid body', () => {
    expect(validateCreateInviteCodeBody({ note: ' hi ', maxUses: 5, expiresAt: null })).toEqual({
      note: 'hi',
      maxUses: 5,
      expiresAt: null,
    });
  });

  it('defaults a missing note to an empty string', () => {
    expect(validateCreateInviteCodeBody({ maxUses: 1 }).note).toBe('');
  });

  it('rejects a non-integer maxUses', () => {
    expect(() => validateCreateInviteCodeBody({ maxUses: 'lots' })).toThrow(
      'maxUses must be a positive integer.'
    );
  });

  it('rejects a maxUses below 1', () => {
    expect(() => validateCreateInviteCodeBody({ maxUses: 0 })).toThrow(
      'maxUses must be a positive integer.'
    );
  });

  it('rejects an invalid expiresAt', () => {
    expect(() => validateCreateInviteCodeBody({ maxUses: 1, expiresAt: 'not-a-date' })).toThrow(
      'expiresAt must be a valid date.'
    );
  });

  it('accepts a valid expiresAt', () => {
    expect(
      validateCreateInviteCodeBody({ maxUses: 1, expiresAt: '2026-12-31T00:00:00.000Z' }).expiresAt
    ).toBe('2026-12-31T00:00:00.000Z');
  });
});

describe('validateRevokeInviteCodeBody', () => {
  it('accepts a body with a listingId', () => {
    expect(validateRevokeInviteCodeBody({ listingId: 'listing-1' })).toEqual({
      listingId: 'listing-1',
    });
  });

  it('rejects a missing listingId', () => {
    expect(() => validateRevokeInviteCodeBody({})).toThrow('Missing listingId.');
  });
});

describe('isUsableInviteCode', () => {
  it('accepts a published, unused, unexpired code', () => {
    expect(isUsableInviteCode(buildListing())).toBe(true);
  });

  it('rejects a closed (revoked) code', () => {
    expect(isUsableInviteCode(buildListing({ state: 'closed' }))).toBe(false);
  });

  it('rejects a code at its usage limit', () => {
    expect(isUsableInviteCode(buildListing({ maxUses: 2, usedCount: 2 }))).toBe(false);
  });

  it('accepts a code under its usage limit', () => {
    expect(isUsableInviteCode(buildListing({ maxUses: 2, usedCount: 1 }))).toBe(true);
  });

  it('rejects an expired code', () => {
    expect(isUsableInviteCode(buildListing({ expiresAt: '2020-01-01T00:00:00.000Z' }))).toBe(
      false
    );
  });

  it('accepts a code with a future expiry', () => {
    expect(isUsableInviteCode(buildListing({ expiresAt: '2099-01-01T00:00:00.000Z' }))).toBe(
      true
    );
  });

  it('rejects a missing listing', () => {
    expect(isUsableInviteCode(null)).toBe(false);
  });
});
