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
import { types as sdkTypes } from '../../util/sdkLoader';
import { fetchCollaborationsThunk, fetchApplicationsThunk } from './MyCollaborationsPage.duck';
import { BUCKETS, SUB_BUCKETS, deriveCollaboration, deriveApplication } from './collaborationData';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  Avatar,
  UserDisplayName,
  NamedLink,
  IconSpinner,
  ReviewRating,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import CreatorSetupBanner from '../CreatorOnboardingPage/CreatorSetupBanner';

import css from './MyCollaborationsPage.module.css';

const { Money } = sdkTypes;

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
    revisionRound,
    isPaid,
    earnings,
    reviewRating,
  } = collaboration;

  return (
    <NamedLink className={css.row} name="SaleDetailsPage" params={{ id: tx.id.uuid }}>
      <Avatar user={customer} className={css.rowAvatar} disableProfileLink />
      <div className={css.rowInfo}>
        <div className={css.rowTitle}>{listing?.attributes?.title}</div>
        <div className={css.rowSubtitle}>
          <UserDisplayName user={customer} intl={intl} />
          {revisionRound ? (
            <span className={css.revisionTag}>
              <FormattedMessage id="MyCollaborationsPage.revisionTag" values={{ round: revisionRound }} />
            </span>
          ) : null}
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
      <Avatar user={brand} className={css.rowAvatar} disableProfileLink />
      <div className={css.rowInfo}>
        <div className={css.rowTitle}>{listing?.attributes?.title}</div>
        <div className={css.rowSubtitle}>
          <UserDisplayName user={brand} intl={intl} />
        </div>
      </div>
      <div className={css.rowStatus}>
        <FormattedMessage id={`InboxPage.${processName}.${state}.status`} values={{ transactionRole: 'provider' }} />
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

  const [activeBucket, setActiveBucket] = useState('all');
  const [activeSubBucket, setActiveSubBucket] = useState(null);

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

  const countByBucket = useMemo(() => {
    return derivedCollaborations.reduce(
      (acc, c) => ({ ...acc, [c.bucket]: (acc[c.bucket] || 0) + 1 }),
      { all: derivedCollaborations.length }
    );
  }, [derivedCollaborations]);

  const summary = useMemo(() => {
    const active = derivedCollaborations.filter(c => c.bucket !== 'completed').length;
    const actionNeeded = countByBucket['action-needed'] || 0;
    const paidItems = derivedCollaborations.filter(c => c.isPaid && c.earnings);
    const currencies = new Set(paidItems.map(c => c.earnings.currency));
    const totalEarned =
      paidItems.length === 0
        ? null
        : currencies.size > 1
        ? null
        : formatMoney(
            intl,
            new Money(
              paidItems.reduce((sum, c) => sum + c.earnings.amount, 0),
              paidItems[0].earnings.currency
            )
          );
    return { active, actionNeeded, totalEarned };
  }, [derivedCollaborations, countByBucket, intl]);

  const collaborationsInActiveBucket = useMemo(() => {
    return activeBucket === 'all'
      ? derivedCollaborations
      : derivedCollaborations.filter(c => c.bucket === activeBucket);
  }, [derivedCollaborations, activeBucket]);

  const subBucketOptions = SUB_BUCKETS[activeBucket] || [];
  const presentSubBuckets = new Set(
    collaborationsInActiveBucket.map(c => c.subBucket).filter(Boolean)
  );
  const visibleSubBucketOptions = subBucketOptions.filter(sb => presentSubBuckets.has(sb.id));
  const hasSubFilters = activeBucket !== 'applications' && visibleSubBucketOptions.length > 1;

  const visibleCollaborations = (hasSubFilters && activeSubBucket
    ? collaborationsInActiveBucket.filter(c => c.subBucket === activeSubBucket)
    : collaborationsInActiveBucket
  )
    .slice()
    .sort((a, b) => {
      const aTime = a.dueAt ? a.dueAt.getTime() : Infinity;
      const bTime = b.dueAt ? b.dueAt.getTime() : Infinity;
      return aTime - bTime;
    });

  const handleBucketClick = bucketId => {
    setActiveBucket(bucketId);
    setActiveSubBucket(null);
  };

  const isApplicationsTab = activeBucket === 'applications';

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

          <div className={css.summaryRow}>
            <div className={css.summaryTile}>
              <span className={css.summaryValue}>{summary.active}</span>
              <span className={css.summaryLabel}>
                <FormattedMessage id="MyCollaborationsPage.summaryActive" />
              </span>
            </div>
            <div className={css.summaryTile}>
              <span className={css.summaryValue}>{summary.actionNeeded}</span>
              <span className={css.summaryLabel}>
                <FormattedMessage id="MyCollaborationsPage.summaryActionNeeded" />
              </span>
            </div>
            <div className={css.summaryTile}>
              <span className={css.summaryValue}>{summary.totalEarned || '—'}</span>
              <span className={css.summaryLabel}>
                <FormattedMessage id="MyCollaborationsPage.summaryEarned" />
              </span>
            </div>
          </div>

          <nav className={css.tabRow}>
            {BUCKETS.map(bucket => (
              <button
                key={bucket.id}
                type="button"
                className={classNames(css.tab, {
                  [css.tabActive]: activeBucket === bucket.id,
                })}
                onClick={() => handleBucketClick(bucket.id)}
              >
                <FormattedMessage id={bucket.labelId} />
                <span className={css.tabCount}>{countByBucket[bucket.id] || 0}</span>
              </button>
            ))}
            <button
              type="button"
              className={classNames(css.tab, {
                [css.tabActive]: activeBucket === 'applications',
              })}
              onClick={() => handleBucketClick('applications')}
            >
              <FormattedMessage id="MyCollaborationsPage.tabApplications" />
              <span className={css.tabCount}>{derivedApplications.length}</span>
            </button>
          </nav>

          {hasSubFilters ? (
            <nav className={css.subTabRow}>
              <button
                type="button"
                className={classNames(css.subTab, { [css.subTabActive]: !activeSubBucket })}
                onClick={() => setActiveSubBucket(null)}
              >
                <FormattedMessage id="MyCollaborationsPage.subAll" />
              </button>
              {visibleSubBucketOptions.map(sb => (
                <button
                  key={sb.id}
                  type="button"
                  className={classNames(css.subTab, {
                    [css.subTabActive]: activeSubBucket === sb.id,
                  })}
                  onClick={() => setActiveSubBucket(sb.id)}
                >
                  <FormattedMessage id={sb.labelId} />
                </button>
              ))}
            </nav>
          ) : null}

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
                  <span className={css.listHeaderSpacer} />
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
                <FormattedMessage id="MyCollaborationsPage.empty.applications" />
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
                <span className={css.listHeaderSpacer} />
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
              <FormattedMessage id={`MyCollaborationsPage.empty.${activeBucket}`} />
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
