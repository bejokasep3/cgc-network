import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { createResourceLocatorString } from '../../util/routes';
import { submitApplication } from '../../util/api';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { fetchCurrentUser } from '../../ducks/user.duck';
import { storableError } from '../../util/errors';

import { Heading, Page, LayoutSingleColumn, TopbarSimplified } from '../../components';
import RequestAccessForm from './RequestAccessForm';

import css from './RequestAccessPage.module.css';

/**
 * B2 in BLUEPRINT's brand flow: the access-request form, submitted once
 * right after signup while the account is still in Sharetribe's built-in
 * `pending-approval` state (see AuthenticationPage.js's post-signup
 * redirect).
 *
 * @returns {JSX.Element}
 */
const RequestAccessPage = () => {
  const intl = useIntl();
  const routeConfiguration = useRouteConfiguration();
  const dispatch = useDispatch();
  const history = useHistory();

  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));

  const [submitInProgress, setSubmitInProgress] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleSubmit = values => {
    const { company, website, category, monthlyVolume, budgetRange, source } = values;

    setSubmitInProgress(true);
    setSubmitError(null);
    submitApplication({
      type: 'brand',
      company,
      website,
      category,
      monthlyVolume,
      budgetRange,
      source,
    })
      // The write above goes through the Integration SDK (server-side), so the
      // client's cached currentUser never sees the new privateData.accessRequest
      // on its own — refetch before navigating, or PendingPage reads stale data
      // and thinks nothing was submitted.
      .then(() => dispatch(fetchCurrentUser({ enforce: true })))
      .then(() => {
        setSubmitInProgress(false);
        history.push(createResourceLocatorString('PendingPage', routeConfiguration, {}, {}));
      })
      .catch(e => {
        setSubmitInProgress(false);
        setSubmitError(storableError(e));
      });
  };

  const title = intl.formatMessage({ id: 'RequestAccessPage.schemaTitle' });

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={<TopbarSimplified onLogout={() => dispatch(logout())} />}
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="RequestAccessPage.heading" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="RequestAccessPage.subtitle" />
          </p>

          <RequestAccessForm
            onSubmit={handleSubmit}
            inProgress={submitInProgress}
            apiSubmitError={submitError}
          />
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default RequestAccessPage;
