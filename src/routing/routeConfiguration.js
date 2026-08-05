import React from 'react';
import loadable from '@loadable/component';

import getPageDataLoadingAPI from '../containers/pageDataLoadingAPI';
import NotFoundPage from '../containers/NotFoundPage/NotFoundPage';
import PreviewResolverPage from '../containers/PreviewResolverPage/PreviewResolverPage';

// routeConfiguration needs to initialize containers first
// Otherwise, components will import form container eventually and
// at that point css bundling / imports will happen in wrong order.
import { NamedRedirect } from '../components';

const pageDataLoadingAPI = getPageDataLoadingAPI();

const AuthenticationPage = loadable(() => import(/* webpackChunkName: "AuthenticationPage" */ '../containers/AuthenticationPage/AuthenticationPage'));
const BrandOnboardingPage = loadable(() => import(/* webpackChunkName: "BrandOnboardingPage" */ '../containers/BrandOnboardingPage/BrandOnboardingPage'));
const ExploreCreatorsPage = loadable(() => import(/* webpackChunkName: "ExploreCreatorsPage" */ '../containers/ExploreCreatorsPage/ExploreCreatorsPage'));
const ManageCampaignsPage = loadable(() => import(/* webpackChunkName: "ManageCampaignsPage" */ '../containers/ManageCampaignsPage/ManageCampaignsPage'));
const PostProjectPage = loadable(() => import(/* webpackChunkName: "PostProjectPage" */ '../containers/PostProjectPage/PostProjectPage'));
const CreatorProfilePage = loadable(() => import(/* webpackChunkName: "CreatorProfilePage" */ '../containers/CreatorProfilePage/CreatorProfilePage'));
const BrowseProjectsPage = loadable(() => import(/* webpackChunkName: "BrowseProjectsPage" */ '../containers/BrowseProjectsPage/BrowseProjectsPage'));
const ProjectDetailPage = loadable(() => import(/* webpackChunkName: "ProjectDetailPage" */ '../containers/ProjectDetailPage/ProjectDetailPage'));
const EditProjectPage = loadable(() => import(/* webpackChunkName: "EditProjectPage" */ '../containers/EditProjectPage/EditProjectPage'));
const ProjectInvitePage = loadable(() => import(/* webpackChunkName: "ProjectInvitePage" */ '../containers/ProjectInvitePage/ProjectInvitePage'));
const ProjectAcceptPage = loadable(() => import(/* webpackChunkName: "ProjectAcceptPage" */ '../containers/ProjectAcceptPage/ProjectAcceptPage'));
const MyCollaborationsPage = loadable(() => import(/* webpackChunkName: "MyCollaborationsPage" */ '../containers/MyCollaborationsPage/MyCollaborationsPage'));
const CreatorOnboardingPage = loadable(() => import(/* webpackChunkName: "CreatorOnboardingPage" */ '../containers/CreatorOnboardingPage/CreatorOnboardingPage'));
const CreatorPackagePage = loadable(() => import(/* webpackChunkName: "CreatorPackagePage" */ '../containers/CreatorPackagePage/CreatorPackagePage'));
const ShippingAddressPage = loadable(() => import(/* webpackChunkName: "ShippingAddressPage" */ '../containers/ShippingAddressPage/ShippingAddressPage'));
const AdminPage = loadable(() => import(/* webpackChunkName: "AdminPage" */ '../containers/AdminPage/AdminPage'));
const AdminApplicationsPage = loadable(() => import(/* webpackChunkName: "AdminApplicationsPage" */ '../containers/AdminApplicationsPage/AdminApplicationsPage'));
const AdminInvitesPage = loadable(() => import(/* webpackChunkName: "AdminInvitesPage" */ '../containers/AdminInvitesPage/AdminInvitesPage'));
const AdminDisputesPage = loadable(() => import(/* webpackChunkName: "AdminDisputesPage" */ '../containers/AdminDisputesPage/AdminDisputesPage'));
const AdminHealthPage = loadable(() => import(/* webpackChunkName: "AdminHealthPage" */ '../containers/AdminHealthPage/AdminHealthPage'));
const LicensePage = loadable(() => import(/* webpackChunkName: "LicensePage" */ '../containers/LicensePage/LicensePage'));
const LibraryPage = loadable(() => import(/* webpackChunkName: "LibraryPage" */ '../containers/LibraryPage/LibraryPage'));
const EarningsPage = loadable(() => import(/* webpackChunkName: "EarningsPage" */ '../containers/EarningsPage/EarningsPage'));
const ApplyPage = loadable(() => import(/* webpackChunkName: "ApplyPage" */ '../containers/ApplyPage/ApplyPage'));
const RequestAccessPage = loadable(() => import(/* webpackChunkName: "RequestAccessPage" */ '../containers/RequestAccessPage/RequestAccessPage'));
const PendingPage = loadable(() => import(/* webpackChunkName: "PendingPage" */ '../containers/PendingPage/PendingPage'));
const CheckoutPage = loadable(() => import(/* webpackChunkName: "CheckoutPage" */ '../containers/CheckoutPage/CheckoutPage'));
const CMSPage = loadable(() => import(/* webpackChunkName: "CMSPage" */ '../containers/CMSPage/CMSPage'));
const ContactDetailsPage = loadable(() => import(/* webpackChunkName: "ContactDetailsPage" */ '../containers/ContactDetailsPage/ContactDetailsPage'));
const EditListingPage = loadable(() => import(/* webpackChunkName: "EditListingPage" */ '../containers/EditListingPage/EditListingPage'));
const EmailVerificationPage = loadable(() => import(/* webpackChunkName: "EmailVerificationPage" */ '../containers/EmailVerificationPage/EmailVerificationPage'));
const InboxPage = loadable(() => import(/* webpackChunkName: "InboxPage" */ '../containers/InboxPage/InboxPage'));
const MakeOfferPage = loadable(() => import(/* webpackChunkName: "MakeOfferPage" */ '../containers/MakeOfferPage/MakeOfferPage'));
const LandingPage = loadable(() => import(/* webpackChunkName: "LandingPage" */ '../containers/LandingPage/LandingPage'));
const ListingPageCoverPhoto = loadable(() => import(/* webpackChunkName: "ListingPageCoverPhoto" */ /* webpackPrefetch: true */ '../containers/ListingPage/ListingPageCoverPhoto'));
const ListingPageCarousel = loadable(() => import(/* webpackChunkName: "ListingPageCarousel" */ /* webpackPrefetch: true */ '../containers/ListingPage/ListingPageCarousel'));
const ManageListingsPage = loadable(() => import(/* webpackChunkName: "ManageListingsPage" */ '../containers/ManageListingsPage/ManageListingsPage'));
const ManageAccountPage = loadable(() => import(/* webpackChunkName: "ManageAccountPage" */ '../containers/ManageAccountPage/ManageAccountPage'));
const PasswordChangePage = loadable(() => import(/* webpackChunkName: "PasswordChangePage" */ '../containers/PasswordChangePage/PasswordChangePage'));
const PasswordRecoveryPage = loadable(() => import(/* webpackChunkName: "PasswordRecoveryPage" */ '../containers/PasswordRecoveryPage/PasswordRecoveryPage'));
const PasswordResetPage = loadable(() => import(/* webpackChunkName: "PasswordResetPage" */ '../containers/PasswordResetPage/PasswordResetPage'));
const PaymentMethodsPage = loadable(() => import(/* webpackChunkName: "PaymentMethodsPage" */ '../containers/PaymentMethodsPage/PaymentMethodsPage'));
const PrivacyPolicyPage = loadable(() => import(/* webpackChunkName: "PrivacyPolicyPage" */ '../containers/PrivacyPolicyPage/PrivacyPolicyPage'));
const ProfilePage = loadable(() => import(/* webpackChunkName: "ProfilePage" */ '../containers/ProfilePage/ProfilePage'));
const ProfileSettingsPage = loadable(() => import(/* webpackChunkName: "ProfileSettingsPage" */ '../containers/ProfileSettingsPage/ProfileSettingsPage'));
const RequestQuotePage = loadable(() => import(/* webpackChunkName: "RequestQuotePage" */ '../containers/RequestQuotePage/RequestQuotePage'));
const RosterPage = loadable(() => import(/* webpackChunkName: "RosterPage" */ '../containers/RosterPage/RosterPage'));
const SearchPageWithMap = loadable(() => import(/* webpackChunkName: "SearchPageWithMap" */ /* webpackPrefetch: true */  '../containers/SearchPage/SearchPageWithMap'));
const SearchPageWithGrid = loadable(() => import(/* webpackChunkName: "SearchPageWithGrid" */ /* webpackPrefetch: true */  '../containers/SearchPage/SearchPageWithGrid'));
const StripePayoutPage = loadable(() => import(/* webpackChunkName: "StripePayoutPage" */ '../containers/StripePayoutPage/StripePayoutPage'));
const SubscriptionPage = loadable(() => import(/* webpackChunkName: "SubscriptionPage" */ '../containers/SubscriptionPage/SubscriptionPage'));
const TermsOfServicePage = loadable(() => import(/* webpackChunkName: "TermsOfServicePage" */ '../containers/TermsOfServicePage/TermsOfServicePage'));
const TransactionPage = loadable(() => import(/* webpackChunkName: "TransactionPage" */ '../containers/TransactionPage/TransactionPage'));
const NoAccessPage = loadable(() => import(/* webpackChunkName: "NoAccessPage" */ '../containers/NoAccessPage/NoAccessPage'));

