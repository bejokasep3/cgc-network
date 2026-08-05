import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { getRoleHomeRouteName } from '../../util/userHelpers';
import { storableError } from '../../util/errors';
import {
  fetchAdminStatus,
  fetchAdminApplicants,
  approveApplicant,
  decideApplicant,
} from '../../util/api';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';

import { Heading, Page, LayoutSingleColumn, NamedRedirect, IconSpinner, ErrorMessage } from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import ApplicantReviewCard from './ApplicantReviewCard';

import css from './AdminApplicationsPage.module.css';

const STATUS_FILTERS = ['pending', 'rejected', 'moreInfoRequested'];

const filterApplicants = (applicants, statusFilter) =>
  applicants.filter(a => (a.decision?.status || 'pending') === statusFilter);

/**
 * The operator's daily application queue (IMPLEMENTATION-PLAN.md F5.2,
 * BLUEPRINT B3) — pending-approval creators and brands, with the material
 * an operator actually needs to decide: sample works, social handles,
 * company/website. Gated the same way as AdminPage.js (server-verified via
 * fetchAdminStatus on every visit, not a client-only check).
 *
 * @returns {JSX.Element}
 */
const AdminApplicationsPage = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(isScrollingDisabled);

  const [gateStatus, setGateStatus] = useState('checking'); // 'checking' | 'allowed' | 'denied'
  const [applicants, setApplicants] = useState([]);
  const [fetchInProgress, setFetchInProgress] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actioningId, setActioningId] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminStatus()
      .then(() => {
        if (cancelled) return;
        setGateStatus('allowed');
        setFetchInProgress(true);
        fetchAdminApplicants()
          .then(({ applicants: fetched }) => {
            if (cancelled) return;
            setApplicants(fetched);
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

  const handleApprove = applicantId => {
    setActioningId(applicantId);
    setActionError(null);
    approveApplicant(applicantId)
      .then(() => {
        setApplicants(prev => prev.filter(a => a.id !== applicantId));
        setActioningId(null);
      })
      .catch(e => {
        setActionError(storableError(e));
        setActioningId(null);
      });
  };

  const handleDecide = (applicantId, status, note) => {
    setActioningId(applicantId);
    setActionError(null);
    decideApplicant(applicantId, status, note)
      .then(() => {
        setApplicants(prev =>
          prev.map(a =>
            a.id === applicantId
              ? { ...a, decision: { status, note, decidedAt: new Date().toISOString() } }
              : a
          )
        );
        setActioningId(null);
      })
      .catch(e => {
        setActionError(storableError(e));
        setActioningId(null);
      });
  };

  const title = intl.formatMessage({ id: 'AdminApplicationsPage.schemaTitle' });
  const displayName = currentUser?.attributes?.profile?.displayName;
  const visibleApplicants = filterApplicants(applicants, statusFilter);

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
                <FormattedMessage id="AdminApplicationsPage.heading" />
              </Heading>

              <div className={css.filterRow}>
                {STATUS_FILTERS.map(status => (
                  <button
                    key={status}
                    type="button"
                    className={classNames(css.filterTab, {
                      [css.filterTabActive]: statusFilter === status,
                    })}
                    onClick={() => setStatusFilter(status)}
                  >
                    <FormattedMessage
                      id={`AdminApplicationsPage.filter.${status}`}
                      values={{
                        count: filterApplicants(applicants, status).length,
                      }}
                    />
                  </button>
                ))}
              </div>

              {fetchError ? (
                <ErrorMessage error={fetchError} />
              ) : fetchInProgress ? (
                <div className={css.loading}>
                  <IconSpinner />
                </div>
              ) : visibleApplicants.length === 0 ? (
                <p className={css.empty}>
                  <FormattedMessage id="AdminApplicationsPage.empty" />
                </p>
              ) : (
                <ul className={css.list}>
                  {visibleApplicants.map(applicant => (
                    <ApplicantReviewCard
                      key={applicant.id}
                      applicant={applicant}
                      listingFieldsConfig={config.listing.listingFields}
                      marketplaceCurrency={config.currency}
                      isActioning={actioningId === applicant.id}
                      actionError={actioningId === applicant.id ? actionError : null}
                      onApprove={() => handleApprove(applicant.id)}
                      onDecide={(status, note) => handleDecide(applicant.id, status, note)}
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

export default AdminApplicationsPage;
