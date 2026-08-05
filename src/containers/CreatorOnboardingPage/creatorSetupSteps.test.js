import { getCreatorSetupSteps } from './creatorSetupSteps';

const completeShippingAddress = {
  shippingRecipientName: 'Jamie Rivera',
  shippingAddressLine1: '123 Main St',
  shippingCity: 'Austin',
  shippingPostalCode: '73301',
  shippingCountry: 'US',
};

const buildCurrentUser = ({
  authorized = true,
  bio = 'Hello',
  hasProfileImage = true,
  shippingAddress = null,
} = {}) => ({
  attributes: {
    state: authorized ? 'active' : 'pending-approval',
    profile: {
      bio,
      privateData: shippingAddress ? { shippingAddress } : {},
    },
  },
  profileImage: hasProfileImage ? { id: 'img-1' } : null,
});

describe('getCreatorSetupSteps', () => {
  it('returns exactly 5 steps in a fixed order', () => {
    const steps = getCreatorSetupSteps({
      currentUser: buildCurrentUser(),
      ownProfileListing: null,
      stripeAccount: null,
    });

    expect(steps.map(s => s.id)).toEqual([
      'approval',
      'profile',
      'package',
      'shippingAddress',
      'payout',
    ]);
  });

  it('marks shippingAddress done only once every required field is present', () => {
    const withoutAddress = getCreatorSetupSteps({
      currentUser: buildCurrentUser({ shippingAddress: null }),
      ownProfileListing: null,
      stripeAccount: null,
    });
    expect(withoutAddress.find(s => s.id === 'shippingAddress').done).toBe(false);

    const withPartialAddress = getCreatorSetupSteps({
      currentUser: buildCurrentUser({
        shippingAddress: { shippingRecipientName: 'Jamie', shippingAddressLine1: '123 Main St' },
      }),
      ownProfileListing: null,
      stripeAccount: null,
    });
    expect(withPartialAddress.find(s => s.id === 'shippingAddress').done).toBe(false);

    const withCompleteAddress = getCreatorSetupSteps({
      currentUser: buildCurrentUser({ shippingAddress: completeShippingAddress }),
      ownProfileListing: null,
      stripeAccount: null,
    });
    expect(withCompleteAddress.find(s => s.id === 'shippingAddress').done).toBe(true);
  });

  it('does not require shippingAddressLine2 to consider the step done', () => {
    const steps = getCreatorSetupSteps({
      currentUser: buildCurrentUser({
        shippingAddress: { ...completeShippingAddress, shippingAddressLine2: undefined },
      }),
      ownProfileListing: null,
      stripeAccount: null,
    });
    expect(steps.find(s => s.id === 'shippingAddress').done).toBe(true);
  });

  it('links the shippingAddress step to ShippingAddressPage', () => {
    const steps = getCreatorSetupSteps({
      currentUser: buildCurrentUser(),
      ownProfileListing: null,
      stripeAccount: null,
    });
    expect(steps.find(s => s.id === 'shippingAddress').routeName).toBe('ShippingAddressPage');
  });
});
