const {
  isPendingApplicant,
  serializeApplicant,
  validateApproveBody,
  validateDecisionBody,
} = require('./adminApplications');

const buildUser = ({
  state = 'pendingApproval',
  userType = 'creator',
  email = 'creator@example.com',
  displayName = 'Jamie Rivera',
  createdAt = '2026-01-01T00:00:00.000Z',
  application = null,
  accessRequest = null,
  applicationDecision = null,
} = {}) => ({
  id: { uuid: 'user-1' },
  attributes: {
    state,
    email,
    createdAt,
    profile: {
      displayName,
      publicData: { userType },
      privateData: {
        ...(application ? { application } : {}),
        ...(accessRequest ? { accessRequest } : {}),
        ...(applicationDecision ? { applicationDecision } : {}),
      },
    },
  },
});

describe('isPendingApplicant', () => {
  it('accepts a pending-approval creator', () => {
    expect(isPendingApplicant(buildUser({ state: 'pendingApproval', userType: 'creator' }))).toBe(
      true
    );
  });

  it('accepts a pending-approval brand', () => {
    expect(isPendingApplicant(buildUser({ state: 'pendingApproval', userType: 'brand' }))).toBe(
      true
    );
  });

  it('rejects an active user', () => {
    expect(isPendingApplicant(buildUser({ state: 'active' }))).toBe(false);
  });

  it('rejects a pending-approval operator', () => {
    expect(isPendingApplicant(buildUser({ state: 'pendingApproval', userType: 'operator' }))).toBe(
      false
    );
  });

  it('rejects a missing user', () => {
    expect(isPendingApplicant(null)).toBe(false);
  });
});

describe('serializeApplicant', () => {
  it('surfaces a creator application and omits accessRequest', () => {
    const application = { handles: [], sampleWorks: [], niches: [] };
    const result = serializeApplicant(buildUser({ userType: 'creator', application }));
    expect(result.application).toEqual(application);
    expect(result.accessRequest).toBeNull();
    expect(result.id).toBe('user-1');
    expect(result.userType).toBe('creator');
  });

  it('surfaces a brand accessRequest and omits application', () => {
    const accessRequest = { company: 'Acme', website: 'https://acme.example' };
    const result = serializeApplicant(buildUser({ userType: 'brand', accessRequest }));
    expect(result.accessRequest).toEqual(accessRequest);
    expect(result.application).toBeNull();
  });

  it('carries a prior decision through unchanged', () => {
    const applicationDecision = { status: 'rejected', note: 'No sample works', decidedAt: 'x' };
    const result = serializeApplicant(buildUser({ applicationDecision }));
    expect(result.decision).toEqual(applicationDecision);
  });

  it('defaults decision to null when none exists yet', () => {
    expect(serializeApplicant(buildUser()).decision).toBeNull();
  });
});

describe('validateApproveBody', () => {
  it('accepts a body with a userId', () => {
    expect(validateApproveBody({ userId: 'user-1' })).toEqual({ userId: 'user-1' });
  });

  it('trims the userId', () => {
    expect(validateApproveBody({ userId: '  user-1  ' })).toEqual({ userId: 'user-1' });
  });

  it('rejects a missing userId', () => {
    expect(() => validateApproveBody({})).toThrow('Missing userId.');
  });
});

describe('validateDecisionBody', () => {
  it('accepts a valid rejected decision', () => {
    expect(validateDecisionBody({ userId: 'user-1', status: 'rejected', note: 'No samples' })).toEqual({
      userId: 'user-1',
      status: 'rejected',
      note: 'No samples',
    });
  });

  it('accepts a valid moreInfoRequested decision', () => {
    expect(
      validateDecisionBody({ userId: 'user-1', status: 'moreInfoRequested', note: 'Need a portfolio link' })
    ).toEqual({
      userId: 'user-1',
      status: 'moreInfoRequested',
      note: 'Need a portfolio link',
    });
  });

  it('rejects an unknown status', () => {
    expect(() =>
      validateDecisionBody({ userId: 'user-1', status: 'banned', note: 'x' })
    ).toThrow('Unknown decision status: banned');
  });

  it('rejects a missing note', () => {
    expect(() => validateDecisionBody({ userId: 'user-1', status: 'rejected', note: '  ' })).toThrow(
      'A reason is required to reject an applicant.'
    );
  });

  it('rejects a missing userId', () => {
    expect(() =>
      validateDecisionBody({ status: 'rejected', note: 'x' })
    ).toThrow('Missing userId.');
  });
});
