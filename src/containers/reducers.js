/**
 * Export reducers from ducks modules of different containers (i.e. default export)
 * We are following Ducks module proposition:
 * https://github.com/erikras/ducks-modular-redux
 */
import BrowseProjectsPage from './BrowseProjectsPage/BrowseProjectsPage.duck';
import CheckoutPage from './CheckoutPage/CheckoutPage.duck';
import ContactDetailsPage from './ContactDetailsPage/ContactDetailsPage.duck';
import CreatorPackagePage from './CreatorPackagePage/CreatorPackagePage.duck';
import EditListingPage from './EditListingPage/EditListingPage.duck';
import ExploreCreatorsPage from './ExploreCreatorsPage/ExploreCreatorsPage.duck';
import InboxPage from './InboxPage/InboxPage.duck';
import ListingPage from './ListingPage/ListingPage.duck';
import MakeOfferPage from './MakeOfferPage/MakeOfferPage.duck';
import ManageCampaignsPage from './ManageCampaignsPage/ManageCampaignsPage.duck';
import ManageListingsPage from './ManageListingsPage/ManageListingsPage.duck';
import MyCollaborationsPage from './MyCollaborationsPage/MyCollaborationsPage.duck';
import PasswordChangePage from './PasswordChangePage/PasswordChangePage.duck';
import PasswordRecoveryPage from './PasswordRecoveryPage/PasswordRecoveryPage.duck';
import PasswordResetPage from './PasswordResetPage/PasswordResetPage.duck';
import PaymentMethodsPage from './PaymentMethodsPage/PaymentMethodsPage.duck';
import ManageAccountPage from './ManageAccountPage/ManageAccountPage.duck';
import PostProjectPage from './PostProjectPage/PostProjectPage.duck';
import ProfilePage from './ProfilePage/ProfilePage.duck';
import ProfileSettingsPage from './ProfileSettingsPage/ProfileSettingsPage.duck';
import RequestQuotePage from './RequestQuotePage/RequestQuotePage.duck';
import RosterPage from './RosterPage/RosterPage.duck';
import SearchPage from './SearchPage/SearchPage.duck';
import StripePayoutPage from './StripePayoutPage/StripePayoutPage.duck';
import TransactionPage from './TransactionPage/TransactionPage.duck';

export {
  BrowseProjectsPage,
  CheckoutPage,
  ContactDetailsPage,
  CreatorPackagePage,
  EditListingPage,
  ExploreCreatorsPage,
  InboxPage,
  ListingPage,
  MakeOfferPage,
  ManageCampaignsPage,
  ManageListingsPage,
  MyCollaborationsPage,
  PasswordChangePage,
  PasswordRecoveryPage,
  PasswordResetPage,
  PaymentMethodsPage,
  ManageAccountPage,
  PostProjectPage,
  ProfilePage,
  ProfileSettingsPage,
  RequestQuotePage,
  RosterPage,
  SearchPage,
  StripePayoutPage,
  TransactionPage,
};
