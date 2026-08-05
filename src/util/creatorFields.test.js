import { getCreatorFieldLabels, getProjectFieldLabels } from './creatorFields';

const listingFieldConfigs = [
  {
    key: 'contentNiche',
    enumOptions: [{ option: 'beauty', label: 'Beauty' }, { option: 'fashion', label: 'Fashion' }],
  },
  {
    key: 'platforms',
    enumOptions: [{ option: 'tiktok', label: 'TikTok' }, { option: 'ig-reels', label: 'IG Reels' }],
  },
  {
    key: 'usageRights',
    enumOptions: [{ option: 'organic-only', label: 'Organic only' }],
  },
];

describe('getProjectFieldLabels', () => {
  it('resolves niche/platform/usageRights labels against Console config', () => {
    const publicData = {
      contentNiche: ['beauty'],
      platforms: ['tiktok', 'ig-reels'],
      usageRights: 'organic-only',
    };

    const result = getProjectFieldLabels(publicData, listingFieldConfigs);

    expect(result.nicheLabels).toEqual(['Beauty']);
    expect(result.platformLabels).toEqual(['TikTok', 'IG Reels']);
    expect(result.usageRightsLabel).toBe('Organic only');
  });

  it('reads requiresProduct, contentDueDate, and deliverableCount from the §2.1 shape', () => {
    const publicData = {
      requiresProduct: true,
      contentDueDate: '2026-09-15',
      deliverables: [{ id: 'd1' }, { id: 'd2' }],
    };

    const result = getProjectFieldLabels(publicData, listingFieldConfigs);

    expect(result.requiresProduct).toBe(true);
    expect(result.contentDueDate).toBe('2026-09-15');
    expect(result.deliverableCount).toBe(2);
  });

  it('defaults gracefully when publicData is empty', () => {
    const result = getProjectFieldLabels({}, listingFieldConfigs);

    expect(result.nicheLabels).toEqual([]);
    expect(result.platformLabels).toEqual([]);
    expect(result.usageRightsLabel).toBeNull();
    expect(result.requiresProduct).toBe(false);
    expect(result.contentDueDate).toBeNull();
    expect(result.deliverableCount).toBe(0);
  });

  it('does not carry over the stale budgetRange/deadline shape', () => {
    const result = getProjectFieldLabels({}, listingFieldConfigs);

    expect(result).not.toHaveProperty('budgetRangeLabel');
    expect(result).not.toHaveProperty('deadline');
  });
});

describe('getCreatorFieldLabels', () => {
  it('resolves creator-profile fields against Console config', () => {
    const publicData = {
      contentNiche: ['fashion'],
      platforms: ['tiktok'],
      usageRights: 'organic-only',
      deliverableCount: 3,
      turnaroundDays: 5,
    };

    const result = getCreatorFieldLabels(publicData, listingFieldConfigs);

    expect(result.nicheLabels).toEqual(['Fashion']);
    expect(result.platformLabels).toEqual(['TikTok']);
    expect(result.usageRightsLabel).toBe('Organic only');
    expect(result.deliverableCount).toBe(3);
    expect(result.turnaroundDays).toBe(5);
  });
});
