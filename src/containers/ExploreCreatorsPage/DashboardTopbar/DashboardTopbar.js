import React, { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';

import { useRouteConfiguration } from '../../../context/routeConfigurationContext';
import { FormattedMessage } from '../../../util/reactIntl';
import { pathByRouteName } from '../../../util/routes';
import { fetchOwnCreatorProfileThunk } from '../../../ducks/creatorProfile.duck';
import {
  NamedLink,
  LinkedLogo,
  Menu,
  MenuLabel,
  MenuContent,
  MenuItem,
  AvatarSmall,
} from '../../../components';
import {
  IconProfile,
  IconBrand,
  IconSubscription,
  IconLogout,
  IconChat,
} from './accountMenuIcons';

import css from './DashboardTopbar.module.css';

// Nav items shared by every brand dashboard page that renders this header.
const BRAND_NAV_ITEMS = [
  { routeName: 'ExploreCreatorsPage', labelId: 'DashboardTopbar.exploreCreators' },
  { routeName: 'ManageCampaignsPage', labelId: 'DashboardTopbar.myCampaigns' },
];

// Nav items shared by every creator dashboard page that renders this header.
const CREATOR_NAV_ITEMS = [
  { routeName: 'BrowseProjectsPage', labelId: 'DashboardTopbar.browseProjects' },
  { routeName: 'MyCollaborationsPage', labelId: 'DashboardTopbar.myCollaborations' },
];

/**
 * Header for the dashboard pages (ExploreCreatorsPage, ManageCampaignsPage on
 * the brand side; BrowseProjectsPage, MyCollaborationsPage on the creator
 * side), kept deliberately separate from the shared TopbarContainer used on
 * the landing page and the rest of the marketplace — this one is scoped to
 * the current user's own workspace, so it only needs the nav items relevant
 * to their role.
 *
 * The avatar opens an account dropdown (profile, public profile link,
 * subscription for brands, logout) instead of linking straight to
 * ManageAccountPage. Reads currentUser directly via useSelector rather than
 * through props, since it needs more than just the display name here.
 *
 * @param {Object} props
 * @param {string?} props.displayName - Current user's display name, shown in the account dropdown
 * @param {string} props.currentPage - Route name of the page rendering this header, for the active nav state
 * @param {'brand'|'creator'} [props.role] - Which nav item set to show. Defaults to 'brand'.
 * @param {Function} props.onLogout
 * @returns {JSX.Element}
 */
const DashboardTopbar = props => {
  const { displayName, currentPage, role = 'brand', onLogout } = props;
  const history = useHistory();
  const dispatch = useDispatch();
  const routeConfiguration = useRouteConfiguration();
  const currentUser = useSelector(state => state.user?.currentUser);
  const ownProfileListing = useSelector(state => state.creatorProfile?.ownProfileListing);

  const isCreator = role === 'creator';

  useEffect(() => {
    if (isCreator) {
      dispatch(fetchOwnCreatorProfileThunk()).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreator]);

  const navItems = isCreator ? CREATOR_NAV_ITEMS : BRAND_NAV_ITEMS;
  const email = currentUser?.attributes?.email;

  const handleLogout = () => {
    onLogout().then(() => {
      const path = pathByRouteName('LandingPage', routeConfiguration);
      history.push(path);
    });
  };

  // A creator's "public profile" is their published creator-profile listing
  // (the same page a brand sees via the "Collab" button). Until they've
  // published one, send them straight to the page that creates/edits it
  // (CreatorPackagePage) instead of linking somewhere empty. A brand's
  // public profile is just their regular user profile, since there's no
  // separate brand-identity page.
  const publicProfile = isCreator
    ? {
        labelId: 'DashboardTopbar.myCreatorProfile',
        routeName: ownProfileListing ? 'CreatorProfilePage' : 'CreatorPackagePage',
        params: ownProfileListing ? { id: ownProfileListing.id.uuid } : undefined,
      }
    : currentUser?.id
    ? { labelId: 'DashboardTopbar.myBrand', routeName: 'ProfilePage', params: { id: currentUser.id.uuid } }
    : null;

  return (
    <div className={css.root}>
      <LinkedLogo layout="desktop" rootClassName={css.logo} />

      <nav className={css.nav}>
        {navItems.map(item => (
          <NamedLink
            key={item.routeName}
            name={item.routeName}
            className={classNames(css.navLink, {
              [css.navLinkActive]: currentPage === item.routeName,
            })}
          >
            <FormattedMessage id={item.labelId} />
          </NamedLink>
        ))}
      </nav>

      <div className={css.right}>
        <Menu contentPosition="left" useArrow={false}>
          <MenuLabel className={css.accountMenuLabel} isOpenClassName={css.accountMenuIsOpen}>
            <AvatarSmall user={currentUser} disableProfileLink />
          </MenuLabel>
          <MenuContent className={css.accountMenuContent}>
            <MenuItem key="identity">
              <NamedLink name="ManageAccountPage" className={css.accountMenuHeader}>
                <AvatarSmall className={css.accountMenuHeaderAvatar} user={currentUser} disableProfileLink />
                <div className={css.accountMenuHeaderText}>
                  <span className={css.accountMenuName}>{displayName}</span>
                  {email ? <span className={css.accountMenuEmail}>{email}</span> : null}
                </div>
              </NamedLink>
            </MenuItem>
            <MenuItem key="profile">
              <NamedLink name="ProfileSettingsPage" className={css.accountMenuLink}>
                <IconProfile />
                <FormattedMessage id="DashboardTopbar.profile" />
              </NamedLink>
            </MenuItem>
            {publicProfile ? (
              <MenuItem key="public-profile">
                <NamedLink
                  name={publicProfile.routeName}
                  params={publicProfile.params}
                  className={css.accountMenuLink}
                >
                  <IconBrand />
                  <FormattedMessage id={publicProfile.labelId} />
                </NamedLink>
              </MenuItem>
            ) : null}
            {!isCreator ? (
              <MenuItem key="subscription">
                <NamedLink name="SubscriptionPage" className={css.accountMenuLink}>
                  <IconSubscription />
                  <FormattedMessage id="DashboardTopbar.subscriptionPlan" />
                </NamedLink>
              </MenuItem>
            ) : null}
            <MenuItem key="inbox">
              <NamedLink name="InboxBasePage" className={css.accountMenuLink}>
                <IconChat />
                <FormattedMessage id="DashboardTopbar.inbox" />
              </NamedLink>
            </MenuItem>
            <MenuItem key="logout">
              <button type="button" className={css.accountMenuLogout} onClick={handleLogout}>
                <IconLogout />
                <FormattedMessage id="DashboardTopbar.logout" />
              </button>
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
};

export default DashboardTopbar;
