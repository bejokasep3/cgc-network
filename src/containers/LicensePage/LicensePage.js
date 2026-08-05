import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { types as sdkTypes } from '../../util/sdkLoader';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { userDisplayNameAsString } from '../../util/data';
import { getRoleHomeRouteName } from '../../util/userHelpers';
import { getProjectFieldLabels } from '../../util/creatorFields';
import { getProcess, CGC_UGC_PROCESS_NAME } from '../../transactions/transaction';
import { states, getStateEnteredAtMap } from '../../transactions/transactionProcessCGCUGC';
import { showListing } from '../ListingPage/ListingPage.duck';
import { fetchLicenseTransactionThunk } from './LicensePage.duck';

import { Heading, Page, LayoutSingleColumn, NamedRedirect, IconSpinner, ErrorMessage } from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import DeliverableList from '../TransactionPage/DeliverableList/DeliverableList';

import css from './LicensePage.module.css';

const { UUID } = sdkTypes;
const cgcUgcProcess = getProcess(CGC_UGC_PROCESS_NAME);

/**
 * A frozen, two-sided, printable license record for a completed
 * collaboration (IMPLEMENTATION-PLAN.md F6.1, BLUEPRINT). No new entity: what
 * was delivered, who the creator was, and what usage rights the brand got
 * are all derived from the transaction's own protectedData.deliverables plus
 * the related project listing's publicData.usageRights/contentDueDate — the
 * same fields TransactionPanel/ProjectAcceptPage already read, just
 * re-rendered here without the rest of the collaboration workspace's chrome
 * so it's fit to print (window.print(), gated behind a print stylesheet)
 * or save as a PDF from the browser's own print dialog.
 *
 * Only viewable once the transaction has reached `received` — before that
 * there's nothing to freeze yet — and only by the two parties to it.
 *
 * @param {Object} props
 * @param {Object} props.params - route params, expects params.id (the
 *   cgc-ugc-approval transaction id)
 * @returns {JSX.Element}
 */
const LicensePage = ({ params }) => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();

  const transactionId = new UUID(params.id);

  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(isScrollingDisabled);
  const { fetchInProgress, fetchError } = useSelector(state => state.LicensePage);

  useEffect(() => {
    dispatch(fetchLicenseTransactionThunk({ id: transactionId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const transaction = useSelector(
    state => getMarketplaceEntities(state, [{ id: transactionId, type: 'transaction' }])[0]
  );

  const projectId = transaction?.attributes?.protectedData?.projectId;
  useEffect(() => {
    if (!projectId) {
      return;
    }
    dispatch(showListing(new UUID(projectId), config)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const projectListing = useSelector(state =>
    projectId ? getMarketplaceEntities(state, [{ id: new UUID(projectId), type: 'listing' }])[0] : null
  );

  const customerId = transaction?.customer?.id?.uuid;
  const providerId = transaction?.provider?.id?.uuid;
  const isParty =
    !!currentUser?.id && (currentUser.id.uuid === customerId || currentUser.id.uuid === providerId);
  const isProvider = currentUser?.id?.uuid === providerId;

  const hasReceived = transaction
    ? cgcUgcProcess.hasPassedState(states.RECEIVED, transaction)
    : false;

  if (transaction && !isParty) {
    return <NamedRedirect name={getRoleHomeRouteName(config, currentUser)} />;
  }
  if (transaction && !hasReceived) {
    return (
      <NamedRedirect
        name={isProvider ? 'SaleDetailsPage' : 'OrderDetailsPage'}
        params={{ id: params.id }}
      />
    );
  }

  const title = intl.formatMessage({ id: 'LicensePage.schemaTitle' });
  const displayName = currentUser?.attributes?.profile?.displayName;

  const publicData = projectListing?.attributes?.publicData || {};
  const { usageRightsLabel, contentDueDate } = getProjectFieldLabels(
    publicData,
    config.listing.listingFields
  );
  const deliverables = transaction?.attributes?.protectedData?.deliverables || [];
  const receivedAt = transaction
    ? getStateEnteredAtMap(transaction.attributes.transitions)[states.RECEIVED]
    : null;

  const creatorName = userDisplayNameAsString(transaction?.provider, '');
  const brandName = userDisplayNameAsString(transaction?.customer, '');
  const projectTitle = projectListing?.attributes?.title;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <div className={css.noPrint}>
            <DashboardTopbar
              displayName={displayName}
              role={isProvider ? 'creator' : 'brand'}
              onLogout={() => dispatch(logout())}
            />
          </div>
        }
      >
        <div className={css.root}>
          {fetchError ? (
            <ErrorMessage error={fetchError} />
          ) : fetchInProgress || !transaction ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : (
            <>
              <div className={css.header}>
                <Heading as="h1" rootClassName={css.heading}>
                  <FormattedMessage id="LicensePage.heading" values={{ projectTitle }} />
                </Heading>
                <button type="button" className={css.printButton} onClick={() => window.print()}>
                  <FormattedMessage id="LicensePage.print" />
                </button>
              </div>

              <div className={css.detailGrid}>
                <div className={css.detailItem}>
                  <span className={css.detailLabel}>
                    <FormattedMessage id="LicensePage.creatorLabel" />
                  </span>
                  <span className={css.detailValue}>{creatorName}</span>
                </div>
                <div className={css.detailItem}>
                  <span className={css.detailLabel}>
                    <FormattedMessage id="LicensePage.brandLabel" />
                  </span>
                  <span className={css.detailValue}>{brandName}</span>
                </div>
                <div className={css.detailItem}>
                  <span className={css.detailLabel}>
                    <FormattedMessage id="LicensePage.usageRightsLabel" />
                  </span>
                  <span className={css.detailValue}>{usageRightsLabel || '—'}</span>
                </div>
                {contentDueDate ? (
                  <div className={css.detailItem}>
                    <span className={css.detailLabel}>
                      <FormattedMessage id="LicensePage.contentDueDateLabel" />
                    </span>
                    <span className={css.detailValue}>{contentDueDate}</span>
                  </div>
                ) : null}
                {receivedAt ? (
                  <div className={css.detailItem}>
                    <span className={css.detailLabel}>
                      <FormattedMessage id="LicensePage.receivedAtLabel" />
                    </span>
                    <span className={css.detailValue}>{intl.formatDate(new Date(receivedAt))}</span>
                  </div>
                ) : null}
              </div>

              <DeliverableList deliverables={deliverables} canManage={false} />
            </>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default LicensePage;