// Styleguide helps you to review current components and develop new ones
const StyleguidePage = loadable(() => import(/* webpackChunkName: "StyleguidePage" */ '../containers/StyleguidePage/StyleguidePage'));

export const ACCOUNT_SETTINGS_PAGES = [
  'ContactDetailsPage',
  'PasswordChangePage',
  'StripePayoutPage',
  'PaymentMethodsPage',
  'ManageAccountPage'
];

// https://en.wikipedia.org/wiki/Universally_unique_identifier#Nil_UUID
const draftId = '00000000-0000-0000-0000-000000000000';
const draftSlug = 'draft';

const RedirectToLandingPage = () => <NamedRedirect name="LandingPage" />;

// NOTE: Most server-side endpoints are prefixed with /api. Requests to those
// endpoints are indended to be handled in the server instead of the browser and
// they will not render the application. So remember to avoid routes starting
// with /api and if you encounter clashing routes see server/index.js if there's
// a conflicting route defined there.

// Our routes are exact by default.
// See behaviour from Routes.js where Route is created.
const routeConfiguration = (layoutConfig, accessControlConfig) => {
  const isSearchPageWithMap = layoutConfig.searchPage?.variantType === 'map';
  const SearchPage = isSearchPageWithMap ? SearchPageWithMap : SearchPageWithGrid;
  const ListingPage = layoutConfig.listingPage?.variantType === 'carousel' 
    ? ListingPageCarousel 
    : ListingPageCoverPhoto;

  const isPrivateMarketplace = accessControlConfig?.marketplace?.private === true;
  const authForPrivateMarketplace = isPrivateMarketplace ? { auth: true } : {};
  
  return [
    {
      path: '/',
      name: 'LandingPage',
      component: LandingPage,
    },
    {
      path: '/p/:pageId',
      name: 'CMSPage',
      component: CMSPage,
      loadData: pageDataLoadingAPI.CMSPage.loadData,
    },
    // NOTE: when the private marketplace feature is enabled, the '/s' route is disallowed by the robots.txt resource.
    // If you add new routes that start with '/s*' (e.g. /support), you should add them to the robotsPrivateMarketplace.txt file.
    {
      path: '/s',
      name: 'SearchPage',
      ...authForPrivateMarketplace,
      component: SearchPage,
      loadData: pageDataLoadingAPI.SearchPage.loadData,
      prioritizeLibraryLoading: {
        map: isSearchPageWithMap,
      },
    },
    {
      path: '/s/:listingType',
      name: 'SearchPageWithListingType',
      ...authForPrivateMarketplace,
      component: SearchPage,
      loadData: pageDataLoadingAPI.SearchPage.loadData,
      prioritizeLibraryLoading: {
        map: isSearchPageWithMap,
      },
    },
    {
      path: '/l',
      name: 'ListingBasePage',
      component: RedirectToLandingPage,
    },
    {
      path: '/l/:slug/:id',
      name: 'ListingPage',
      ...authForPrivateMarketplace,
      component: ListingPage,
      loadData: pageDataLoadingAPI.ListingPage.loadData,
      prioritizeLibraryLoading: {
        map: true,
      },
    },
    {
      path: '/l/:slug/:id/make-offer',
      name: 'MakeOfferPage',
      auth: true,
      component: MakeOfferPage,
      loadData: pageDataLoadingAPI.MakeOfferPage.loadData,
    },
    {
      path: '/l/:slug/:id/request-quote',
      name: 'RequestQuotePage',
      auth: true,
      component: RequestQuotePage,
      extraProps: { mode: 'request-quote' },
      loadData: pageDataLoadingAPI.RequestQuotePage.loadData,
    },
    {
      path: '/l/:slug/:id/checkout',
      name: 'CheckoutPage',
      auth: true,
      component: CheckoutPage,
      setInitialValues: pageDataLoadingAPI.CheckoutPage.setInitialValues,
      prioritizeLibraryLoading: {
        stripe: true,
      },
    },
    {
      path: '/l/:slug/:id/:variant',
      name: 'ListingPageVariant',
      auth: true,
      authPage: 'LoginPage',
      component: ListingPage,
      loadData: pageDataLoadingAPI.ListingPage.loadData,
      prioritizeLibraryLoading: {
        map: true,
      },
    },
    {
      path: '/l/new',
      name: 'NewListingPage',
      auth: true,
      component: () => (
        <NamedRedirect
          name="EditListingPage"
          params={{ slug: draftSlug, id: draftId, type: 'new', tab: 'details' }}
        />
      ),
    },
    {
      path: '/l/:slug/:id/:type/:tab',
      name: 'EditListingPage',
      auth: true,
      component: EditListingPage,
      loadData: pageDataLoadingAPI.EditListingPage.loadData,
      prioritizeLibraryLoading: {
        stripe: true,
      },
    },
    {
      path: '/l/:slug/:id/:type/:tab/:returnURLType',
      name: 'EditListingStripeOnboardingPage',
      auth: true,
      component: EditListingPage,
      loadData: pageDataLoadingAPI.EditListingPage.loadData,
      prioritizeLibraryLoading: {
        stripe: true,
      },
    },

    // Canonical path should be after the `/l/new` path since they
    // conflict and `new` is not a valid listing UUID.
    {
      path: '/l/:id',
      name: 'ListingPageCanonical',
      ...authForPrivateMarketplace,
      component: ListingPage,
      loadData: pageDataLoadingAPI.ListingPage.loadData,
      prioritizeLibraryLoading: {
        map: true,
      },
    },
    {
      path: '/u',
      name: 'ProfileBasePage',
      component: RedirectToLandingPage,
    },
    {
      path: '/u/:id',
      name: 'ProfilePage',
      ...authForPrivateMarketplace,
      component: ProfilePage,
      loadData: pageDataLoadingAPI.ProfilePage.loadData,
    },
    {
      path: '/u/:id/:variant',
      name: 'ProfilePageVariant',
      auth: true,
      component: ProfilePage,
      loadData: pageDataLoadingAPI.ProfilePage.loadData,
    },
    {
      path: '/profile-settings',
      name: 'ProfileSettingsPage',
      auth: true,
      authPage: 'LoginPage',
      component: ProfileSettingsPage,
    },

    // Note: authenticating with IdP (e.g. Facebook) expects that /login path exists
    // so that in the error case users can be redirected back to the LoginPage
    // In case you change this, remember to update the route in server/api/auth/loginWithIdp.js
    {
      path: '/login',
      name: 'LoginPage',
      component: AuthenticationPage,
      extraProps: { tab: 'login' },
    },
    {
      path: '/signup',
      name: 'SignupPage',
      component: AuthenticationPage,
      extraProps: { tab: 'signup' },
      loadData: pageDataLoadingAPI.AuthenticationPage.loadData,
    },
    {
      path: '/signup/:userType',
      name: 'SignupForUserTypePage',
      component: AuthenticationPage,
      extraProps: { tab: 'signup' },
      loadData: pageDataLoadingAPI.AuthenticationPage.loadData,
    },
    {
      path: '/confirm',
      name: 'ConfirmPage',
      component: AuthenticationPage,
      extraProps: { tab: 'confirm' },
      loadData: pageDataLoadingAPI.AuthenticationPage.loadData,
    },
    {
      path: '/recover-password',
      name: 'PasswordRecoveryPage',
      component: PasswordRecoveryPage,
    },
    {
      path: '/inbox',
      name: 'InboxBasePage',
      auth: true,
      authPage: 'LoginPage',
      component: () => <NamedRedirect name="InboxPage" params={{ tab: 'sales' }} />,
    },
    {
      path: '/inbox/:tab',
      name: 'InboxPage',
      auth: true,
      authPage: 'LoginPage',
      component: InboxPage,
      loadData: pageDataLoadingAPI.InboxPage.loadData,
    },
    {
      path: '/order/:id',
      name: 'OrderDetailsPage',
      auth: true,
      authPage: 'LoginPage',
      component: TransactionPage,
      extraProps: { transactionRole: 'customer' },
      loadData: (params, ...rest) =>
        pageDataLoadingAPI.TransactionPage.loadData({ ...params, transactionRole: 'customer' }, ...rest),
      setInitialValues: pageDataLoadingAPI.TransactionPage.setInitialValues,
    },
    {
      path: '/order/:id/details',
      name: 'OrderDetailsPageRedirect',
      auth: true,
      authPage: 'LoginPage',
      component: props => <NamedRedirect name="OrderDetailsPage" params={{ id: props.params?.id }} />,
    },
    {
      path: '/sale/:id',
      name: 'SaleDetailsPage',
      auth: true,
      authPage: 'LoginPage',
      component: TransactionPage,
      extraProps: { transactionRole: 'provider' },
      loadData: pageDataLoadingAPI.TransactionPage.loadData,
    },
    {
      path: '/sale/:id/details',
      name: 'SaleDetailsPageRedirect',
      auth: true,
      authPage: 'LoginPage',
      component: props => <NamedRedirect name="SaleDetailsPage" params={{ id: props.params?.id }} />,
    },
    {
      path: '/listings',
      name: 'ManageListingsPage',
      auth: true,
      authPage: 'LoginPage',
      component: ManageListingsPage,
      loadData: pageDataLoadingAPI.ManageListingsPage.loadData,
    },
    {
      path: '/account',
      name: 'AccountSettingsPage',
      auth: true,
      authPage: 'LoginPage',
      component: () => <NamedRedirect name="ContactDetailsPage" />,
    },
    {
      path: '/account/contact-details',
      name: 'ContactDetailsPage',
      auth: true,
      authPage: 'LoginPage',
      component: ContactDetailsPage,
      loadData: pageDataLoadingAPI.ContactDetailsPage.loadData,
    },
    {
      path: '/account/change-password',
      name: 'PasswordChangePage',
      auth: true,
      authPage: 'LoginPage',
      component: PasswordChangePage,
    },
    {
      path: '/account/payments',
      name: 'StripePayoutPage',
      auth: true,
      authPage: 'LoginPage',
      component: StripePayoutPage,
      loadData: pageDataLoadingAPI.StripePayoutPage.loadData,
      prioritizeLibraryLoading: {
        stripe: true,
      },
    },
    {
      path: '/account/payments/:returnURLType',
      name: 'StripePayoutOnboardingPage',
      auth: true,
      authPage: 'LoginPage',
      component: StripePayoutPage,
      loadData: pageDataLoadingAPI.StripePayoutPage.loadData,
      prioritizeLibraryLoading: {
        stripe: true,
      },
    },
    {
      // Brands land here from a gated action or from the account menu. Stripe
      // Checkout returns to this path with ?status=success|canceled.
      path: '/subscription',
      name: 'SubscriptionPage',
      auth: true,
      authPage: 'LoginPage',
      component: SubscriptionPage,
    },
    {
      // Brand's home base after login (see AuthenticationPage.js redirect).
      path: '/creators',
      name: 'ExploreCreatorsPage',
      auth: true,
      authPage: 'LoginPage',
      component: ExploreCreatorsPage,
    },
    {
      // "My Campaigns" nav item in DashboardTopbar — status-based view of
      // the brand's own CGC UGC transactions (see ManageCampaignsPage.js).
      path: '/campaigns',
      name: 'ManageCampaignsPage',
      auth: true,
      authPage: 'LoginPage',
      component: ManageCampaignsPage,
    },
    {
      // "New project" button on ManageCampaignsPage — a purpose-built form
      // for posting a project listing (see PostProjectPage.js), instead
      // of routing into the general EditListingPage wizard.
      path: '/projects/new',
      name: 'PostProjectPage',
      auth: true,
      authPage: 'LoginPage',
      component: PostProjectPage,
    },
    {
      // "Collab" button on ExploreCreatorsPage — a purpose-built profile page
      // for a creator (package details, reviews, invite-to-a-project form),
      // instead of routing into the generic ListingPage. :id is the
      // creator's published creator-profile listing id.
      path: '/creators/:id',
      name: 'CreatorProfilePage',
      auth: true,
      authPage: 'LoginPage',
      component: CreatorProfilePage,
    },
    {
      // A brand's saved creators (CGC-FRONTEND-PLAN.md §4.2), linked from the inbox.
      path: '/roster',
      name: 'RosterPage',
      auth: true,
      authPage: 'LoginPage',
      component: RosterPage,
    },
    {
      // Code-only page, not managed through Console/PageBuilder.
      path: '/brand-onboarding',
      name: 'BrandOnboardingPage',
      auth: true,
      authPage: 'LoginPage',
      component: BrandOnboardingPage,
    },
    {
      // Creator application form (F4.1) — landed on right after signup while
      // the account is in Sharetribe's built-in pending-approval state (see
      // AuthenticationPage.js's redirect). auth: true so a pending user can
      // still reach it (only isUserAuthorized-gated pages should ever block
      // pending users, and this deliberately isn't one).
      path: '/apply',
      name: 'ApplyPage',
      auth: true,
      authPage: 'LoginPage',
      component: ApplyPage,
    },
    {
      // Brand access-request form (F4.1 / BLUEPRINT B2) — same timing as
      // ApplyPage above, for the brand side.
      path: '/request-access',
      name: 'RequestAccessPage',
      auth: true,
      authPage: 'LoginPage',
      component: RequestAccessPage,
    },
    {
      // Shown after submitting either form above, while still pending
      // approval (F4.1 / BLUEPRINT B3).
      path: '/pending',
      name: 'PendingPage',
      auth: true,
      authPage: 'LoginPage',
      component: PendingPage,
    },
    {
      // Creator's home base after login (see AuthenticationPage.js redirect).
      path: '/projects',
      name: 'BrowseProjectsPage',
      auth: true,
      authPage: 'LoginPage',
      component: BrowseProjectsPage,
    },
    {
      // "View project" link on BrowseProjectsPage — a purpose-built project page
      // (brand's project details + an apply form), instead of routing into
      // the generic ListingPage. :id is the project listing id.
      path: '/projects/:id',
      name: 'ProjectDetailPage',
      auth: true,
      authPage: 'LoginPage',
      component: ProjectDetailPage,
    },
    {
      // "Edit project" from ProjectDetailPage's owner-view menu — reuses
      // PostProjectForm pre-filled from the existing listing (see
      // EditProjectPage.js). :id is the project listing id.
      path: '/projects/:id/edit',
      name: 'EditProjectPage',
      auth: true,
      authPage: 'LoginPage',
      component: EditProjectPage,
    },
    {
      // "Invite creators" from ProjectDetailPage's owner view (F2.5) — a
      // brand picks a creator to invite to this specific project. :id is the
      // project listing id.
      path: '/projects/:id/invite',
      name: 'ProjectInvitePage',
      auth: true,
      authPage: 'LoginPage',
      component: ProjectInvitePage,
    },
    {
      // "Proceed to payment" from an ACCEPTED applicant card on
      // ProjectDetailPage's owner view (F2.6) — B9's confirm-the-deal-then-pay
      // screen. :id is the project listing id; ?applicationId=<uuid> picks
      // which accepted application this checkout is for.
      path: '/projects/:id/accept',
      name: 'ProjectAcceptPage',
      auth: true,
      authPage: 'LoginPage',
      component: ProjectAcceptPage,
    },
    {
      // "My Collaborations" nav item in DashboardTopbar — status-based view
      // of the creator's own CGC UGC transactions, plus a tab for their
      // pending project applications (see MyCollaborationsPage.js).
      path: '/collaborations',
      name: 'MyCollaborationsPage',
      auth: true,
      authPage: 'LoginPage',
      component: MyCollaborationsPage,
    },
    {
      // Creator's earnings breakdown (F8.2): paid out / awaiting review /
      // held, from the creator's own cgc-ugc-approval sale transactions.
      path: '/earnings',
      name: 'EarningsPage',
      auth: true,
      authPage: 'LoginPage',
      component: EarningsPage,
    },
    {
      // Creator's setup checklist: approval status, profile, package listing,
      // Stripe payout — linked from BrowseProjectsPage/MyCollaborationsPage
      // whenever setup is incomplete (see CreatorSetupBanner.js).
      path: '/creator-onboarding',
      name: 'CreatorOnboardingPage',
      auth: true,
      authPage: 'LoginPage',
      component: CreatorOnboardingPage,
    },
    {
      // A creator's own editable package (details + photos) — this *is*
      // their creator-profile listing, edited through a purpose-built page
      // instead of the generic EditListingWizard (see CreatorPackagePage.js).
      // Linked from CreatorOnboardingPage/CreatorSetupBanner and
      // DashboardTopbar's "My Creator Profile" nav item.
      path: '/creator-package',
      name: 'CreatorPackagePage',
      auth: true,
      authPage: 'LoginPage',
      component: CreatorPackagePage,
    },
    {
      // A creator's own default shipping address (F4.2) — one step in the
      // onboarding checklist, saved to privateData so it can prefill the
      // per-collaboration "addShippingAddress" modal later.
      path: '/account/shipping-address',
      name: 'ShippingAddressPage',
      auth: true,
      authPage: 'LoginPage',
      component: ShippingAddressPage,
    },
    {
      // Operator console (F5.1). auth:true only confirms someone is logged
      // in — the real operator check happens server-side on every visit
      // (AdminPage.js calls /api/admin/status), since userType alone can't
      // be trusted as proof (see server/api-util/operator.js).
      path: '/admin',
      name: 'AdminPage',
      auth: true,
      authPage: 'LoginPage',
      component: AdminPage,
    },
    {
      // Application queue (F5.2) — pending-approval creators and brands,
      // gated the same server-verified way as AdminPage.
      path: '/admin/applications',
      name: 'AdminApplicationsPage',
      auth: true,
      authPage: 'LoginPage',
      component: AdminApplicationsPage,
    },
    {
      // Invite codes (F5.3) — gated the same server-verified way.
      path: '/admin/invites',
      name: 'AdminInvitesPage',
      auth: true,
      authPage: 'LoginPage',
      component: AdminInvitesPage,
    },
    {
      // Dispute mediation (F5.3).
      path: '/admin/disputes',
      name: 'AdminDisputesPage',
      auth: true,
      authPage: 'LoginPage',
      component: AdminDisputesPage,
    },
    {
      // Network health dashboard (F5.3).
      path: '/admin/health',
      name: 'AdminHealthPage',
      auth: true,
      authPage: 'LoginPage',
      component: AdminHealthPage,
    },
    {
      // Frozen, printable license record for a completed collaboration
      // (F6.1) — viewable once the transaction has reached `received`.
      path: '/collaborations/:id/license',
      name: 'LicensePage',
      auth: true,
      authPage: 'LoginPage',
      component: LicensePage,
    },
    {
      // Brand's content library (F6.2) — deliberately NOT subscription-gated
      // (BLUEPRINT D5): access to already-delivered assets survives a
      // lapsed subscription, only starting new work is blocked.
      path: '/library',
      name: 'LibraryPage',
      auth: true,
      authPage: 'LoginPage',
      component: LibraryPage,
    },
    {
      path: '/account/payment-methods',
      name: 'PaymentMethodsPage',
      auth: true,
      authPage: 'LoginPage',
      component: PaymentMethodsPage,
      loadData: pageDataLoadingAPI.PaymentMethodsPage.loadData,
      prioritizeLibraryLoading: {
        stripe: true,
      },
    },
    {
      path: '/account/manage',
      name: 'ManageAccountPage',
      auth: true,
      authPage: 'LoginPage',
      component: ManageAccountPage,
    },
    {
      path: '/terms-of-service',
      name: 'TermsOfServicePage',
      component: TermsOfServicePage,
      loadData: pageDataLoadingAPI.TermsOfServicePage.loadData,
    },
    {
      path: '/privacy-policy',
      name: 'PrivacyPolicyPage',
      component: PrivacyPolicyPage,
      loadData: pageDataLoadingAPI.PrivacyPolicyPage.loadData,
    },
    {
      path: '/styleguide',
      name: 'Styleguide',
      ...authForPrivateMarketplace,
      component: StyleguidePage,
    },
    {
      path: '/styleguide/g/:group',
      name: 'StyleguideGroup',
      ...authForPrivateMarketplace,
      component: StyleguidePage,
    },
    {
      path: '/styleguide/c/:component',
      name: 'StyleguideComponent',
      ...authForPrivateMarketplace,
      component: StyleguidePage,
    },
    {
      path: '/styleguide/c/:component/:example',
      name: 'StyleguideComponentExample',
      ...authForPrivateMarketplace,
      component: StyleguidePage,
    },
    {
      path: '/styleguide/c/:component/:example/raw',
      name: 'StyleguideComponentExampleRaw',
      ...authForPrivateMarketplace,
      component: StyleguidePage,
      extraProps: { raw: true },
    },
    {
      path: '/no-:missingAccessRight',
      name: 'NoAccessPage',
      component: NoAccessPage,
    },
    {
      path: '/notfound',
      name: 'NotFoundPage',
      component: props => <NotFoundPage {...props} />,
    },

    // Do not change this path!
    //
    // The API expects that the application implements /reset-password endpoint
    {
      path: '/reset-password',
      name: 'PasswordResetPage',
      component: PasswordResetPage ,
    },

    // Do not change this path!
    //
    // The API expects that the application implements /verify-email endpoint
    {
      path: '/verify-email',
      name: 'EmailVerificationPage',
      auth: true,
      authPage: 'LoginPage',
      component: EmailVerificationPage,
      loadData: pageDataLoadingAPI.EmailVerificationPage.loadData,
    },
    // Do not change this path!
    //
    // The API expects that the application implements /preview endpoint
    {
      path: '/preview',
      name: 'PreviewResolverPage',
      component: PreviewResolverPage ,
    },
  ];
};

export default routeConfiguration;
