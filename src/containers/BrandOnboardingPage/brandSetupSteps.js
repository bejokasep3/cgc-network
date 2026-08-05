import { isUserAuthorized } from '../../util/userHelpers';
import { hasActiveBrandSubscription } from '../../util/subscription';

/**
 * The four things a brand needs before it can book a creator: get approved
 * (invite-only vetting, handled entirely by Sharetribe's user-approval
 * state — no action from the brand), fill out their profile, subscribe
 * (BLUEPRINT B4 — the gate is placed once the brand already wants
 * something, not at the front door), and post a first project.
 *
 * Mirrors creatorSetupSteps.js's shape exactly ({ id, titleId, bodyId, done,
 * ctaLabelId, routeName }) so both feed the same SetupChecklist component.
 * Kept as a pure function so both BrandOnboardingPage and BrandSetupBanner
 * can derive the same checklist from whatever slice of state they already
 * have.
 *
 * @param {Object} params
 * @param {Object} params.currentUser - API entity
 * @param {Object|null} params.subscriptionStatus - state.brandSubscription.status
 * @param {boolean} params.hasPublishedListing - state.user.currentUserHasListings
 *   (a brand's only listings are its projects, so this doubles as "has
 *   posted a first project")
 * @returns {Array<Object>} steps, in order, each
 *   { id, titleId, bodyId, done, ctaLabelId, routeName }
 */
export const getBrandSetupSteps = ({ currentUser, subscriptionStatus, hasPublishedListing }) => {
  const profile = currentUser?.attributes?.profile || {};
  const hasProfilePhoto = !!currentUser?.profileImage;
  const hasBio = !!profile.bio;

  return [
    {
      id: 'access',
      titleId: 'BrandOnboardingPage.stepAccessTitle',
      bodyId: 'BrandOnboardingPage.stepAccessBody',
      done: isUserAuthorized(currentUser),
      ctaLabelId: null,
      routeName: null,
    },
    {
      id: 'profile',
      titleId: 'BrandOnboardingPage.stepProfileTitle',
      bodyId: 'BrandOnboardingPage.stepProfileBody',
      done: hasBio && hasProfilePhoto,
      ctaLabelId: 'BrandOnboardingPage.stepProfileCta',
      routeName: 'ProfileSettingsPage',
    },
    {
      id: 'subscription',
      titleId: 'BrandOnboardingPage.stepSubscriptionTitle',
      bodyId: 'BrandOnboardingPage.stepSubscriptionBody',
      done: hasActiveBrandSubscription(subscriptionStatus),
      ctaLabelId: 'BrandOnboardingPage.stepSubscriptionCta',
      routeName: 'SubscriptionPage',
    },
    {
      id: 'firstProject',
      titleId: 'BrandOnboardingPage.stepFirstProjectTitle',
      bodyId: 'BrandOnboardingPage.stepFirstProjectBody',
      done: !!hasPublishedListing,
      ctaLabelId: 'BrandOnboardingPage.stepFirstProjectCta',
      routeName: 'PostProjectPage',
    },
  ];
};
