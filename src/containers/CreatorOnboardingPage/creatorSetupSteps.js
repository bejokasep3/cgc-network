import { isUserAuthorized } from '../../util/userHelpers';

// A shipping address counts as set once the fields CGCActionModal's
// addShippingAddress modal actually requires are present — addressLine2 is
// optional there too, so it's excluded from this check.
const REQUIRED_SHIPPING_ADDRESS_FIELDS = [
  'shippingRecipientName',
  'shippingAddressLine1',
  'shippingCity',
  'shippingPostalCode',
  'shippingCountry',
];

/**
 * The five things a creator needs before they can apply to projects and get
 * booked: get approved (invite-only vetting, handled entirely by
 * Sharetribe's user-approval state — no action from the creator), fill out
 * their profile, publish their creator-profile package listing, save a
 * default shipping address (BLUEPRINT §7 C2 — collected now so a brand can
 * ship the same day a collaboration is agreed), and connect a Stripe payout
 * method.
 *
 * Kept as a pure function (no React/Redux) so both CreatorOnboardingPage and
 * CreatorSetupBanner can derive the same checklist from whatever slice of
 * state they already have.
 *
 * @param {Object} params
 * @param {Object} params.currentUser - API entity
 * @param {Object|null} params.ownProfileListing - the creator's own published
 *   creator-profile listing, if any (see ducks/creatorProfile.duck.js)
 * @param {Object|null} params.stripeAccount - state.stripeConnectAccount.stripeAccount
 * @returns {Array<Object>} steps, in order, each
 *   { id, titleId, bodyId, done, ctaLabelId, routeName }
 */
export const getCreatorSetupSteps = ({ currentUser, ownProfileListing, stripeAccount }) => {
  const profile = currentUser?.attributes?.profile || {};
  const hasProfilePhoto = !!currentUser?.profileImage;
  const hasBio = !!profile.bio;
  const shippingAddress = profile.privateData?.shippingAddress || {};
  const hasShippingAddress = REQUIRED_SHIPPING_ADDRESS_FIELDS.every(
    field => !!shippingAddress[field]
  );
  const payoutsEnabled = stripeAccount?.attributes?.stripeAccountData?.payouts_enabled === true;

  return [
    {
      id: 'approval',
      titleId: 'CreatorOnboardingPage.stepApprovalTitle',
      bodyId: 'CreatorOnboardingPage.stepApprovalBody',
      done: isUserAuthorized(currentUser),
      ctaLabelId: null,
      routeName: null,
    },
    {
      id: 'profile',
      titleId: 'CreatorOnboardingPage.stepProfileTitle',
      bodyId: 'CreatorOnboardingPage.stepProfileBody',
      done: hasBio && hasProfilePhoto,
      ctaLabelId: 'CreatorOnboardingPage.stepProfileCta',
      routeName: 'ProfileSettingsPage',
    },
    {
      id: 'package',
      titleId: 'CreatorOnboardingPage.stepPackageTitle',
      bodyId: 'CreatorOnboardingPage.stepPackageBody',
      done: !!ownProfileListing,
      ctaLabelId: 'CreatorOnboardingPage.stepPackageCta',
      routeName: 'CreatorPackagePage',
    },
    {
      id: 'shippingAddress',
      titleId: 'CreatorOnboardingPage.stepShippingAddressTitle',
      bodyId: 'CreatorOnboardingPage.stepShippingAddressBody',
      done: hasShippingAddress,
      ctaLabelId: 'CreatorOnboardingPage.stepShippingAddressCta',
      routeName: 'ShippingAddressPage',
    },
    {
      id: 'payout',
      titleId: 'CreatorOnboardingPage.stepPayoutTitle',
      bodyId: 'CreatorOnboardingPage.stepPayoutBody',
      done: payoutsEnabled,
      ctaLabelId: 'CreatorOnboardingPage.stepPayoutCta',
      routeName: 'StripePayoutPage',
    },
  ];
};
