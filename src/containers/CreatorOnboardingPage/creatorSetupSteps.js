import { isUserAuthorized } from '../../util/userHelpers';

/**
 * The four things a creator needs before they can apply to projects and get
 * booked: get approved (invite-only vetting, handled entirely by
 * Sharetribe's user-approval state — no action from the creator), fill out
 * their profile, publish their creator-profile package listing, and connect
 * a Stripe payout method.
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
      id: 'payout',
      titleId: 'CreatorOnboardingPage.stepPayoutTitle',
      bodyId: 'CreatorOnboardingPage.stepPayoutBody',
      done: payoutsEnabled,
      ctaLabelId: 'CreatorOnboardingPage.stepPayoutCta',
      routeName: 'StripePayoutPage',
    },
  ];
};
