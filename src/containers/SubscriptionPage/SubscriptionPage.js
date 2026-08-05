import React, { useEffect } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import { parse } from '../../util/urlHelpers';
import { hasActiveBrandSubscription } from '../../util/subscription';
import { formatMoney } from '../../util/currency';
import { types as sdkTypes } from '../../util/sdkLoader';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { isUserAuthorized } from '../../util/userHelpers';
import {
  fetchBrandSubscription,
  fetchBrandSubscriptionPrice,
  startBrandSubscriptionCheckout,
  openBillingPortal,
} from '../../ducks/brandSubscription.duck';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  PrimaryButton,
  SecondaryButton,
  IconSpinner,
  IconCheckmark,
  NamedRedirect,
} from '../../components';

import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './SubscriptionPage.module.css';

const { Money } = sdkTypes;

const PLAN_BENEFIT_COUNT = 5;

/**
 * Brand subscription page.
 *
 * Brands land here either deliberately or after hitting a gated action. It shows
 * the plan, starts Stripe Checkout, and — once subscribed — links out to Stripe's
 * billing portal for card changes and cancellation. No payment details are ever
 * entered or displayed in this app.
 *
 * @param {Object} props
 * @param {propTypes.currentUser} props.currentUser - The current user
 * @param {Object|null} props.status - Live subscription status from Stripe
 * @param {boolean} props.fetchInProgress - Whether the status is being fetched
 * @param {propTypes.error} props.fetchError - Error from fetching the status
 * @param {Object|null} props.price - Live { unitAmount, currency, interval, intervalCount } from Stripe
 * @param {boolean} props.checkoutInProgress - Whether checkout is being started
 * @param {propTypes.error} props.checkoutError - Error from starting checkout
 * @param {boolean} props.billingPortalInProgress - Whether the portal is being opened
 * @param {propTypes.error} props.billingPortalError - Error from opening the portal
 * @param {boolean} props.scrollingDisabled - Whether scrolling is disabled
 * @param {Function} props.onFetchStatus - Fetches the subscription status
 * @param {Function} props.onFetchPrice - Fetches the live plan price
 * @param {Function} props.onStartCheckout - Redirects to Stripe Checkout
 * @param {Function} props.onOpenBillingPortal - Redirects to the Stripe billing portal
 * @returns {JSX.Element}
 */
