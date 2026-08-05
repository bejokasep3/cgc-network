import React, { useEffect, useMemo } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { fetchStripeAccount } from '../../ducks/stripeConnectAccount.duck';
import { formatMoney } from '../../util/currency';
import { formatDateIntoPartials } from '../../util/dates';
import { isUserAuthorized } from '../../util/userHelpers';
import { fetchEarningsTransactionsThunk } from './EarningsPage.duck';
import { EARNINGS_BUCKETS, deriveEarningsRow, summarizeEarnings } from './earningsData';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  NamedLink,
  NamedRedirect,
  IconSpinner,
  ErrorMessage,
  UserDisplayName,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';

import css from './EarningsPage.module.css';

// Same small local helpers StripePayoutPage.js uses to read Stripe Connect
// account completeness — not shared anywhere else in the codebase, so
// duplicated here rather than extracted for two callers.
const getStripeAccountData = stripeAccount => stripeAccount?.attributes?.stripeAccountData || null;
const hasRequirements = (stripeAccountData, requirementType) =>
  !!stripeAccountData?.requirements &&
  Array.isArray(stripeAccountData.requirements[requirementType]) &&
  stripeAccountData.requirements[requirementType].length > 0;

const BUCKET_LABEL_IDS = {
  [EARNINGS_BUCKETS.PAID]: 'EarningsPage.bucketPaid',
  [EARNINGS_BUCKETS.AWAITING_REVIEW]: 'EarningsPage.bucketAwaitingReview',
  [EARNINGS_BUCKETS.HELD]: 'EarningsPage.bucketHeld',
};

const formatDate = (date, intl) => (date ? formatDateIntoPartials(date, intl).date : null);

const SummaryCard = ({ bucket, summary, intl }) => (
  <div className={css.summaryCard}>
    <span className={css.summaryLabel}>
      <FormattedMessage id={BUCKET_LABEL_IDS[bucket]} />
    </span>
    <span className={css.summaryAmount}>{formatMoney(intl, summary.total)}</span>
    <span className={css.summaryCount}>
      <FormattedMessage id="EarningsPage.summaryCount" values={{ count: summary.count }} />
    </span>
  </div>
);

const EarningsRow = ({ row, intl }) => {
  const { tx, listing, customer, bucket, amount, lastTransitionedAt } = row;
  return (
    <NamedLink className={css.row} name="SaleDetailsPage" params={{ id: tx.id.uuid }}>
      <div className={css.rowInfo}>
        <span className={css.rowTitle}>{listing?.attributes?.title}</span>
        <span className={css.rowSubtitle}>
          <UserDisplayName user={customer} intl={intl} />
        </span>
      </div>
      <span
        className={css.rowBucket}
        data-bucket={bucket}
        data-label={intl.formatMessage({ id: 'EarningsPage.columnStatus' })}
      >
        <FormattedMessage id={BUCKET_LABEL_IDS[bucket]} />
      </span>
      <span
        className={css.rowDate}
        data-label={intl.formatMessage({ id: 'EarningsPage.columnDate' })}
      >
        {formatDate(lastTransitionedAt, intl) || '—'}
      </span>
      <span
        className={css.rowAmount}
        data-label={intl.formatMessage({ id: 'EarningsPage.columnAmount' })}
      >
        {amount ? formatMoney(intl, amount) : '—'}
      </span>
    </NamedLink>
  );
};

/**
 * A creator's earnings breakdown (IMPLEMENTATION-PLAN.md F8.2): how much has
 * been paid out, how much is held in escrow waiting on the creator's own
 * next move, and how much is submitted and awaiting the brand's/operator's
 * review. Built from the creator's own `only: 'sale'` cgc-ugc-approval
 * transactions — see earningsData.js for the state-to-bucket mapping.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled
 * @param {propTypes.currentUser} props.currentUser
 * @param {Array<propTypes.transaction>} props.transactions
 * @param {boolean} props.fetchInProgress
 * @param {propTypes.error} props.fetchError
 * @param {Object} props.stripeAccount
 * @param {Function} props.onFetchEarnings
 * @param {Function} props.onFetchStripeAccount
 * @param {Function} props.onLogout
 * @returns {JSX.Element}
 */
