import { buildLibraryAssets, getLibraryFilterOptions, filterLibraryAssets } from './libraryAssets';

const fakeIntl = {
  formatMessage: ({ id }) => id,
};

const buildTx = ({
  txId = 'tx-1',
  projectId = 'p1',
  creatorId = 'c1',
  creatorName = 'Jamie',
  deliverables = [],
} = {}) => ({
  id: { uuid: txId },
  attributes: { protectedData: { projectId, deliverables } },
  provider: { id: { uuid: creatorId }, attributes: { profile: { displayName: creatorName } } },
});

const buildProjectListing = (id, title, usageRights) => ({
  id: { uuid: id },
  attributes: { title, publicData: { usageRights } },
});

describe('buildLibraryAssets', () => {
  it('takes the last version of each deliverable as the final asset', () => {
    const tx = buildTx({
      deliverables: [
        {
          id: 'd1',
          type: 'video',
          platform: 'tiktok',
          versions: [
            { contentLinks: 'https://old.example.com', submissionNote: 'v1' },
            { contentLinks: 'https://final.example.com', submissionNote: 'v2 final' },
          ],
        },
      ],
    });
    const assets = buildLibraryAssets([tx], {}, [], fakeIntl);
    expect(assets).toHaveLength(1);
    expect(assets[0].contentLinks).toBe('https://final.example.com');
    expect(assets[0].submissionNote).toBe('v2 final');
  });

  it('skips a deliverable with no submitted version', () => {
    const tx = buildTx({
      deliverables: [{ id: 'd1', type: 'video', platform: 'tiktok', versions: [] }],
    });
    expect(buildLibraryAssets([tx], {}, [], fakeIntl)).toEqual([]);
  });

  it('resolves usageRights from the project listing, not the transaction', () => {
    const tx = buildTx({
      projectId: 'p1',
      deliverables: [
        { id: 'd1', type: 'photo', platform: 'instagram-static', versions: [{ contentLinks: 'x' }] },
      ],
    });
    const projectListingsById = { p1: buildProjectListing('p1', 'Summer campaign', 'paid-ads-3m') };
    const assets = buildLibraryAssets([tx], projectListingsById, [], fakeIntl);
    expect(assets[0].usageRightsLabel).toBe('paid-ads-3m');
    expect(assets[0].projectTitle).toBe('Summer campaign');
  });

  it('produces one asset per deliverable across multiple deliverables', () => {
    const tx = buildTx({
      deliverables: [
        { id: 'd1', type: 'video', platform: 'tiktok', versions: [{ contentLinks: 'a' }] },
        { id: 'd2', type: 'photo', platform: 'instagram-static', versions: [{ contentLinks: 'b' }] },
      ],
    });
    expect(buildLibraryAssets([tx], {}, [], fakeIntl)).toHaveLength(2);
  });

  it('flattens across multiple transactions', () => {
    const tx1 = buildTx({
      txId: 'tx-1',
      deliverables: [{ id: 'd1', type: 'video', platform: 'tiktok', versions: [{ contentLinks: 'a' }] }],
    });
    const tx2 = buildTx({
      txId: 'tx-2',
      deliverables: [{ id: 'd1', type: 'video', platform: 'tiktok', versions: [{ contentLinks: 'b' }] }],
    });
    expect(buildLibraryAssets([tx1, tx2], {}, [], fakeIntl)).toHaveLength(2);
  });
});

describe('getLibraryFilterOptions', () => {
  it('deduplicates projects, creators, and platforms', () => {
    const assets = [
      { projectId: 'p1', projectTitle: 'A', creatorId: 'c1', creatorName: 'Jamie', platform: 'tiktok' },
      { projectId: 'p1', projectTitle: 'A', creatorId: 'c1', creatorName: 'Jamie', platform: 'tiktok' },
      { projectId: 'p2', projectTitle: 'B', creatorId: 'c2', creatorName: 'Alex', platform: 'youtube' },
    ];
    const options = getLibraryFilterOptions(assets);
    expect(options.projects).toEqual([
      { id: 'p1', title: 'A' },
      { id: 'p2', title: 'B' },
    ]);
    expect(options.creators).toEqual([
      { id: 'c1', name: 'Jamie' },
      { id: 'c2', name: 'Alex' },
    ]);
    expect(options.platforms).toEqual(['tiktok', 'youtube']);
  });

  it('returns empty option sets for an empty asset list', () => {
    expect(getLibraryFilterOptions([])).toEqual({ projects: [], creators: [], platforms: [] });
  });
});

describe('filterLibraryAssets', () => {
  const assets = [
    { id: 'a1', projectId: 'p1', creatorId: 'c1', platform: 'tiktok' },
    { id: 'a2', projectId: 'p1', creatorId: 'c2', platform: 'youtube' },
    { id: 'a3', projectId: 'p2', creatorId: 'c1', platform: 'tiktok' },
  ];

  it('returns everything when no filters are set', () => {
    expect(filterLibraryAssets(assets, {})).toHaveLength(3);
  });

  it('filters by projectId', () => {
    expect(filterLibraryAssets(assets, { projectId: 'p1' }).map(a => a.id)).toEqual(['a1', 'a2']);
  });

  it('filters by creatorId', () => {
    expect(filterLibraryAssets(assets, { creatorId: 'c1' }).map(a => a.id)).toEqual(['a1', 'a3']);
  });

  it('filters by platform', () => {
    expect(filterLibraryAssets(assets, { platform: 'tiktok' }).map(a => a.id)).toEqual(['a1', 'a3']);
  });

  it('combines multiple filters', () => {
    expect(filterLibraryAssets(assets, { projectId: 'p1', platform: 'tiktok' }).map(a => a.id)).toEqual([
      'a1',
    ]);
  });
});
