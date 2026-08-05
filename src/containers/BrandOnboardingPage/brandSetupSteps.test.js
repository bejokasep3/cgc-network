import { getBrandSetupSteps } from './brandSetupSteps';

const buildCurrentUser = ({ authorized = true, bio = 'Hello', hasProfileImage = true } = {}) => ({
  attributes: {
    state: authorized ? 'active' : 'pending-approval',
    profile: {
      bio,
      privateData: {},
    },
  },
  profileImage: hasProfileImage ? { id: 'img-1' } : null,
});

describe('getBrandSetupSteps', () => {
  it('returns exactly 4 steps in a fixed order', () => {
    const steps = getBrandSetupSteps({
      currentUser: buildCurrentUser(),
      subscriptionStatus: null,
      hasPublishedListing: false,
    });

    expect(steps.map(s => s.id)).toEqual(['access', 'profile', 'subscription', 'firstProject']);
  });

  it('marks every step undone for an empty account', () => {
    const steps = getBrandSetupSteps({
      currentUser: buildCurrentUser({ authorized: false, bio: '', hasProfileImage: false }),
      subscriptionStatus: null,
      hasPublishedListing: false,
    });

    expect(steps.every(s => !s.done)).toBe(true);
  });

  it('marks profile done only once both bio and photo are present', () => {
    const missingPhoto = getBrandSetupSteps({
      currentUser: buildCurrentUser({ hasProfileImage: false }),
      subscriptionStatus: null,
      hasPublishedListing: false,
    });
    expect(missingPhoto.find(s => s.id === 'profile').done).toBe(false);

    const missingBio = getBrandSetupSteps({
      currentUser: buildCurrentUser({ bio: '' }),
      subscriptionStatus: null,
      hasPublishedListing: false,
    });
    expect(missingBio.find(s => s.id === 'profile').done).toBe(false);

    const complete = getBrandSetupSteps({
      currentUser: buildCurrentUser(),
      subscriptionStatus: null,
      hasPublishedListing: false,
    });
    expect(complete.find(s => s.id === 'profile').done).toBe(true);
  });

  it('marks subscription done only when the status payload is active', () => {
    const inactive = getBrandSetupSteps({
      currentUser: buildCurrentUser(),
      subscriptionStatus: { isActive: false, status: 'canceled' },
      hasPublishedListing: false,
    });
    expect(inactive.find(s => s.id === 'subscription').done).toBe(false);

    const active = getBrandSetupSteps({
      currentUser: buildCurrentUser(),
      subscriptionStatus: { isActive: true, status: 'active' },
      hasPublishedListing: false,
    });
    expect(active.find(s => s.id === 'subscription').done).toBe(true);
  });

  it('marks firstProject done once the brand has a published listing', () => {
    const steps = getBrandSetupSteps({
      currentUser: buildCurrentUser(),
      subscriptionStatus: { isActive: true },
      hasPublishedListing: true,
    });
    expect(steps.find(s => s.id === 'firstProject').done).toBe(true);
    expect(steps.every(s => s.done)).toBe(true);
  });

  it('links steps to the expected routes', () => {
    const steps = getBrandSetupSteps({
      currentUser: buildCurrentUser(),
      subscriptionStatus: null,
      hasPublishedListing: false,
    });
    expect(steps.find(s => s.id === 'profile').routeName).toBe('ProfileSettingsPage');
    expect(steps.find(s => s.id === 'subscription').routeName).toBe('SubscriptionPage');
    expect(steps.find(s => s.id === 'firstProject').routeName).toBe('PostProjectPage');
    expect(steps.find(s => s.id === 'access').routeName).toBe(null);
  });
});
