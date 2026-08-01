import React, { useEffect, useMemo, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { formatDateIntoPartials } from '../../util/dates';
import {
  fetchCampaignsThunk,
  fetchOwnProjectsThunk,
  fetchProjectApplicationsThunk,
  setProjectVisibilityThunk,
} from './ManageCampaignsPage.duck';
import { deriveCampaign } from './campaignData';
import { states as ugcStates } from '../../transactions/transactionProcessCGCUGC';

import { Heading, Page, LayoutSingleColumn, NamedLink, IconSpinner, UserDisplayName } from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';

import css from './ManageCampaignsPage.module.css';

const formatDate = (date, intl) => (date ? formatDateIntoPartials(date, intl).date : null);

const IconInfoCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9.25" />
    <circle cx="12" cy="8" r="0.75" fill="currentColor" stroke="none" />
    <path d="M12 11v6" strokeLinecap="round" />
  </svg>
);

const TASK_STATUS_LABEL_ID = {
  'needs-review': 'ManageCampaignsPage.taskStatusNeedsReview',
  'in-progress': 'ManageCampaignsPage.taskStatusInProgress',
  completed: 'ManageCampaignsPage.taskStatusCompleted',
};

// A project's ongoing collaborations can be in different buckets at once
// (one creator awaiting review, another already completed) — pick the single
// most-urgent category to represent the whole project in the Task table.
const taskStatusCategory = stats => {
  if (stats.hasNeedsReview) return 'needs-review';
  if (stats.hasInProgress) return 'in-progress';
  return 'completed';
};

const SHIPMENT_STATE_LABEL_ID = {
  [ugcStates.PURCHASED]: 'ManageCampaignsPage.shipmentStateDueToShip',
  [ugcStates.SHIPPED]: 'ManageCampaignsPage.shipmentStateShipped',
  [ugcStates.PRODUCT_RECEIVED]: 'ManageCampaignsPage.shipmentStateReceived',
};

// Shipments tab row: one physical-product shipment (brand -> creator) per
// row, unlike the other two tabs which are grouped by project.
const ShipmentRow = ({ campaign, intl }) => {
  const { tx, provider, listing, state, startedAt } = campaign;
  const stateLabelId = SHIPMENT_STATE_LABEL_ID[state];

  return (
    <div className={css.shipmentRow}>
      <div className={css.rowInfo}>
        <div className={css.rowTitle}>{listing?.attributes?.title}</div>
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colCreator' })}
      >
        <UserDisplayName user={provider} intl={intl} />
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colStatus' })}
      >
        {stateLabelId ? (
          <span className={css.visibilityBadge}>
            <FormattedMessage id={stateLabelId} />
          </span>
        ) : (
          '—'
        )}
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colSince' })}
      >
        {formatDate(startedAt, intl) || formatDate(tx.attributes.lastTransitionedAt, intl) || '—'}
      </div>
    </div>
  );
};

// Slide on/off switch for a listing's visibility — on toggles between
// published (visible to creators in Browse projects) and closed. Disabled
// for drafts, which need the full listing wizard to publish for the first
// time rather than a simple open/close call.
const VisibilityToggle = ({ isPublished, isToggling, onToggle, intl }) => (
  <button
    type="button"
    role="switch"
    aria-checked={isPublished}
    disabled={isToggling}
    className={classNames(css.toggle, { [css.toggleOn]: isPublished })}
    onClick={onToggle}
    aria-label={intl.formatMessage({
      id: isPublished ? 'ManageCampaignsPage.visibilityPublished' : 'ManageCampaignsPage.visibilityClosed',
    })}
  >
    <span className={css.toggleKnob} />
  </button>
);

// One row per project-brief listing (not per transaction) — applicants and
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
  const { title, state, createdAt } = project.attributes;
  const isDraft = state === 'draft';
  const isPublished = state === 'published';

  return (
    <div className={css.projectRow}>
      <div className={css.rowInfo}>
        <div className={css.rowTitle}>{title}</div>
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
            intl={intl}
          />
        )}
      </div>
    </div>
  );
};

