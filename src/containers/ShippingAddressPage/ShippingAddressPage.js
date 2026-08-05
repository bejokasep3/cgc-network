import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { createResourceLocatorString } from '../../util/routes';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { storableError } from '../../util/errors';
import { isUserAuthorized } from '../../util/userHelpers';

import { Heading, Page, LayoutSingleColumn, NamedRedirect } from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import ShippingAddressForm from './ShippingAddressForm';
import { saveShippingAddressThunk } from './ShippingAddressPage.duck';

import css from './ShippingAddressPage.module.css';

/**
 * A creator's own default shipping address — one step in the onboarding
 * checklist (creatorSetupSteps.js). Saved straight to the current user's own
 * privateData, so it can later prefill the per-collaboration
 * "addShippingAddress" modal (TransactionPage/CGCActionModal) instead of
 * asking the creator to retype it every time.
 *
 * @returns {JSX.Element}
 */
const ShippingAddressPage = () => {
  const intl = useIntl();
  const routeConfiguration = useRouteConfiguration();
  const dispatch = useDispatch();
  const history = useHistory();
  const [submitInProgress, setSubmitInProgress] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const displayName = currentUser?.attributes?.profile?.displayName;
  const shippingAddress = currentUser?.attributes?.profile?.privateData?.shippingAddress || {};

  const handleSubmit = values => {
    setSubmitInProgress(true);
    setSubmitError(null);
    dispatch(saveShippingAddressThunk(values))
      .then(action => {
        setSubmitInProgress(false);
        if (saveShippingAddressThunk.rejected.match(action)) {
          setSubmitError(action.payload);
          return;
        }
        history.push(createResourceLocatorString('CreatorOnboardingPage', routeConfiguration, {}, {}));
      })
      .catch(e => {
        setSubmitInProgress(false);
        setSubmitError(storableError(e));
      });
  };

  const title = intl.formatMessage({ id: 'ShippingAddressPage.schemaTitle' });

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            role="creator"
            onLogout={() => dispatch(logout())}
          />
        }
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="ShippingAddressPage.heading" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="ShippingAddressPage.subtitle" />
          </p>

          <ShippingAddressForm
            initialValues={shippingAddress}
            onSubmit={handleSubmit}
            inProgress={submitInProgress}
            apiSubmitError={submitError}
          />
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default ShippingAddressPage;