export const SubscriptionPageComponent = props => {
  const intl = useIntl();
  const location = useLocation();
  const {
    currentUser,
    status,
    fetchInProgress,
    fetchError,
    price,
    checkoutInProgress,
    checkoutError,
    billingPortalInProgress,
    billingPortalError,
    scrollingDisabled,
    onFetchStatus,
    onFetchPrice,
    onStartCheckout,
    onOpenBillingPortal,
    onLogout,
  } = props;

  const displayName = currentUser?.attributes?.profile?.displayName;

  // Stripe redirects back here after checkout. The subscription may take a moment
  // to appear, so we simply re-read the live status on mount.
  // `reason` is set by pages that bounce an unsubscribed brand here (e.g.
  // PostProjectPage.js), so this can explain why instead of just landing on
  // a bare pricing card with no context.
  const { status: checkoutOutcome, reason } = parse(location.search);
  const reasonMessageId = reason === 'post-project' ? 'SubscriptionPage.reasonPostProject' : null;

  useEffect(() => {
    onFetchStatus();
    onFetchPrice();
  }, [onFetchStatus, onFetchPrice]);

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  // Price is a nice-to-have for the sales pitch, not a gate — if it fails to
  // load, the card and Subscribe button below still work fine without it.
  const priceMaybe = price ? (
    <p className={css.price}>
      <span className={css.priceAmount}>{formatMoney(intl, new Money(price.unitAmount, price.currency))}</span>
      <span className={css.priceInterval}>
        <FormattedMessage
          id="SubscriptionPage.priceSuffix"
          values={{ intervalCount: price.intervalCount, interval: price.interval }}
        />
      </span>
    </p>
  ) : null;

  const isActive = hasActiveBrandSubscription(status);
  const isResolved = status !== null && !fetchInProgress;
  const needsCardUpdate = ['past_due', 'unpaid'].includes(status?.status);

  const title = intl.formatMessage({ id: 'SubscriptionPage.schemaTitle' });

  const benefits = Array.from({ length: PLAN_BENEFIT_COUNT }, (_, i) => (
    <li key={i} className={css.benefit}>
      <span className={css.benefitIconWrapper}>
        <IconCheckmark className={css.benefitIcon} size="small" />
      </span>
      <FormattedMessage id={`SubscriptionPage.benefit${i + 1}`} />
    </li>
  ));

  const errorMaybe = [fetchError, checkoutError, billingPortalError].find(Boolean) ? (
    <p className={css.error}>
      <FormattedMessage id="SubscriptionPage.genericError" />
    </p>
  ) : null;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={<DashboardTopbar displayName={displayName} role="brand" onLogout={onLogout} />}
        footer={<FooterContainer />}
      >
        <div className={css.root}>
          {checkoutOutcome === 'canceled' ? (
            <p className={css.notice}>
              <FormattedMessage id="SubscriptionPage.checkoutCanceled" />
            </p>
          ) : reasonMessageId && !isActive ? (
            <p className={css.notice}>
              <FormattedMessage id={reasonMessageId} />
            </p>
          ) : null}

          <Heading as="h1" rootClassName={css.title}>
            <FormattedMessage
              id={isActive ? 'SubscriptionPage.activeTitle' : 'SubscriptionPage.title'}
            />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage
              id={isActive ? 'SubscriptionPage.activeSubtitle' : 'SubscriptionPage.subtitle'}
            />
          </p>

          <div className={css.card}>
            <Heading as="h2" rootClassName={css.planName}>
              <FormattedMessage id="SubscriptionPage.planName" />
            </Heading>
            {priceMaybe}
            <ul className={css.benefits}>{benefits}</ul>

            {!isResolved ? (
              <div className={css.loading}>
                <IconSpinner />
              </div>
            ) : isActive ? (
              <>
                <p className={css.statusLine}>
                  <FormattedMessage
                    id={
                      status.cancelAtPeriodEnd
                        ? 'SubscriptionPage.statusEnding'
                        : 'SubscriptionPage.statusActive'
                    }
                  />
                </p>
                <SecondaryButton
                  onClick={onOpenBillingPortal}
                  inProgress={billingPortalInProgress}
                  disabled={billingPortalInProgress}
                >
                  <FormattedMessage id="SubscriptionPage.manageSubscription" />
                </SecondaryButton>
              </>
            ) : (
              <>
                {needsCardUpdate ? (
                  <p className={css.statusLine}>
                    <FormattedMessage id="SubscriptionPage.statusPaymentFailed" />
                  </p>
                ) : null}
                {needsCardUpdate ? (
                  <PrimaryButton
                    onClick={onOpenBillingPortal}
                    inProgress={billingPortalInProgress}
                    disabled={billingPortalInProgress}
                  >
                    <FormattedMessage id="SubscriptionPage.updatePayment" />
                  </PrimaryButton>
                ) : (
                  <PrimaryButton
                    onClick={onStartCheckout}
                    inProgress={checkoutInProgress}
                    disabled={checkoutInProgress}
                  >
                    <FormattedMessage id="SubscriptionPage.subscribe" />
                  </PrimaryButton>
                )}
              </>
            )}

            {errorMaybe}
            <p className={css.fineprint}>
              <FormattedMessage id="SubscriptionPage.fineprint" />
            </p>
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  const {
    status,
    fetchInProgress,
    fetchError,
    price,
    checkoutInProgress,
    checkoutError,
    billingPortalInProgress,
    billingPortalError,
  } = state.brandSubscription;

  return {
    currentUser,
    status,
    fetchInProgress,
    fetchError,
    price,
    checkoutInProgress,
    checkoutError,
    billingPortalInProgress,
    billingPortalError,
    scrollingDisabled: isScrollingDisabled(state),
  };
};

const mapDispatchToProps = dispatch => ({
  onFetchStatus: () => dispatch(fetchBrandSubscription()),
  onFetchPrice: () => dispatch(fetchBrandSubscriptionPrice()),
  onStartCheckout: () => dispatch(startBrandSubscriptionCheckout()),
  onOpenBillingPortal: () => dispatch(openBillingPortal()),
  onLogout: () => dispatch(logout()),
});

const SubscriptionPage = compose(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )
)(SubscriptionPageComponent);

export default SubscriptionPage;
