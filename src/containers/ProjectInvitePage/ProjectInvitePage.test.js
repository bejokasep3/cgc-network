import { matchScore } from './ProjectInvitePage';

describe('matchScore', () => {
  it('is 0 when nothing overlaps', () => {
    const creator = { contentNiche: ['tech'], platforms: ['youtube'] };
    expect(matchScore(creator, ['beauty'], ['tiktok'])).toBe(0);
  });

  it('counts each matching niche and platform', () => {
    const creator = { contentNiche: ['beauty', 'fashion'], platforms: ['tiktok'] };
    expect(matchScore(creator, ['beauty', 'fashion'], ['tiktok', 'youtube'])).toBe(3);
  });

  it('handles a creator with no niche/platforms data', () => {
    const creator = {};
    expect(matchScore(creator, ['beauty'], ['tiktok'])).toBe(0);
  });

  it('handles an unscoped project (no niche/platform filters set)', () => {
    const creator = { contentNiche: ['beauty'], platforms: ['tiktok'] };
    expect(matchScore(creator, [], [])).toBe(0);
  });
});
