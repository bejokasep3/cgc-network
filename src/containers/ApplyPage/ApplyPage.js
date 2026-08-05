import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { parse } from '../../util/urlHelpers';
import { createResourceLocatorString } from '../../util/routes';
import { submitApplication } from '../../util/api';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { fetchCurrentUser } from '../../ducks/user.duck';
import { storableError } from '../../util/errors';

import { Heading, Page, LayoutSingleColumn, TopbarSimplified } from '../../components';
import ApplyForm from './ApplyForm';

import css from './ApplyPage.module.css';

/**
 * B-side of F4.1: the creator's application form, submitted once right
 * after signup while the account is still in Sharetribe's built-in
 * `pending-approval` state (see AuthenticationPage.js's post-signup
 * redirect). `?code=` carries an optional invite code (F5.3 — captured here
 * unvalidated, since there's no redemption system yet, per §2.7).
 *
 * @param {Object} props
 * @param {Object} props.location - route location, expects ?code=<inviteCode>
 * @returns {JSX.Element}
 */
const ApplyPage = props => {
  const { location } = props;
  const intl = useIntl();
  const config = useConfiguration();
  const routeConfiguration = useRouteConfiguration();
  const dispatch = useDispatch();
  const history = useHistory();

  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));

  const [submitInProgress, setSubmitInProgress] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const inviteCode = parse(location?.search || '')?.code || null;

  const handleSubmit = values => {
    const { handles, sampleWork0, sampleWork1, sampleWork2, niches, typicalTurnaroundDays, indicativeRate } = values;

    const body = {
      type: 'creator',
      handles: (handles || []).map(h => ({
        platform: h.platform,
        url: h.url,
        followers: h.followers ? Number.parseInt(h.followers, 10) : null,
      })),
      sampleWorks: [sampleWork0, sampleWork1, sampleWork2],
      niches,
      typicalTurnaroundDays: Number.parseInt(typicalTurnaroundDays, 10),
      indicativeRateInSubunits: indicativeRate?.amount,
      ...(inviteCode ? { inviteCode } : {}),
    };

    setSubmitInProgress(true);
    setSubmitError(null);
    submitApplication(body)
      // The write above goes through the Integration SDK (server-side), so the
      // client's cached currentUser never sees the new privateData.application
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

  const title = intl.formatMessage({ id: 'ApplyPage.schemaTitle' });

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={<TopbarSimplified onLogout={() => dispatch(logout())} />}
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="ApplyPage.heading" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="ApplyPage.subtitle" />
          </p>

          <ApplyForm
            onSubmit={handleSubmit}
            listingFieldsConfig={config.listing.listingFields}
            marketplaceCurrency={config.currency}
            inProgress={submitInProgress}
            apiSubmitError={submitError}
          />
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default ApplyPage;