// "Ongoing" tab row: one project with all its active collaborations rolled
// up into aggregate counts (videos/creators/shipping/approved), instead of
// the per-project posting details ProjectRow shows.
const TaskRow = ({ project, stats, intl }) => {
  const { title } = project.attributes;
  const statusCategory = taskStatusCategory(stats);

  return (
    <div className={css.projectRow}>
      <div className={css.rowInfo}>
        <div className={css.rowTitle}>{title}</div>
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colStatus' })}
      >
        <span
          className={classNames(css.visibilityBadge, {
            [css.rowHighlight]: statusCategory === 'needs-review',
          })}
        >
          <FormattedMessage id={TASK_STATUS_LABEL_ID[statusCategory]} />
        </span>
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colVideos' })}
      >
        {stats.orders}
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colCreators' })}
      >
        {stats.creatorIds.size}
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colShipping' })}
      >
        {stats.shippingCount > 0 ? stats.shippingCount : '—'}
      </div>
      <div
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colVideosApproved' })}
      >
        {stats.videosApproved}
      </div>
    </div>
  );
};

/**
 * Brand's project management dashboard, replacing the Roster link in
 * DashboardTopbar. One row per project-project listing the brand has posted,
 * with applicants and collaboration stats rolled up onto it — so a freshly
 * posted project shows up right away instead of waiting for a transaction to
 * exist (see fetchOwnProjectsThunk/fetchProjectApplicationsThunk), and there's no
 * separate view to check for its collaborations.
 *
 * A collaboration transaction is linked back to the project it came from via
 * `protectedData.inviteBriefId`, set when the brand attaches an open project
 * while inviting a creator (CreatorProfilePage's invite form) — see
 * campaignData.js for the bucketing logic used to count "actions required".
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled - Whether scrolling is disabled
 * @param {propTypes.currentUser} props.currentUser
 * @param {Array<propTypes.listing>} props.projects - the brand's own project-project listings
 * @param {boolean} props.fetchProjectsInProgress
 * @param {propTypes.error} props.fetchProjectsError
 * @param {Array<propTypes.transaction>} props.applications - inquiries received on those projects
 * @param {Array<propTypes.transaction>} props.campaigns - collaboration transactions
 * @param {Function} props.onFetchOwnProjects
 * @param {Function} props.onFetchProjectApplications
 * @param {Function} props.onFetchCampaigns
 * @param {Function} props.onLogout
 * @returns {JSX.Element}
 */
