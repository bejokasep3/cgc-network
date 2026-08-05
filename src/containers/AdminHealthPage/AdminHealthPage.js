import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { getRoleHomeRouteName } from '../../util/userHelpers';
import { storableError } from '../../util/errors';
import { fetchAdminStatus, fetchAdminHealth } from '../../util/api';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';

import { Heading, Page, LayoutSingleColumn, NamedRedirect, IconSpinner, ErrorMessage } from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';

import css from './AdminHealthPage.module.css';

const RatioCard = ({ userCounts }) => {
  const { brand, creator } = userCounts;
  return (
    <div className={css.card}>
      <Heading as="h2" rootClassName={css.cardHeading}>
        <FormattedMessage id="AdminHealthPage.ratioHeading" />
      </Heading>
      <div className={css.ratioRow}>
        <div className={css.ratioStat}>
          <span className={css.ratioNumber}>{brand}</span>
          <span className={css.ratioLabel}>
            <FormattedMessage id="AdminHealthPage.brands" />
          </span>
        </div>
        <span className={css.ratioColon}>:</span>
        <div className={css.ratioStat}>
          <span className={css.ratioNumber}>{creator}</span>
          <span className={css.ratioLabel}>
            <FormattedMessage id="AdminHealthPage.creators" />
          </span>
        </div>
      </div>
    </div>
  );
};

const ListCard = ({ headingId, emptyId, items, renderItem }) => (
  <div className={css.card}>
    <Heading as="h2" rootClassName={css.cardHeading}>
      <FormattedMessage id={headingId} values={{ count: items.length }} />
    </Heading>
    {items.length === 0 ? (
      <p className={css.cardEmpty}>
        <FormattedMessage id={emptyId} />
      </p>
    ) : (
      <ul className={css.cardList}>{items.map(renderItem)}</ul>
    )}
  </div>
);

/**
 * Network health dashboard (IMPLEMENTATION-PLAN.md F5.3): brand:creator
 * ratio, projects without applicants, creators without a project, and
 * collaborations approaching their content due date — the aggregation
 * itself happens server-side (server/api/admin/health.js) since it needs
 * the Integration API.
 *
 * @returns {JSX.Element}
 */
const AdminHealthPage = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(isScrollingDisabled);

  const [gateStatus, setGateStatus] = useState('checking');
  const [health, setHealth] = useState(null);
  const [fetchInProgress, setFetchInProgress] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminStatus()
      .then(() => {
        if (cancelled) return;
        setGateStatus('allowed');
        setFetchInProgress(true);
        fetchAdminHealth()
          .then(result => {
            if (cancelled) return;
            setHealth(result);
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

  const title = intl.formatMessage({ id: 'AdminHealthPage.schemaTitle' });
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
                <FormattedMessage id="AdminHealthPage.heading" />
              </Heading>

              {fetchError ? (
                <ErrorMessage error={fetchError} />
              ) : fetchInProgress || !health ? (
                <div className={css.loading}>
                  <IconSpinner />
                </div>
              ) : (
                <div className={css.grid}>
                  <RatioCard userCounts={health.userCounts} />

                  <ListCard
                    headingId="AdminHealthPage.projectsWithoutApplicantsHeading"
                    emptyId="AdminHealthPage.projectsWithoutApplicantsEmpty"
                    items={health.projectsWithoutApplicants}
                    renderItem={project => (
                      <li key={project.id} className={css.cardListItem}>
                        {project.title}
                      </li>
                    )}
                  />

                  <ListCard
                    headingId="AdminHealthPage.creatorsWithoutProjectsHeading"
                    emptyId="AdminHealthPage.creatorsWithoutProjectsEmpty"
                    items={health.creatorsWithoutProjects}
                    renderItem={creator => (
                      <li key={creator.id} className={css.cardListItem}>
                        {creator.displayName}
                      </li>
                    )}
                  />

                  <ListCard
                    headingId="AdminHealthPage.deadlinesHeading"
                    emptyId="AdminHealthPage.deadlinesEmpty"
                    items={health.collaborationsNearingDeadline}
                    renderItem={collaboration => (
                      <li key={collaboration.id} className={css.cardListItem}>
                        <span>{collaboration.listingTitle}</span>
                        <span
                          className={classNames(css.deadlineTag, {
                            [css.deadlineOverdue]: collaboration.daysRemaining < 0,
                          })}
                        >
                          {collaboration.daysRemaining < 0 ? (
                            <FormattedMessage
                              id="AdminHealthPage.overdueBy"
                              values={{ days: Math.abs(collaboration.daysRemaining) }}
                            />
                          ) : (
                            <FormattedMessage
                              id="AdminHealthPage.dueInDays"
                              values={{ days: collaboration.daysRemaining }}
                            />
                          )}
                        </span>
                      </li>
                    )}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default AdminHealthPage;
