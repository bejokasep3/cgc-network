import React, { useEffect, useMemo, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { fetchCurrentUserHasListings } from '../../ducks/user.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { formatDateIntoPartials } from '../../util/dates';
import { isUserAuthorized } from '../../util/userHelpers';
import { parse, stringify } from '../../util/urlHelpers';
import { createResourceLocatorString } from '../../util/routes';
import {
  fetchCampaignsThunk,
  fetchOwnProjectsThunk,
  fetchProjectApplicationsThunk,
  setProjectVisibilityThunk,
} from './ManageCampaignsPage.duck';
import { deriveCampaign } from './campaignData';
import { states as ugcStates } from '../../transactions/transactionProcessCGCUGC';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  NamedLink,
  NamedRedirect,
  IconSpinner,
  UserDisplayName,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import BrandSetupBanner from '../BrandOnboardingPage/BrandSetupBanner';
import VisibilityToggle from './VisibilityToggle';

import css from './ManageCampaignsPage.module.css';

const formatDate = (date, intl) => (date ? formatDateIntoPartials(date, intl).date : null);

// Matches ProjectDetailPage.js's APPLICANTS_ANCHOR — the "N applicants" link
// below jumps straight to that section instead of the top of the page.
const APPLICANTS_ANCHOR = 'applicants';

// Kept in the URL (?tab=) rather than local state, so the overview cards on
// ProjectDetailPage can deep-link back to a specific tab (e.g. "Products to
// ship" -> /campaigns?tab=ongoing&ship=need-to-ship) instead of always
// landing on "Listed".
const TAB_IDS = ['listed', 'ongoing'];
const DEFAULT_TAB_ID = TAB_IDS[0];

// A project's ongoing collaborations can be in different buckets at once
// (one creator awaiting review, another already completed) — pick the single
// most-urgent category to represent the whole project in the Task table.
const taskStatusCategory = stats => {
  if (stats.hasNeedsReview) return 'needs-review';
  if (stats.hasInProgress) return 'in-progress';
  return 'completed';
};

const TASK_STATUS_LABEL_ID = {
  'needs-review': 'ManageCampaignsPage.taskStatusNeedsReview',
  'in-progress': 'ManageCampaignsPage.taskStatusInProgress',
  completed: 'ManageCampaignsPage.taskStatusCompleted',
};

const TASK_STATUS_CLASS = {
  'needs-review': 'taskStatusNeedsReview',
  'in-progress': 'taskStatusInProgress',
  completed: 'taskStatusCompleted',
};

// Same idea as taskStatusCategory: a project can have several ongoing
// collaborations at once, so pick one shipping status to represent the whole
// row — whichever needs the brand's attention most. 'no-product' only when
// none of the project's collaborations ever required shipping at all (an
// organic-content-only project), so it doesn't get confused with "nothing
// pending right now" (which is every collaboration already past shipping).
const SHIPPING_STATUS_LABEL_ID = {
  'need-to-ship': 'ManageCampaignsPage.shipmentStateDueToShip',
  shipped: 'ManageCampaignsPage.shipmentStateShipped',
  'no-product': 'ManageCampaignsPage.shippingNoProduct',
};
const shippingStatusCategory = stats => {
  if (stats.hasNeedsShip) return 'need-to-ship';
  if (stats.hasShipped) return 'shipped';
  if (!stats.hasShippable) return 'no-product';
  return null;
};

// One row per project listing (not per transaction) — applicants and
// collaborations are both rolled up onto the project they belong to, instead
// of living on a separate "Collaborations" view, so a brand sees everything
// about a project in one place.
const ProjectRow = ({
  project,
  applicantCount,
  actionsRequiredCount,
  ordersCount,
  isToggling,
  onToggleVisibility,
  intl,
}) => {
  const history = useHistory();
  const routeConfiguration = useRouteConfiguration();
  const { title, state, createdAt } = project.attributes;
  const isDraft = state === 'draft';
  const isPublished = state === 'published';

  // The whole row is the click target (not the title or applicant count
  // individually) — straight into the applicant list rather than the top of
  // the project page when there's something to approve, since that's what
  // the brand is after.
  const goToProject = () => {
    const hash = applicantCount > 0 ? `#${APPLICANTS_ANCHOR}` : '';
    history.push(
      createResourceLocatorString(
        'ProjectDetailPage',
        routeConfiguration,
        { id: project.id.uuid },
        {},
        hash
      )
    );
  };

  return (
    <div
      className={css.projectRow}
      onClick={goToProject}
      role="link"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          goToProject();
        }
      }}
    >
      <div className={css.rowInfo}>
        <span className={css.rowTitle}>{title}</span>
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colCreatorsToApprove' })}
      >
        {applicantCount > 0 ? (
          <span className={css.rowHighlight}>
            <FormattedMessage
              id="ManageCampaignsPage.applicantsCount"
              values={{ count: applicantCount }}
            />
          </span>
        ) : (
          '—'
        )}
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colActionsRequired' })}
      >
        {actionsRequiredCount > 0 ? (
          <span className={css.dueBadge}>{actionsRequiredCount}</span>
        ) : (
          '—'
        )}
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colOrders' })}
      >
        {ordersCount}
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colPosted' })}
      >
        {formatDate(createdAt, intl) || '—'}
      </div>
      <div
        className={css.rowPayment}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colVisibility' })}
        onClick={e => e.stopPropagation()}
      >
        {isDraft ? (
          <span className={css.visibilityBadge}>
            <FormattedMessage id="ManageCampaignsPage.visibilityDraft" />
          </span>
        ) : (
          <VisibilityToggle
            isPublished={isPublished}
            isToggling={isToggling}
            onToggle={onToggleVisibility}
            ariaLabel={intl.formatMessage({
              id: isPublished
                ? 'ManageCampaignsPage.visibilityPublished'
                : 'ManageCampaignsPage.visibilityClosed',
            })}
          />
        )}
      </div>
    </div>
  );
};