export const ManageCampaignsPageComponent = props => {
  const intl = useIntl();
  const config = useConfiguration();
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
    onLogout,
  } = props;

  const [activeTab, setActiveTab] = useState('listed');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [taskSort, setTaskSort] = useState('newest');
  const [shipmentFilter, setShipmentFilter] = useState('due-to-ship');

  useEffect(() => {
    onFetchCampaigns();
    onFetchOwnProjects();
    onFetchProjectApplications();
  }, [onFetchCampaigns, onFetchOwnProjects, onFetchProjectApplications]);

  const applicantCountByListingId = useMemo(() => {
    return applications.reduce((acc, tx) => {
      const listingId = tx.listing?.id?.uuid;
      if (!listingId) {
        return acc;
      }
      return { ...acc, [listingId]: (acc[listingId] || 0) + 1 };
    }, {});
  }, [applications]);

  const derivedCampaigns = useMemo(() => campaigns.map(deriveCampaign), [campaigns]);

  const collabStatsByProjectId = useMemo(() => {
    return derivedCampaigns.reduce((acc, c) => {
      const projectId = c.tx.attributes.protectedData?.inviteBriefId;
      if (!projectId) {
        return acc;
      }
      const existing = acc[projectId] || {
        orders: 0,
        actionsRequired: 0,
        creatorIds: new Set(),
        shippingCount: 0,
        videosApproved: 0,
        hasNeedsReview: false,
        hasInProgress: false,
      };
      if (c.provider?.id?.uuid) {
        existing.creatorIds.add(c.provider.id.uuid);
      }
      if (c.bucket === 'needs-review') {
        existing.hasNeedsReview = true;
      }
      if (c.bucket === 'in-progress') {
        existing.hasInProgress = true;
      }
      return {
        ...acc,
        [projectId]: {
          ...existing,
          orders: existing.orders + 1,
          actionsRequired: existing.actionsRequired + (c.bucket === 'needs-review' ? 1 : 0),
          shippingCount: existing.shippingCount + (c.subBucket === 'awaiting-shipment' ? 1 : 0),
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
      });
    return taskSort === 'oldest' ? ongoing.slice().reverse() : ongoing;
  }, [sortedProjects, activeTab, collabStatsByProjectId, taskStatusFilter, taskSort]);

  // Shipments tab: physical-product shipments (brand -> creator), one row
  // per collaboration on a shippable listing, filtered by where it sits in
  // the shipping flow rather than grouped by project.
  const shippableCampaigns = useMemo(() => {
    return derivedCampaigns.filter(c => !!c.listing?.attributes?.publicData?.requiresProduct);
  }, [derivedCampaigns]);

  const visibleShipments = useMemo(() => {
    const filtered = shippableCampaigns.filter(c => {
      if (shipmentFilter === 'due-to-ship') {
        return c.state === ugcStates.PURCHASED;
      }
      if (shipmentFilter === 'shipped') {
        return c.state === ugcStates.SHIPPED;
      }
      return true;
    });
    return filtered
      .slice()
      .sort((a, b) => new Date(b.tx.attributes.lastTransitionedAt) - new Date(a.tx.attributes.lastTransitionedAt));
  }, [shippableCampaigns, shipmentFilter]);

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
                <FormattedMessage
                  id={
                    activeTab === 'shipments'
                      ? 'ManageCampaignsPage.shipmentsHeading'
                      : 'ManageCampaignsPage.heading'
                  }
                />
              </Heading>
              <p className={css.subtitle}>
                <FormattedMessage
                  id={
                    activeTab === 'ongoing'
                      ? 'ManageCampaignsPage.ongoingSubtitle'
                      : activeTab === 'shipments'
                      ? 'ManageCampaignsPage.shipmentsSubtitle'
                      : 'ManageCampaignsPage.subtitle'
                  }
                />
              </p>
            </div>
            <NamedLink name="PostProjectPage" className={css.newCampaignButton}>
              <FormattedMessage id="ManageCampaignsPage.newCampaign" />
            </NamedLink>
          </div>

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
            <button
              type="button"
              className={classNames(css.tab, { [css.tabActive]: activeTab === 'shipments' })}
              onClick={() => setActiveTab('shipments')}
            >
              <FormattedMessage id="ManageCampaignsPage.tabShipments" />
            </button>
          </nav>

          {fetchProjectsError || fetchError ? (
            <p className={css.error}>
              <FormattedMessage id="ManageCampaignsPage.projectsFetchFailed" />
            </p>
          ) : null}

          {activeTab === 'shipments' ? (
            <>
              <div className={css.pillRow}>
                {['due-to-ship', 'shipped', 'all'].map(filterId => (
                  <button
                    key={filterId}
                    type="button"
                    className={classNames(css.pill, {
                      [css.pillActive]: shipmentFilter === filterId,
                    })}
                    onClick={() => setShipmentFilter(filterId)}
                  >
                    <FormattedMessage
                      id={`ManageCampaignsPage.shipmentFilter.${filterId}`}
                    />
                  </button>
                ))}
              </div>

              {visibleShipments.length > 0 ? (
                <div className={css.list}>
                  <div className={css.shipmentListHeader}>
                    <span><FormattedMessage id="ManageCampaignsPage.colProject" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colCreator" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colStatus" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colSince" /></span>
                  </div>
                  {visibleShipments.map(campaign => (
                    <ShipmentRow key={campaign.tx.id.uuid} campaign={campaign} intl={intl} />
                  ))}
                </div>
              ) : (
                <div className={css.infoBox}>
                  <IconInfoCircle />
                  <span>
                    <FormattedMessage
                      id={`ManageCampaignsPage.shipmentsEmpty.${shipmentFilter}`}
                    />
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
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
                      <option value="all">{intl.formatMessage({ id: 'ManageCampaignsPage.filterStatusAll' })}</option>
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
                  <div className={css.projectListHeader}>
                    <span><FormattedMessage id="ManageCampaignsPage.colTask" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colStatus" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colVideos" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colCreators" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colShipping" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colVideosApproved" /></span>
                  </div>
                ) : (
                  <div className={css.projectListHeader}>
                    <span><FormattedMessage id="ManageCampaignsPage.colProject" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colCreatorsToApprove" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colActionsRequired" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colOrders" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colPosted" /></span>
                    <span><FormattedMessage id="ManageCampaignsPage.colVisibility" /></span>
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
                      creatorIds: new Set(),
                      shippingCount: 0,
                      videosApproved: 0,
                      hasNeedsReview: false,
                      hasInProgress: false,
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
                    <FormattedMessage
                      id={
                        activeTab === 'ongoing'
                          ? 'ManageCampaignsPage.ongoingEmpty'
                          : 'ManageCampaignsPage.projectsEmpty'
                      }
                    />
                  </div>
                )}
              </div>
            </>
          )}
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
  onSetProjectVisibility: params => dispatch(setProjectVisibilityThunk(params)),
  onLogout: () => dispatch(logout()),
});

const ManageCampaignsPage = compose(connect(mapStateToProps, mapDispatchToProps))(
  ManageCampaignsPageComponent
);

export default ManageCampaignsPage;
