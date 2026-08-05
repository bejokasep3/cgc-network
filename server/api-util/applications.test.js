const { validateCreatorApplication, validateAccessRequest } = require('./applications');

describe('validateCreatorApplication', () => {
  const validBody = () => ({
    handles: [{ platform: 'tiktok', url: 'https://tiktok.com/@creator', followers: 12000 }],
    sampleWorks: [
      'https://example.com/1',
      'https://example.com/2',
      'https://example.com/3',
    ],
    niches: ['beauty', 'fashion'],
    typicalTurnaroundDays: 7,
    indicativeRateInSubunits: 40000,
  });

  it('accepts a complete, valid application', () => {
    const result = validateCreatorApplication(validBody());
    expect(result).toEqual(
      expect.objectContaining({
        handles: [{ platform: 'tiktok', url: 'https://tiktok.com/@creator', followers: 12000 }],
        sampleWorks: [
          'https://example.com/1',
          'https://example.com/2',
          'https://example.com/3',
        ],
        niches: ['beauty', 'fashion'],
        typicalTurnaroundDays: 7,
        indicativeRateInSubunits: 40000,
      })
    );
    expect(typeof result.submittedAt).toBe('string');
  });

  it('defaults a missing/invalid followers count to null instead of trusting garbage', () => {
    const body = validBody();
    body.handles[0].followers = 'a lot';
    const result = validateCreatorApplication(body);
    expect(result.handles[0].followers).toBeNull();
  });

  it('rejects when there are no handles', () => {
    const body = { ...validBody(), handles: [] };
    expect(() => validateCreatorApplication(body)).toThrow(/social handle/);
  });

  it('rejects a handle missing a platform or url', () => {
    const body = { ...validBody(), handles: [{ platform: 'tiktok' }] };
    expect(() => validateCreatorApplication(body)).toThrow(/platform and a URL/);
  });

  it('rejects fewer than three sample works', () => {
    const body = { ...validBody(), sampleWorks: ['https://example.com/1', 'https://example.com/2'] };
    expect(() => validateCreatorApplication(body)).toThrow(/three sample work links/);
  });

  it('rejects more than three sample works', () => {
    const body = {
      ...validBody(),
      sampleWorks: [
        'https://example.com/1',
        'https://example.com/2',
        'https://example.com/3',
        'https://example.com/4',
      ],
    };
    expect(() => validateCreatorApplication(body)).toThrow(/three sample work links/);
  });

  it('rejects blank sample work entries even if the array length is three', () => {
    const body = { ...validBody(), sampleWorks: ['https://example.com/1', '  ', 'https://example.com/3'] };
    expect(() => validateCreatorApplication(body)).toThrow(/three sample work links/);
  });

  it('rejects when no niches are selected', () => {
    const body = { ...validBody(), niches: [] };
    expect(() => validateCreatorApplication(body)).toThrow(/niche/);
  });

  it('rejects a non-integer or non-positive typicalTurnaroundDays', () => {
    expect(() =>
      validateCreatorApplication({ ...validBody(), typicalTurnaroundDays: 0 })
    ).toThrow(/turnaround/);
    expect(() =>
      validateCreatorApplication({ ...validBody(), typicalTurnaroundDays: 3.5 })
    ).toThrow(/turnaround/);
  });

  it('rejects a non-integer or non-positive indicativeRateInSubunits', () => {
    expect(() =>
      validateCreatorApplication({ ...validBody(), indicativeRateInSubunits: -100 })
    ).toThrow(/indicative rate/);
  });
});

describe('validateAccessRequest', () => {
  const validBody = () => ({
    company: 'Acme Co',
    website: 'https://acme.example',
    category: 'skincare',
    monthlyVolume: '10-20',
    budgetRange: '5000-10000',
    source: 'referral',
  });

  it('accepts a complete, valid access request', () => {
    const result = validateAccessRequest(validBody());
    expect(result).toEqual(
      expect.objectContaining({
        company: 'Acme Co',
        website: 'https://acme.example',
        category: 'skincare',
        monthlyVolume: '10-20',
        budgetRange: '5000-10000',
        source: 'referral',
      })
    );
    expect(typeof result.submittedAt).toBe('string');
  });

  it('allows the optional fields to be omitted, normalizing them to null', () => {
    const result = validateAccessRequest({ company: 'Acme Co', website: 'https://acme.example' });
    expect(result.category).toBeNull();
    expect(result.monthlyVolume).toBeNull();
    expect(result.budgetRange).toBeNull();
    expect(result.source).toBeNull();
  });

  it('rejects a missing company name', () => {
    expect(() => validateAccessRequest({ website: 'https://acme.example' })).toThrow(
      /Company name/
    );
  });

  it('rejects a missing website', () => {
    expect(() => validateAccessRequest({ company: 'Acme Co' })).toThrow(/website/);
  });

  it('trims whitespace-only required fields as missing', () => {
    expect(() =>
      validateAccessRequest({ company: '   ', website: 'https://acme.example' })
    ).toThrow(/Company name/);
  });
});