// "Ongoing" tab row: one project with all its active collaborations rolled
// up into aggregate counts (status/progress/shipping), instead of the
// per-project posting details ProjectRow shows.
const TaskRow = ({ project, stats, intl }) => {
  const history = useHistory();
  const routeConfiguration = useRouteConfiguration();
  const { title } = project.attributes;
  const shippingCategory = shippingStatusCategory(stats);
  const statusCategory = taskStatusCategory(stats);
  // A project is matched to exactly one creator, so "Ongoing" already means
  // there's exactly one collaboration to jump into — go straight to it
  // instead of the project posting page. Falls back to ProjectDetailPage for
  // a stray pre-lock project that somehow still has more than one (or, in
  // principle, zero) collaboration, where there's no single obvious target.
  const singleCollaborationTx = stats.orders === 1 ? stats.collaborationTx : null;

  const goToCollaboration = () => {
    if (singleCollaborationTx) {
      history.push(
        createResourceLocatorString('OrderDetailsPage', routeConfiguration, {
          id: singleCollaborationTx.id.uuid,
        })
      );
      return;
    }
    history.push(
      createResourceLocatorString('ProjectDetailPage', routeConfiguration, {
        id: project.id.uuid,
      })
    );
  };

  return (
    <div
      className={css.taskRow}
      onClick={goToCollaboration}
      role="link"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          goToCollaboration();
        }
      }}
    >
      <div className={css.rowInfo}>
        <span className={css.rowTitle}>{title}</span>
        {stats.provider ? (
          <span className={css.rowSubtitle}>
            <UserDisplayName user={stats.provider} intl={intl} />
          </span>
        ) : null}
      </div>
      <div
        className={classNames(css.rowDate, css.taskStatus, css[TASK_STATUS_CLASS[statusCategory]])}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colStatus' })}
      >
        <FormattedMessage id={TASK_STATUS_LABEL_ID[statusCategory]} />
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colProgress' })}
      >
        <FormattedMessage
          id="ManageCampaignsPage.taskProgress"
          values={{ approved: stats.videosApproved, total: stats.orders }}
        />
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colShipping' })}
      >
        {shippingCategory ? <FormattedMessage id={SHIPPING_STATUS_LABEL_ID[shippingCategory]} /> : '—'}
      </div>
    </div>
  );
};

