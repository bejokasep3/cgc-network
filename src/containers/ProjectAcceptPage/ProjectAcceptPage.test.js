import { deliverableTypeLabel, platformLabel } from './ProjectAcceptPage';

const fakeIntl = {
  formatMessage: ({ id }) => id,
};

describe('deliverableTypeLabel', () => {
  it('resolves a known deliverable type to its translation id', () => {
    expect(deliverableTypeLabel(fakeIntl, 'video')).toBe('PostProjectForm.deliverableType.video');
  });

  it('falls back to the raw value for an unknown type', () => {
    expect(deliverableTypeLabel(fakeIntl, 'holograph')).toBe('holograph');
  });
});

describe('platformLabel', () => {
  const listingFieldConfigs = [
    {
      key: 'platforms',
      enumOptions: [
        { option: 'tiktok', label: 'TikTok' },
        { option: 'instagram-reels', label: 'Instagram Reels' },
      ],
    },
  ];

  it('resolves a known platform value to its Console-configured label', () => {
    expect(platformLabel(listingFieldConfigs, 'tiktok')).toBe('TikTok');
  });

  it('falls back to the raw value when no config is found', () => {
    expect(platformLabel(listingFieldConfigs, 'youtube')).toBe('youtube');
    expect(platformLabel([], 'tiktok')).toBe('tiktok');
    expect(platformLabel(undefined, 'tiktok')).toBe('tiktok');
  });
});
