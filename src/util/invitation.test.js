import { INVITATION_VALIDITY_DAYS, isInvitationExpired, isInvitationActive } from './invitation';

const daysAgo = n => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe('isInvitationExpired', () => {
  it('is false for a missing createdAt', () => {
    expect(isInvitationExpired(null)).toBe(false);
    expect(isInvitationExpired(undefined)).toBe(false);
  });

  it('is false for a recent invitation', () => {
    expect(isInvitationExpired(daysAgo(1))).toBe(false);
  });

  it('is false exactly at the validity boundary', () => {
    expect(isInvitationExpired(daysAgo(INVITATION_VALIDITY_DAYS))).toBe(false);
  });

  it('is true once older than the validity window', () => {
    expect(isInvitationExpired(daysAgo(INVITATION_VALIDITY_DAYS + 1))).toBe(true);
  });
});

describe('isInvitationActive', () => {
  const txWith = (protectedData, createdAt) => ({
    attributes: { protectedData, createdAt },
  });

  it('is true for a fresh, unanswered invitation', () => {
    expect(isInvitationActive(txWith({ invitationStatus: 'sent' }, daysAgo(1)))).toBe(true);
  });

  it('is true once seen, as long as it is not expired', () => {
    expect(isInvitationActive(txWith({ invitationStatus: 'seen' }, daysAgo(2)))).toBe(true);
  });

  it('is false once declined, even if still fresh', () => {
    expect(isInvitationActive(txWith({ invitationStatus: 'declined' }, daysAgo(1)))).toBe(false);
  });

  it('is false once expired', () => {
    expect(
      isInvitationActive(txWith({ invitationStatus: 'sent' }, daysAgo(INVITATION_VALIDITY_DAYS + 1)))
    ).toBe(false);
  });

  it('handles a missing protectedData gracefully', () => {
    expect(isInvitationActive({ attributes: { createdAt: daysAgo(1) } })).toBe(true);
  });
});
