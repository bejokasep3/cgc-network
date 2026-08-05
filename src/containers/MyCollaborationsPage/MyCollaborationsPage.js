import React, { useEffect, useMemo, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { fetchOwnCreatorProfileThunk } from '../../ducks/creatorProfile.duck';
import { formatDateIntoPartials } from '../../util/dates';
import { formatMoney } from '../../util/currency';
import { isUserAuthorized } from '../../util/userHelpers';
import { fetchCollaborationsThunk, fetchApplicationsThunk } from './MyCollaborationsPage.duck';
import { deriveCollaboration, deriveApplication } from './collaborationData';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  UserDisplayName,
  NamedLink,
  NamedRedirect,
  IconSpinner,
  ReviewRating,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import CreatorSetupBanner from '../CreatorOnboardingPage/CreatorSetupBanner';

import css from './MyCollaborationsPage.module.css';

const formatDate = (date, intl) => (date ? formatDateIntoPartials(date, intl).date : null);

const CollaborationRow = ({ collaboration, intl }) => {
  const {
    tx,
    customer,
    listing,
    processName,
    state,
    startedAt,
    dueAt,
    urgency,
    isPaid,
    earnings,
    reviewRating,
  } = collaboration;

  return (
    <NamedLink className={css.row} name="SaleDetailsPage" params={{ id: tx.id.uuid }}>
      <div className={css.rowInfo}>
        <div className={css.rowTitle}>{listing?.attributes?.title}</div>
        <div className={css.rowSubtitle}>
          <UserDisplayName user={customer} intl={intl} />
        </div>
      </div>
      <div className={css.rowStatus}>
        <FormattedMessage id={`InboxPage.${processName}.${state}.status`} values={{ transactionRole: 'provider' }} />
      </div>
      <div className={css.rowDate} data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colStarted' })}>
        {formatDate(startedAt, intl) || '—'}
      </div>
      <div
        data-label={intl.formatMessage({ id: 'ManageCampaignsPage.colDue' })}
        className={classNames(css.rowDate, css.rowDue, {
          [css.dueOverdue]: urgency === 'overdue',
          [css.dueSoon]: urgency === 'soon',
        })}
      >
        {dueAt ? (
          <>
            {formatDate(dueAt, intl)}
            {urgency === 'overdue' ? (
              <span className={css.dueBadge}>
                <FormattedMessage id="MyCollaborationsPage.overdue" />
              </span>
            ) : null}
          </>
        ) : (
          '—'
        )}
      </div>
      <div className={css.rowEarnings} data-label={intl.formatMessage({ id: 'MyCollaborationsPage.colEarnings' })}>
        {isPaid && earnings ? (
          formatMoney(intl, earnings)
        ) : (
          <span className={css.notPaidYet}>
            <FormattedMessage id="MyCollaborationsPage.notPaidYet" />
          </span>
        )}
      </div>
      <div className={css.rowReview} data-label={intl.formatMessage({ id: 'MyCollaborationsPage.colReview' })}>
        {reviewRating ? <ReviewRating rating={reviewRating} className={css.reviewStars} /> : '—'}
      </div>
    </NamedLink>
  );
};

const ApplicationRow = ({ application, intl }) => {
  const { tx, brand, listing, appliedAt, processName, state } = application;

  return (
    <NamedLink className={css.applicationRow} name="OrderDetailsPage" params={{ id: tx.id.uuid }}>
      <div className={css.rowInfo}>
        <div className={css.rowTitle}>{listing?.attributes?.title}</div>
        <div className={css.rowSubtitle}>
          <UserDisplayName user={brand} intl={intl} />
        </div>
      </div>
      <div className={css.rowStatus}>
        {/* The creator is always `customer` in cgc-application (BLUEPRINT D1/D2 —
            the inverse of cgc-ugc-approval's roles), unlike CollaborationRow above. */}
        <FormattedMessage id={`InboxPage.${processName}.${state}.status`} values={{ transactionRole: 'customer' }} />
      </div>
      <div className={css.rowDate} data-label={intl.formatMessage({ id: 'MyCollaborationsPage.colApplied' })}>
        {formatDate(appliedAt, intl) || '—'}
      </div>
    </NamedLink>
  );
};

/**
 * Creator's collaboration pipeline dashboard, mirroring ManageCampaignsPage
 * on the brand side. A "collaboration" here is one of the creator's own
 * `only: 'sale'` CGC UGC transactions, grouped by where it sits in the
 * process (needs the creator's action, in progress, or finished). A separate
 * "Applications" tab lists the creator's pending project inquiries (see
 * ProjectDetailPage.js) since those aren't sale transactions yet.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled
 * @param {propTypes.currentUser} props.currentUser
 * @param {Array<propTypes.transaction>} props.collaborations
 * @param {boolean} props.fetchInProgress
 * @param {propTypes.error} props.fetchError
 * @param {Array<propTypes.transaction>} props.applications
 * @param {boolean} props.applicationsInProgress
 * @param {propTypes.error} props.applicationsError
 * @param {Function} props.onFetchCollaborations
 * @param {Function} props.onFetchApplications
 * @param {Function} props.onLogout
 * @returns {JSX.Element}
 */
export const MyCollaborationsPageComponent = props => {
  const intl = useIntl();
  const {
    scrollingDisabled,
    currentUser,
    collaborations,
    fetchInProgress,
    fetchError,
    applications,
    applicationsInProgress,
    applicationsError,
    creatorProfile,
    onFetchCollaborations,
    onFetchApplications,
    onFetchOwnCreatorProfile,
    onLogout,
  } = props;

  const [activeTab, setActiveTab] = useState('applications');

  useEffect(() => {
    onFetchCollaborations();
    onFetchApplications();
    onFetchOwnCreatorProfile();
  }, [onFetchCollaborations, onFetchApplications, onFetchOwnCreatorProfile]);

  const title = intl.formatMessage({ id: 'MyCollaborationsPage.schemaTitle' });

  const displayName = currentUser?.attributes?.profile?.displayName;

  const derivedCollaborations = useMemo(() => collaborations.map(deriveCollaboration), [
    collaborations,
  ]);
  const derivedApplications = useMemo(() => applications.map(deriveApplication), [applications]);

  const actionNeededCount = useMemo(
    () => derivedCollaborations.filter(c => c.bucket === 'action-needed').length,
    [derivedCollaborations]
  );

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const visibleCollaborations = derivedCollaborations.slice().sort((a, b) => {
    const aTime = a.dueAt ? a.dueAt.getTime() : Infinity;
    const bTime = b.dueAt ? b.dueAt.getTime() : Infinity;
    return aTime - bTime;
  });

  const isApplicationsTab = activeTab === 'applications';

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage="MyCollaborationsPage"
            role="creator"
            onLogout={onLogout}
          />
        }
      >
        <div className={css.root}>
          <div className={css.headerRow}>
            <div>
              <Heading as="h1" rootClassName={css.heading}>
                <FormattedMessage id="MyCollaborationsPage.heading" />
              </Heading>
              <p className={css.subtitle}>
                <FormattedMessage id="MyCollaborationsPage.subtitle" />
              </p>
            </div>
            <NamedLink name="BrowseProjectsPage" className={css.browseProjectsButton}>
              <FormattedMessage id="MyCollaborationsPage.browseProjects" />
            </NamedLink>
          </div>

          <CreatorSetupBanner
            currentUser={currentUser}
            ownProfileListing={creatorProfile?.ownProfileListing}
            className={css.setupBanner}
          />

          <nav className={css.tabRow}>
            <button
              type="button"
              className={classNames(css.tab, {
                [css.tabActive]: activeTab === 'applications',
              })}
              onClick={() => setActiveTab('applications')}
            >
              <FormattedMessage id="MyCollaborationsPage.tabApplications" />
              <span className={css.tabCount}>{derivedApplications.length}</span>
            </button>
            <button
              type="button"
              className={classNames(css.tab, {
                [css.tabActive]: activeTab === 'collaborations',
              })}
              onClick={() => setActiveTab('collaborations')}
            >
              <FormattedMessage id="MyCollaborationsPage.tabCollaborations" />
              {actionNeededCount > 0 ? (
                <span className={css.tabCount}>{actionNeededCount}</span>
              ) : null}
            </button>
          </nav>

          {isApplicationsTab ? (
            applicationsError ? (
              <p className={css.error}>
                <FormattedMessage id="MyCollaborationsPage.fetchFailed" />
              </p>
            ) : applicationsInProgress ? (
              <div className={css.loading}>
                <IconSpinner />
              </div>
            ) : derivedApplications.length > 0 ? (
              <div className={css.list}>
                <div className={css.applicationListHeader}>
                  <span><FormattedMessage id="MyCollaborationsPage.colProject" /></span>
                  <span><FormattedMessage id="MyCollaborationsPage.colStatus" /></span>
                  <span><FormattedMessage id="MyCollaborationsPage.colApplied" /></span>
                </div>
                {derivedApplications.map(application => (
                  <ApplicationRow
                    key={application.tx.id.uuid}
                    application={application}
                    intl={intl}
                  />
                ))}
              </div>
            ) : (
              <div className={css.emptyState}>
                <Heading as="h2" rootClassName={css.emptyStateTitle}>
                  <FormattedMessage id="MyCollaborationsPage.empty.applications.title" />
                </Heading>
                <p className={css.emptyStateBody}>
                  <FormattedMessage id="MyCollaborationsPage.empty.applications.body" />
                </p>
                <NamedLink name="BrowseProjectsPage" className={css.emptyStateCta}>
                  <FormattedMessage id="MyCollaborationsPage.emptyStateCta" />
                </NamedLink>
              </div>
            )
          ) : fetchError ? (
            <p className={css.error}>
              <FormattedMessage id="MyCollaborationsPage.fetchFailed" />
            </p>
          ) : fetchInProgress ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : visibleCollaborations.length > 0 ? (
            <div className={css.list}>
              <div className={css.listHeader}>
                <span><FormattedMessage id="MyCollaborationsPage.colCollaboration" /></span>
                <span><FormattedMessage id="MyCollaborationsPage.colStatus" /></span>
                <span><FormattedMessage id="MyCollaborationsPage.colStarted" /></span>
                <span><FormattedMessage id="MyCollaborationsPage.colDue" /></span>
                <span><FormattedMessage id="MyCollaborationsPage.colEarnings" /></span>
                <span><FormattedMessage id="MyCollaborationsPage.colReview" /></span>
              </div>
              {visibleCollaborations.map(collaboration => (
                <CollaborationRow
                  key={collaboration.tx.id.uuid}
                  collaboration={collaboration}
                  intl={intl}
                />
              ))}
            </div>
          ) : (
            <div className={css.emptyState}>
              <Heading as="h2" rootClassName={css.emptyStateTitle}>
                <FormattedMessage id="MyCollaborationsPage.empty.collaborations.title" />
              </Heading>
              <p className={css.emptyStateBody}>
                <FormattedMessage id="MyCollaborationsPage.empty.collaborations.body" />
              </p>
              <NamedLink name="BrowseProjectsPage" className={css.emptyStateCta}>
                <FormattedMessage id="MyCollaborationsPage.emptyStateCta" />
              </NamedLink>
            </div>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  const {
    collaborationRefs,
    fetchInProgress,
    fetchError,
    applicationRefs,
    applicationsInProgress,
    applicationsError,
  } = state.MyCollaborationsPage;
  return {
    scrollingDisabled: isScrollingDisabled(state),
    currentUser,
    collaborations: getMarketplaceEntities(state, collaborationRefs),
    fetchInProgress,
    fetchError,
    applications: getMarketplaceEntities(state, applicationRefs),
    applicationsInProgress,
    applicationsError,
    creatorProfile: state.creatorProfile,
  };
};

const mapDispatchToProps = dispatch => ({
  onFetchCollaborations: () => dispatch(fetchCollaborationsThunk()),
  onFetchApplications: () => dispatch(fetchApplicationsThunk()),
  onFetchOwnCreatorProfile: () => dispatch(fetchOwnCreatorProfileThunk()),
  onLogout: () => dispatch(logout()),
});

const MyCollaborationsPage = compose(connect(mapStateToProps, mapDispatchToProps))(
  MyCollaborationsPageComponent
);

export default MyCollaborationsPage;