/**
 * Brand's project management dashboard, replacing the Roster link in
 * DashboardTopbar. One row per project listing the brand has posted,
 * with applicants and collaboration stats rolled up onto it — so a freshly
 * posted project shows up right away instead of waiting for a transaction to
 * exist (see fetchOwnProjectsThunk/fetchProjectApplicationsThunk), and there's no
 * separate view to check for its collaborations.
 *
 * A collaboration transaction is linked back to the project it came from via
 * `protectedData.projectId` (IMPLEMENTATION-PLAN.md §2.5), copied over from
 * the accepted application at checkout (F2.6) — see campaignData.js for the
 * bucketing logic used to count "actions required".
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled - Whether scrolling is disabled
 * @param {propTypes.currentUser} props.currentUser
 * @param {Array<propTypes.listing>} props.projects - the brand's own project listings
 * @param {boolean} props.fetchProjectsInProgress
 * @param {propTypes.error} props.fetchProjectsError
 * @param {Array<propTypes.transaction>} props.applications - inquiries received on those projects
 * @param {Array<propTypes.transaction>} props.campaigns - collaboration transactions
 * @param {Function} props.onFetchOwnProjects
 * @param {Function} props.onFetchProjectApplications
 * @param {Function} props.onFetchCampaigns
 * @param {Function} props.onRefreshHasListings
 * @param {Function} props.onLogout
 * @returns {JSX.Element}
 */
