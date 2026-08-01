import React, { useEffect, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { fetchOwnCreatorProfileThunk } from '../../ducks/creatorProfile.duck';
import { isBrandUserType, isUserAuthorized } from '../../util/userHelpers';
import { getProjectFieldLabels } from '../../util/creatorFields';
import { formatDateIntoPartials } from '../../util/dates';
import { fetchProjectsThunk } from './BrowseProjectsPage.duck';

import { Heading, Page, LayoutSingleColumn, IconSpinner, Avatar, NamedLink, NamedRedirect } from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import CreatorSetupBanner from '../CreatorOnboardingPage/CreatorSetupBanner';

import css from './BrowseProjectsPage.module.css';

// Filter tabs mirroring ExploreCreatorsPage's composition on the brand side.
// "all" always works; "my-niche"/"my-platforms" need the creator's own
// package listing to filter against (see fetchOwnCreatorProfileThunk) and
// are disabled with a tooltip until that exists. "top-brands"/"invited" need
// data this app doesn't model yet (brand reputation, direct invitations), so
// they're shown but disabled rather than faked.
const FILTER_TABS = [
  { id: 'all', labelId: 'BrowseProjectsPage.filterAll', enabled: true },
  { id: 'my-niche', labelId: 'BrowseProjectsPage.filterMyNiche', enabled: true, needsProfile: true },
  {
    id: 'my-platforms',
    labelId: 'BrowseProjectsPage.filterMyPlatforms',
    enabled: true,
    needsProfile: true,
  },
  { id: 'top-brands', labelId: 'BrowseProjectsPage.filterTopBrands', enabled: false },
  { id: 'invited', labelId: 'BrowseProjectsPage.filterInvited', enabled: false },
];

const ProjectCard = ({ project, listingFieldsConfig, isAuthorized, intl }) => {
  const { title, description, publicData, createdAt } = project.attributes;
  const { nicheLabels, platformLabels, budgetRangeLabel, deadline } = getProjectFieldLabels(
    publicData,
    listingFieldsConfig
  );
  const author = project.author;
  const brandName = author?.attributes?.profile?.displayName;
  const postedOn = createdAt ? formatDateIntoPartials(createdAt, intl).date : null;

  return (
    <li className={css.card}>
      <div className={css.cardHeader}>
        <Avatar user={author} className={css.avatar} disableProfileLink />
        <span className={css.brandName}>{brandName}</span>
      </div>

      <h3 className={css.projectTitle}>{title}</h3>
      {description ? <p className={css.description}>{description}</p> : null}

      {nicheLabels.length > 0 || platformLabels.length > 0 ? (
        <div className={css.chipRow}>
          {nicheLabels.map(label => (
            <span key={label} className={css.chip}>
              {label}
            </span>
          ))}
          {platformLabels.map(label => (
            <span key={label} className={css.chip}>
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <div className={css.metaRow}>
        {budgetRangeLabel ? <span className={css.budgetBadge}>{budgetRangeLabel}</span> : null}
        {deadline ? (
          <span className={css.deadline}>
            <FormattedMessage id="BrowseProjectsPage.deadlineLabel" values={{ deadline }} />
          </span>
        ) : null}
      </div>

      {postedOn ? (
        <p className={css.postedOn}>
          <FormattedMessage id="BrowseProjectsPage.postedOn" values={{ date: postedOn }} />
        </p>
      ) : null}

      {isAuthorized ? (
        <NamedLink className={css.viewButton} name="ProjectDetailPage" params={{ id: project.id.uuid }}>
          <FormattedMessage id="BrowseProjectsPage.viewProject" />
        </NamedLink>
      ) : (
        <button
          type="button"
          className={classNames(css.viewButton, css.viewButtonDisabled)}
          disabled
          title={intl.formatMessage({ id: 'BrowseProjectsPage.pendingApprovalTooltip' })}
        >
          <FormattedMessage id="BrowseProjectsPage.viewProject" />
        </button>
      )}
    </li>
  );
};

/**
 * Creator's "browse projects" dashboard — the home base a creator lands on
 * after login (see AuthenticationPage.js redirect / getRoleHomeRouteName).
 * Composition mirrors ExploreCreatorsPage on the brand side (heading, filter
 * tabs, card grid), just listing project-brief listings posted by brands
 * instead of creator accounts.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled
 * @param {Array<Object>} props.projects
 * @param {boolean} props.fetchInProgress
 * @param {propTypes.error} props.fetchError
 * @param {Function} props.onFetchProjects
 * @param {propTypes.currentUser} props.currentUser
 * @param {Object} props.creatorProfile - state.creatorProfile
 * @param {Function} props.onFetchOwnCreatorProfile
 * @param {Function} props.onLogout
 * @returns {JSX.Element}
 */
export const BrowseProjectsPageComponent = props => {
  const intl = useIntl();
  const config = useConfiguration();
  const {
    scrollingDisabled,
    projects,
    fetchInProgress,
    fetchError,
    onFetchProjects,
    currentUser,
    creatorProfile,
    onFetchOwnCreatorProfile,
    onLogout,
  } = props;

  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    onFetchProjects();
    onFetchOwnCreatorProfile();
  }, [onFetchProjects, onFetchOwnCreatorProfile]);

  if (isBrandUserType(config, currentUser)) {
    return <NamedRedirect name="ExploreCreatorsPage" />;
  }

  const title = intl.formatMessage(
    { id: 'BrowseProjectsPage.schemaTitle' },
    { marketplaceName: config.marketplaceName }
  );

  const displayName = currentUser?.attributes?.profile?.displayName;
  const isAuthorized = isUserAuthorized(currentUser);
  const ownProfileListing = creatorProfile?.ownProfileListing;
  const ownPublicData = ownProfileListing?.attributes?.publicData || {};

  const matchesOwnValues = (projectValues = [], ownValues = []) =>
    projectValues.some(v => ownValues.includes(v));

  const visibleProjects = projects.filter(project => {
    const publicData = project.attributes.publicData || {};
    if (activeFilter === 'my-niche') {
      return matchesOwnValues(publicData.contentNiche, ownPublicData.contentNiche);
    }
    if (activeFilter === 'my-platforms') {
      return matchesOwnValues(publicData.platforms, ownPublicData.platforms);
    }
    return true;
  });

  const hasResults = visibleProjects.length > 0;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage="BrowseProjectsPage"
            role="creator"
            onLogout={onLogout}
          />
        }
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="BrowseProjectsPage.heading" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="BrowseProjectsPage.subtitle" />
          </p>

          <CreatorSetupBanner
            currentUser={currentUser}
            ownProfileListing={ownProfileListing}
            className={css.setupBanner}
          />

          <div className={css.filterRow}>
            <button type="button" className={css.filtersButton}>
              <FormattedMessage id="BrowseProjectsPage.filtersButton" />
            </button>
            {FILTER_TABS.map(tab => {
              const disabled = !tab.enabled || (tab.needsProfile && !ownProfileListing);
              const tooltipId = !tab.enabled
                ? 'BrowseProjectsPage.filterComingSoon'
                : tab.needsProfile && !ownProfileListing
                ? 'BrowseProjectsPage.filterNeedsProfile'
                : null;
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={disabled}
                  title={tooltipId ? intl.formatMessage({ id: tooltipId }) : undefined}
                  className={classNames(css.filterTab, {
                    [css.filterTabActive]: activeFilter === tab.id,
                    [css.filterTabDisabled]: disabled,
                  })}
                  onClick={() => !disabled && setActiveFilter(tab.id)}
                >
                  <FormattedMessage id={tab.labelId} />
                </button>
              );
            })}
          </div>

          {fetchError ? (
            <p className={css.error}>
              <FormattedMessage id="BrowseProjectsPage.fetchFailed" />
            </p>
          ) : null}

          {fetchInProgress ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : hasResults ? (
            <ul className={css.grid}>
              {visibleProjects.map(project => (
                <ProjectCard
                  key={project.id.uuid}
                  project={project}
                  listingFieldsConfig={config.listing.listingFields}
                  isAuthorized={isAuthorized}
                  intl={intl}
                />
              ))}
            </ul>
          ) : (
            <p className={css.noResults}>
              <FormattedMessage
                id={
                  activeFilter === 'all'
                    ? 'BrowseProjectsPage.noResults'
                    : 'BrowseProjectsPage.noMatches'
                }
              />
            </p>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { projectRefs, fetchInProgress, fetchError } = state.BrowseProjectsPage;
  const { currentUser } = state.user;
  return {
    scrollingDisabled: isScrollingDisabled(state),
    projects: getMarketplaceEntities(state, projectRefs),
    fetchInProgress,
    fetchError,
    currentUser,
    creatorProfile: state.creatorProfile,
  };
};

const mapDispatchToProps = dispatch => ({
  onFetchProjects: () => dispatch(fetchProjectsThunk()),
  onFetchOwnCreatorProfile: () => dispatch(fetchOwnCreatorProfileThunk()),
  onLogout: () => dispatch(logout()),
});

const BrowseProjectsPage = compose(connect(mapStateToProps, mapDispatchToProps))(
  BrowseProjectsPageComponent
);

export default BrowseProjectsPage;
