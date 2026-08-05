import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { fetchAdminStatus } from '../../util/api';
import { getRoleHomeRouteName } from '../../util/userHelpers';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  NamedRedirect,
  NamedLink,
  IconSpinner,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';

import css from './AdminPage.module.css';

/**
 * Landing page for the operator console (IMPLEMENTATION-PLAN.md F5.1). The
 * checklist/publicData userType shown in src/util/operator.js is only a
 * hint — real authorization is asked of the server on every visit via
 * fetchAdminStatus, since userType alone is data the account owner could set
 * on themselves (see server/api-util/operator.js for why).
 *
 * Deliberately just a gate + links to the operator sub-pages — the
 * application queue (F5.2), invite codes, dispute mediation, and network
 * health (F5.3) each live on their own page.
 *
 * @returns {JSX.Element}
 */
const AdminPage = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(isScrollingDisabled);

  const [status, setStatus] = useState('checking'); // 'checking' | 'allowed' | 'denied'

  useEffect(() => {
    let cancelled = false;
    fetchAdminStatus()
      .then(() => {
        if (!cancelled) setStatus('allowed');
      })
      .catch(() => {
        if (!cancelled) setStatus('denied');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'denied') {
    return <NamedRedirect name={getRoleHomeRouteName(config, currentUser)} />;
  }

  const title = intl.formatMessage({ id: 'AdminPage.schemaTitle' });
  const displayName = currentUser?.attributes?.profile?.displayName;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={<DashboardTopbar displayName={displayName} onLogout={() => dispatch(logout())} />}
      >
        <div className={css.root}>
          {status === 'checking' ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : (
            <>
              <Heading as="h1" rootClassName={css.heading}>
                <FormattedMessage id="AdminPage.heading" />
              </Heading>
              <p className={css.subtitle}>
                <FormattedMessage id="AdminPage.subtitle" />
              </p>
              <div className={css.linkList}>
                <NamedLink className={css.applicationsLink} name="AdminApplicationsPage">
                  <FormattedMessage id="AdminPage.applicationsLink" />
                </NamedLink>
                <NamedLink className={css.secondaryLink} name="AdminInvitesPage">
                  <FormattedMessage id="AdminPage.invitesLink" />
                </NamedLink>
                <NamedLink className={css.secondaryLink} name="AdminDisputesPage">
                  <FormattedMessage id="AdminPage.disputesLink" />
                </NamedLink>
                <NamedLink className={css.secondaryLink} name="AdminHealthPage">
                  <FormattedMessage id="AdminPage.healthLink" />
                </NamedLink>
              </div>
            </>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default AdminPage;