export const ManageCampaignsPageComponent = props => {
  const intl = useIntl();
  const config = useConfiguration();
  const history = useHistory();
  const location = useLocation();
  const {
    scrollingDisabled,
    currentUser,
    campaigns,
    fetchError,
    projects,
    fetchProjectsInProgress,
    fetchProjectsError,
    applications,
    togglingListingId,
    onFetchCampaigns,
    onFetchOwnProjects,
    onFetchProjectApplications,
    onSetProjectVisibility,
    onRefreshHasListings,
    onLogout,
  } = props;

  const requestedTab = parse(location.search).tab;
  const activeTab = TAB_IDS.includes(requestedTab) ? requestedTab : DEFAULT_TAB_ID;
  const setActiveTab = tabId => {
    const search = stringify({
      ...parse(location.search),
      tab: tabId === DEFAULT_TAB_ID ? null : tabId,
    });
    history.push(`${location.pathname}${search ? `?${search}` : ''}`);
  };
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [taskSort, setTaskSort] = useState('newest');
  // Reads the initial value from ?ship= so ProjectDetailPage's "Products to
  // ship" overview card can deep-link straight into a pre-filtered Ongoing
  // view, the way it used to land on the (now-removed) Shipments tab.
  const [shippingFilter, setShippingFilter] = useState(
    () => parse(location.search).ship || 'all'
  );

  useEffect(() => {
    onFetchCampaigns();
    onFetchOwnProjects();
    onFetchProjectApplications();
    // BrandSetupBanner's "post a first project" step reads
    // state.user.currentUserHasListings, which ducks/user.duck.js only
    // refreshes as a side effect of fetchCurrentUser() while it's still
    // false — it doesn't get poked when a project is published from this
    // page's own "New project" flow. Force a fresh check on every visit here
    // so the banner doesn't keep claiming the step is unfinished after a
    // brand has clearly already posted (and can see) a published project.
    onRefreshHasListings();
  }, [onFetchCampaigns, onFetchOwnProjects, onFetchProjectApplications, onRefreshHasListings]);

  const applicantCountByListingId = useMemo(() => {
    return applications.reduce((acc, tx) => {
      const listingId = tx.listing?.id?.uuid;
      if (!listingId) {
        return acc;
      }
      return { ...acc, [listingId]: (acc[listingId] || 0) + 1 };
    }, {});
  }, [applications]);

  // Keyed by the projects this brand has ALREADY fetched for the "Listed"
  // tab — a collaboration's protectedData.projectId always points to one of
  // the brand's own projects, so no extra fetch is needed just to look up
  // requiresProduct (see campaignData.js's deriveCampaign for why tx.listing
  // itself can't be used for that).
  const projectsById = useMemo(() => {
    return projects.reduce((acc, p) => ({ ...acc, [p.id.uuid]: p }), {});
  }, [projects]);

  const derivedCampaigns = useMemo(
    () =>
      campaigns.map(tx =>
        deriveCampaign(tx, projectsById[tx.attributes.protectedData?.projectId])
      ),
    [campaigns, projectsById]
  );

  const collabStatsByProjectId = useMemo(() => {
    return derivedCampaigns.reduce((acc, c) => {
      const projectId = c.tx.attributes.protectedData?.projectId;
      if (!projectId) {
        return acc;
      }
      const existing = acc[projectId] || {
        orders: 0,
        actionsRequired: 0,
        videosApproved: 0,
        hasNeedsReview: false,
        hasInProgress: false,
        hasShippable: false,
        hasNeedsShip: false,
        hasShipped: false,
        // A project is matched to exactly one creator (see
        // CheckoutPage.duck.js's declineOtherApplicantsMaybe), so there's
        // normally exactly one collaboration per project here — keep the
        // first one seen so TaskRow can link and show a name directly,
        // without guessing which one to pick for a stray pre-lock project
        // that still has more than one.
        provider: null,
        collaborationTx: null,
      };
      if (!existing.collaborationTx) {
        existing.provider = c.provider;
        existing.collaborationTx = c.tx;
      }
      if (c.bucket === 'needs-review') {
        existing.hasNeedsReview = true;
      }
      if (c.bucket === 'in-progress') {
        existing.hasInProgress = true;
      }
      if (c.isShippable) {
        existing.hasShippable = true;
      }
      if (c.isShippable && c.state === ugcStates.PURCHASED) {
        existing.hasNeedsShip = true;
      }
      if (c.hasBeenShipped) {
        existing.hasShipped = true;
      }
      return {
        ...acc,
        [projectId]: {
          ...existing,
          orders: existing.orders + 1,
          actionsRequired: existing.actionsRequired + (c.bucket === 'needs-review' ? 1 : 0),
          videosApproved: existing.videosApproved + (c.isPaid ? 1 : 0),
        },
      };
    }, {});
  }, [derivedCampaigns]);

  const sortedProjects = useMemo(() => {
    return projects
      .slice()
      .sort((a, b) => new Date(b.attributes.createdAt) - new Date(a.attributes.createdAt));
  }, [projects]);

  const visibleProjects = useMemo(() => {
    // A project moves from "Listed" to "Ongoing" the moment it's matched to a
    // creator (has a collaboration) — a project is matched to exactly one
    // creator (see CheckoutPage.duck.js's declineOtherApplicantsMaybe), so
    // "Listed" only needs to show what's still actually open for applicants,
    // not a project that's already spoken for.
    if (activeTab === 'listed') {
      return sortedProjects.filter(
        project => (collabStatsByProjectId[project.id.uuid]?.orders || 0) === 0
      );
    }
    if (activeTab !== 'ongoing') {
      return sortedProjects;
    }
    const ongoing = sortedProjects
      .filter(project => (collabStatsByProjectId[project.id.uuid]?.orders || 0) > 0)
      .filter(project => {
        if (taskStatusFilter === 'all') {
          return true;
        }
        return taskStatusCategory(collabStatsByProjectId[project.id.uuid]) === taskStatusFilter;
      })
      .filter(project => {
        if (shippingFilter === 'all') {
          return true;
        }
        return shippingStatusCategory(collabStatsByProjectId[project.id.uuid]) === shippingFilter;
      });
    return taskSort === 'oldest' ? ongoing.slice().reverse() : ongoing;
  }, [sortedProjects, activeTab, collabStatsByProjectId, taskStatusFilter, taskSort, shippingFilter]);

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const title = intl.formatMessage(
    { id: 'ManageCampaignsPage.schemaTitle' },
    { marketplaceName: config.marketplaceName }
  );

  const displayName = currentUser?.attributes?.profile?.displayName;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage="ManageCampaignsPage"
            onLogout={onLogout}
          />
        }
      >
        <div className={css.root}>
          <div className={css.headerRow}>
            <div>
              <Heading as="h1" rootClassName={css.heading}>
                <FormattedMessage id="ManageCampaignsPage.heading" />
              </Heading>
              <p className={css.subtitle}>
                <FormattedMessage
                  id={
                    activeTab === 'ongoing'
                      ? 'ManageCampaignsPage.ongoingSubtitle'
                      : 'ManageCampaignsPage.subtitle'
                  }
                />
              </p>
            </div>
            <NamedLink name="PostProjectPage" className={css.newCampaignButton}>
              <FormattedMessage id="ManageCampaignsPage.newCampaign" />
            </NamedLink>
          </div>

          <BrandSetupBanner currentUser={currentUser} className={css.setupBanner} />

          <nav className={css.tabRow}>
            <button
              type="button"
              className={classNames(css.tab, { [css.tabActive]: activeTab === 'listed' })}
              onClick={() => setActiveTab('listed')}
            >
              <FormattedMessage id="ManageCampaignsPage.tabAll" />
            </button>
            <button
              type="button"
              className={classNames(css.tab, { [css.tabActive]: activeTab === 'ongoing' })}
              onClick={() => setActiveTab('ongoing')}
            >
              <FormattedMessage id="ManageCampaignsPage.tabOngoing" />
            </button>
          </nav>

          {fetchProjectsError || fetchError ? (
            <p className={css.error}>
              <FormattedMessage id="ManageCampaignsPage.projectsFetchFailed" />
            </p>
          ) : null}

          {activeTab === 'ongoing' ? (
            <div className={css.filterRow}>
              <div className={css.filterGroup}>
                <label className={css.filterLabel} htmlFor="ongoing-status-filter">
                  <FormattedMessage id="ManageCampaignsPage.filterStatusLabel" />
                </label>
                <select
                  id="ongoing-status-filter"
                  className={css.filterSelect}
                  value={taskStatusFilter}
                  onChange={e => setTaskStatusFilter(e.target.value)}
                >
                  <option value="all">
                    {intl.formatMessage({ id: 'ManageCampaignsPage.filterStatusAll' })}
                  </option>
                  <option value="needs-review">
                    {intl.formatMessage({ id: 'ManageCampaignsPage.taskStatusNeedsReview' })}
                  </option>
                  <option value="in-progress">
                    {intl.formatMessage({ id: 'ManageCampaignsPage.taskStatusInProgress' })}
                  </option>
                  <option value="completed">
                    {intl.formatMessage({ id: 'ManageCampaignsPage.taskStatusCompleted' })}
                  </option>
                </select>
              </div>
              <div className={css.filterGroup}>
                <label className={css.filterLabel} htmlFor="ongoing-shipping-filter">
                  <FormattedMessage id="ManageCampaignsPage.filterShippingLabel" />
                </label>
                <select
                  id="ongoing-shipping-filter"
                  className={css.filterSelect}
                  value={shippingFilter}
                  onChange={e => setShippingFilter(e.target.value)}
                >
                  <option value="all">
                    {intl.formatMessage({ id: 'ManageCampaignsPage.filterStatusAll' })}
                  </option>
                  <option value="need-to-ship">
                    {intl.formatMessage({ id: 'ManageCampaignsPage.shipmentStateDueToShip' })}
                  </option>
                  <option value="shipped">
                    {intl.formatMessage({ id: 'ManageCampaignsPage.shipmentStateShipped' })}
                  </option>
                </select>
              </div>
              <div className={css.filterGroup}>
                <label className={css.filterLabel} htmlFor="ongoing-sort">
                  <FormattedMessage id="ManageCampaignsPage.sortTasksLabel" />
                </label>
                <select
                  id="ongoing-sort"
                  className={css.filterSelect}
                  value={taskSort}
                  onChange={e => setTaskSort(e.target.value)}
                >
                  <option value="newest">
                    {intl.formatMessage({ id: 'ManageCampaignsPage.sortNewest' })}
                  </option>
                  <option value="oldest">
                    {intl.formatMessage({ id: 'ManageCampaignsPage.sortOldest' })}
                  </option>
                </select>
              </div>
            </div>
          ) : null}

          <div className={css.list}>
            {activeTab === 'ongoing' ? (
              <div className={css.taskListHeader}>
                <span>
                  <FormattedMessage id="ManageCampaignsPage.colProject" />
                </span>
                <span>
                  <FormattedMessage id="ManageCampaignsPage.colStatus" />
                </span>
                <span>
                  <FormattedMessage id="ManageCampaignsPage.colProgress" />
                </span>
                <span>
                  <FormattedMessage id="ManageCampaignsPage.colShipping" />
                </span>
              </div>
            ) : (
              <div className={css.projectListHeader}>
                <span>
                  <FormattedMessage id="ManageCampaignsPage.colProject" />
                </span>
                <span>
                  <FormattedMessage id="ManageCampaignsPage.colCreatorsToApprove" />
                </span>
                <span>
                  <FormattedMessage id="ManageCampaignsPage.colActionsRequired" />
                </span>
                <span>
                  <FormattedMessage id="ManageCampaignsPage.colOrders" />
                </span>
                <span>
                  <FormattedMessage id="ManageCampaignsPage.colPosted" />
                </span>
                <span>
                  <FormattedMessage id="ManageCampaignsPage.colVisibility" />
                </span>
              </div>
            )}
            {fetchProjectsInProgress ? (
              <div className={css.loading}>
                <IconSpinner />
              </div>
            ) : visibleProjects.length > 0 ? (
              visibleProjects.map(project => {
                const stats = collabStatsByProjectId[project.id.uuid] || {
                  orders: 0,
                  actionsRequired: 0,
                  videosApproved: 0,
                  hasNeedsReview: false,
                  hasInProgress: false,
                  hasShippable: false,
                  hasNeedsShip: false,
                  hasShipped: false,
                  provider: null,
                  collaborationTx: null,
                };
                return activeTab === 'ongoing' ? (
                  <TaskRow key={project.id.uuid} project={project} stats={stats} intl={intl} />
                ) : (
                  <ProjectRow
                    key={project.id.uuid}
                    project={project}
                    applicantCount={applicantCountByListingId[project.id.uuid] || 0}
                    actionsRequiredCount={stats.actionsRequired}
                    ordersCount={stats.orders}
                    isToggling={togglingListingId === project.id.uuid}
                    onToggleVisibility={() =>
                      onSetProjectVisibility({
                        listingId: project.id,
                        isPublished: project.attributes.state !== 'published',
                      })
                    }
                    intl={intl}
                  />
                );
              })
            ) : (
              <div className={css.emptyState}>
                <Heading as="h2" rootClassName={css.emptyStateTitle}>
                  <FormattedMessage
                    id={
                      activeTab === 'ongoing'
                        ? 'ManageCampaignsPage.ongoingEmptyTitle'
                        : 'ManageCampaignsPage.projectsEmptyTitle'
                    }
                  />
                </Heading>
                <p className={css.emptyStateBody}>
                  <FormattedMessage
                    id={
                      activeTab === 'ongoing'
                        ? 'ManageCampaignsPage.ongoingEmptyBody'
                        : 'ManageCampaignsPage.projectsEmptyBody'
                    }
                  />
                </p>
                {activeTab !== 'ongoing' ? (
                  <NamedLink name="PostProjectPage" className={css.emptyStateCta}>
                    <FormattedMessage id="ManageCampaignsPage.emptyStateCta" />
                  </NamedLink>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  const {
    campaignRefs,
    fetchError,
    projectRefs,
    fetchProjectsInProgress,
    fetchProjectsError,
    applicationRefs,
    togglingListingId,
  } = state.ManageCampaignsPage;
  return {
    scrollingDisabled: isScrollingDisabled(state),
    currentUser,
    campaigns: getMarketplaceEntities(state, campaignRefs),
    fetchError,
    projects: getMarketplaceEntities(state, projectRefs),
    fetchProjectsInProgress,
    fetchProjectsError,
    applications: getMarketplaceEntities(state, applicationRefs),
    togglingListingId,
  };
};

const mapDispatchToProps = dispatch => ({
  onFetchCampaigns: () => dispatch(fetchCampaignsThunk()),
  onFetchOwnProjects: () => dispatch(fetchOwnProjectsThunk()),
  onFetchProjectApplications: () => dispatch(fetchProjectApplicationsThunk()),
  onRefreshHasListings: () => dispatch(fetchCurrentUserHasListings()),
  onSetProjectVisibility: params => dispatch(setProjectVisibilityThunk(params)),
  onLogout: () => dispatch(logout()),
});

const ManageCampaignsPage = compose(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )
)(ManageCampaignsPageComponent);

export default ManageCampaignsPage;
