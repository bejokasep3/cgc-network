import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { getRoleHomeRouteName } from '../../util/userHelpers';
import { storableError } from '../../util/errors';
import { types as sdkTypes } from '../../util/sdkLoader';
import { formatMoney } from '../../util/currency';
import { fetchAdminStatus, fetchDisputes, resolveDispute } from '../../util/api';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  NamedRedirect,
  IconSpinner,
  ErrorMessage,
  Button,
  SecondaryButton,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';

import css from './AdminDisputesPage.module.css';

const { Money } = sdkTypes;

const TransitionHistory = ({ transitions, intl }) => (
  <ol className={css.history}>
    {transitions.map((t, i) => (
      <li key={`${t.transition}-${i}`} className={css.historyRow}>
        <span className={css.historyTransition}>{t.transition.replace('transition/', '')}</span>
        <span className={css.historyDate}>{intl.formatDate(new Date(t.createdAt))}</span>
      </li>
    ))}
  </ol>
);

const DisputeCard = ({ dispute, isResolving, resolveError, onResolve }) => {
  const intl = useIntl();
  const { listingTitle, customerName, providerName, priceAmount, priceCurrency, disputedAt, transitions } =
    dispute;

  return (
    <li className={css.card}>
      <div className={css.cardHeader}>
        <span className={css.listingTitle}>{listingTitle}</span>
        {Number.isFinite(priceAmount) && priceCurrency ? (
          <span className={css.price}>{formatMoney(intl, new Money(priceAmount, priceCurrency))}</span>
        ) : null}
      </div>

      <p className={css.parties}>
        <FormattedMessage
          id="AdminDisputesPage.parties"
          values={{ customer: customerName, provider: providerName }}
        />
      </p>

      {disputedAt ? (
        <p className={css.disputedSince}>
          <FormattedMessage
            id="AdminDisputesPage.disputedSince"
            values={{ date: intl.formatDate(new Date(disputedAt)) }}
          />
        </p>
      ) : null}

      <TransitionHistory transitions={transitions} intl={intl} />

      {resolveError ? <ErrorMessage error={resolveError} /> : null}

      <div className={css.actions}>
        <Button
          type="button"
          className={css.payCreatorButton}
          inProgress={isResolving}
          disabled={isResolving}
          onClick={() => onResolve('payCreator')}
        >
          <FormattedMessage id="AdminDisputesPage.payCreator" />
        </Button>
        <SecondaryButton
          type="button"
          className={css.refundBrandButton}
          inProgress={isResolving}
          disabled={isResolving}
          onClick={() => onResolve('refundBrand')}
        >
          <FormattedMessage id="AdminDisputesPage.refundBrand" />
        </SecondaryButton>
      </div>
    </li>
  );
};

/**
 * Dispute mediation (IMPLEMENTATION-PLAN.md F5.3, BLUEPRINT §5) — every
 * cgc-ugc-approval transaction currently in the `disputed` state, with its
 * full transition history and two resolutions: pay the creator
 * (mark-received-from-disputed) or refund the brand
 * (cancel-from-disputed). Both are operator-actor transitions, only
 * reachable through the Integration API (server/api/admin/disputes.js).
 *
 * @returns {JSX.Element}
 */
const AdminDisputesPage = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(isScrollingDisabled);

  const [gateStatus, setGateStatus] = useState('checking');
  const [disputes, setDisputes] = useState([]);
  const [fetchInProgress, setFetchInProgress] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveErrorId, setResolveErrorId] = useState(null);
  const [resolveError, setResolveError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminStatus()
      .then(() => {
        if (cancelled) return;
        setGateStatus('allowed');
        setFetchInProgress(true);
        fetchDisputes()
          .then(({ disputes: fetched }) => {
            if (cancelled) return;
            setDisputes(fetched);
            setFetchInProgress(false);
          })
          .catch(e => {
            if (cancelled) return;
            setFetchError(storableError(e));
            setFetchInProgress(false);
          });
      })
      .catch(() => {
        if (!cancelled) setGateStatus('denied');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (gateStatus === 'denied') {
    return <NamedRedirect name={getRoleHomeRouteName(config, currentUser)} />;
  }

  const handleResolve = (transactionId, resolution) => {
    setResolvingId(transactionId);
    setResolveErrorId(null);
    setResolveError(null);
    resolveDispute(transactionId, resolution)
      .then(() => {
        setDisputes(prev => prev.filter(d => d.id !== transactionId));
        setResolvingId(null);
      })
      .catch(e => {
        setResolveErrorId(transactionId);
        setResolveError(storableError(e));
        setResolvingId(null);
      });
  };

  const title = intl.formatMessage({ id: 'AdminDisputesPage.schemaTitle' });
  const displayName = currentUser?.attributes?.profile?.displayName;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={<DashboardTopbar displayName={displayName} onLogout={() => dispatch(logout())} />}
      >
        <div className={css.root}>
          {gateStatus === 'checking' ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : (
            <>
              <Heading as="h1" rootClassName={css.heading}>
                <FormattedMessage id="AdminDisputesPage.heading" />
              </Heading>

              {fetchError ? (
                <ErrorMessage error={fetchError} />
              ) : fetchInProgress ? (
                <div className={css.loading}>
                  <IconSpinner />
                </div>
              ) : disputes.length === 0 ? (
                <p className={css.empty}>
                  <FormattedMessage id="AdminDisputesPage.empty" />
                </p>
              ) : (
                <ul className={css.list}>
                  {disputes.map(dispute => (
                    <DisputeCard
                      key={dispute.id}
                      dispute={dispute}
                      isResolving={resolvingId === dispute.id}
                      resolveError={resolveErrorId === dispute.id ? resolveError : null}
                      onResolve={resolution => handleResolve(dispute.id, resolution)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default AdminDisputesPage;