export const EarningsPageComponent = props => {
  const intl = useIntl();
  const config = useConfiguration();
  const {
    scrollingDisabled,
    currentUser,
    transactions,
    fetchInProgress,
    fetchError,
    stripeAccount,
    onFetchEarnings,
    onFetchStripeAccount,
    onLogout,
  } = props;

  useEffect(() => {
    onFetchEarnings();
    if (currentUser?.stripeAccount) {
      onFetchStripeAccount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.stripeAccount]);

  const rows = useMemo(
    () =>
      transactions
        .map(deriveEarningsRow)
        .filter(Boolean)
        .sort((a, b) => (b.lastTransitionedAt || 0) - (a.lastTransitionedAt || 0)),
    [transactions]
  );

  const summary = useMemo(() => summarizeEarnings(rows, config.currency), [rows, config.currency]);

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const stripeConnected = !!stripeAccount?.id;
  const stripeAccountData = stripeConnected ? getStripeAccountData(stripeAccount) : null;
  const requirementsMissing =
    stripeConnected &&
    (hasRequirements(stripeAccountData, 'past_due') ||
      hasRequirements(stripeAccountData, 'currently_due'));
  const showPayoutSetupNotice = !stripeConnected || requirementsMissing;

  const title = intl.formatMessage({ id: 'EarningsPage.schemaTitle' });
  const displayName = currentUser?.attributes?.profile?.displayName;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage="EarningsPage"
            role="creator"
            onLogout={onLogout}
          />
        }
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="EarningsPage.heading" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="EarningsPage.subtitle" />
          </p>

          {showPayoutSetupNotice ? (
            <NamedLink name="StripePayoutPage" className={css.payoutNotice}>
              <FormattedMessage
                id={
                  stripeConnected
                    ? 'EarningsPage.payoutVerificationNeeded'
                    : 'EarningsPage.payoutNotConnected'
                }
              />
            </NamedLink>
          ) : null}

          {fetchError ? (
            <ErrorMessage error={fetchError} />
          ) : fetchInProgress ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : (
            <>
              <div className={css.summaryRow}>
                <SummaryCard bucket={EARNINGS_BUCKETS.PAID} summary={summary.paid} intl={intl} />
                <SummaryCard
                  bucket={EARNINGS_BUCKETS.AWAITING_REVIEW}
                  summary={summary.awaitingReview}
                  intl={intl}
                />
                <SummaryCard bucket={EARNINGS_BUCKETS.HELD} summary={summary.held} intl={intl} />
              </div>

              {rows.length === 0 ? (
                <div className={css.emptyState}>
                  <Heading as="h2" rootClassName={css.emptyStateTitle}>
                    <FormattedMessage id="EarningsPage.noResultsTitle" />
                  </Heading>
                  <p className={css.emptyStateBody}>
                    <FormattedMessage id="EarningsPage.noResultsBody" />
                  </p>
                  <NamedLink name="BrowseProjectsPage" className={css.emptyStateCta}>
                    <FormattedMessage id="EarningsPage.emptyStateCta" />
                  </NamedLink>
                </div>
              ) : (
                <div className={css.list}>
                  <div className={css.listHeader}>
                    <span>
                      <FormattedMessage id="EarningsPage.columnCollaboration" />
                    </span>
                    <span>
                      <FormattedMessage id="EarningsPage.columnStatus" />
                    </span>
                    <span>
                      <FormattedMessage id="EarningsPage.columnDate" />
                    </span>
                    <span className={css.listHeaderAmount}>
                      <FormattedMessage id="EarningsPage.columnAmount" />
                    </span>
                  </div>
                  {rows.map(row => (
                    <EarningsRow key={row.tx.id.uuid} row={row} intl={intl} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { transactionRefs, fetchInProgress, fetchError } = state.EarningsPage;
  const { currentUser } = state.user;
  const { stripeAccount } = state.stripeConnectAccount;
  return {
    scrollingDisabled: isScrollingDisabled(state),
    currentUser,
    transactions: getMarketplaceEntities(state, transactionRefs),
    fetchInProgress,
    fetchError,
    stripeAccount,
  };
};

const mapDispatchToProps = dispatch => ({
  onFetchEarnings: () => dispatch(fetchEarningsTransactionsThunk()),
  onFetchStripeAccount: () => dispatch(fetchStripeAccount()),
  onLogout: () => dispatch(logout()),
});

const EarningsPage = compose(connect(mapStateToProps, mapDispatchToProps))(EarningsPageComponent);

export default EarningsPage;
