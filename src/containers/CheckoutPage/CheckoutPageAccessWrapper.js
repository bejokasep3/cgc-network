import React from 'react';
import { useSelector } from 'react-redux';
import {
  NO_ACCESS_PAGE_INITIATE_TRANSACTIONS,
  NO_ACCESS_PAGE_USER_PENDING_APPROVAL,
} from '../../util/urlHelpers';
import { REQUEST, CGC_UGC_PROCESS_NAME } from '../../transactions/transaction';
import { hasPermissionToInitiateTransactions, isUserAuthorized } from '../../util/userHelpers';
import { isErrorNoPermissionForInitiateTransactions } from '../../util/errors';
import { checkBrandAccess, isSubscriptionStatusResolved } from '../../util/subscription';
import { NamedRedirect, IconSpinner } from '../../components';
import css from './CheckoutPage.module.css';

/**
 * Handles access control on the CheckoutPage.
 *
 * @param {Object} props
 * @param {React.ComponentType} props.PageComponent - Checkout page component receiving injected props
 * @param {Object} props.currentUser - Current user from Redux state
 * @param {Object} [props.initiateOrderError] - Error from initiating an order
 * @returns {JSX.Element}
 */
const CheckoutPageAccessWrapper = props => {
  const {
    PageComponent,
    currentUser,
    initiateOrderError,
    history,
    pageData,
    isDataLoaded,
    processName,
    params,
    ...rest
  } = props;
  const listing = pageData?.listing;
  const unitType = listing?.attributes?.publicData?.unitType;
  const isRequest = unitType === REQUEST;
  const isOwnListing = currentUser?.id && listing?.author?.id?.uuid === currentUser?.id?.uuid;
  const hasRequiredData = !!(listing?.id && listing?.author?.id && processName);
  const shouldRedirect = isDataLoaded && !(hasRequiredData && (!isOwnListing || isRequest));

  const brandSubscriptionState = useSelector(state => state.brandSubscription);
  const subscriptionStatus = brandSubscriptionState.status;
  const subscriptionResolved = isSubscriptionStatusResolved(brandSubscriptionState);

  // Redirect back to ListingPage if data is missing.
  // Redirection must happen before any data format error is thrown (e.g. wrong currency)
  if (shouldRedirect) {
    console.error('Missing or invalid data for checkout, redirecting back to listing page.', {
      listing,
    });
    return <NamedRedirect name="ListingPage" params={params} />;
  }

  if (currentUser && !isUserAuthorized(currentUser)) {
    return (
      <NamedRedirect
        name="NoAccessPage"
        params={{ missingAccessRight: NO_ACCESS_PAGE_USER_PENDING_APPROVAL }}
      />
    );
  }

  // Checking out against a creator-profile listing always means the current
  // user is acting as the brand (customer) — CGC's process is asymmetric, so
  // the creator never reaches this page as the one paying.
  if (currentUser && processName === CGC_UGC_PROCESS_NAME) {
    if (!subscriptionResolved) {
      // Never flash the subscribe paywall at a paying brand: wait for the
      // status fetch that user.duck.js kicks off on login before deciding.
      return <IconSpinner className={css.spinner} />;
    }
    if (!checkBrandAccess({ status: subscriptionStatus, isBrand: true }).allowed) {
      return <NamedRedirect name="SubscriptionPage" />;
    }
  }

  if (
    currentUser &&
    (!hasPermissionToInitiateTransactions(currentUser) ||
      isErrorNoPermissionForInitiateTransactions(initiateOrderError))
  ) {
    return (
      <NamedRedirect
        name="NoAccessPage"
        params={{ missingAccessRight: NO_ACCESS_PAGE_INITIATE_TRANSACTIONS }}
      />
    );
  }

  return (
    <PageComponent
      history={history}
      currentUser={currentUser}
      initiateOrderError={initiateOrderError}
      pageData={pageData}
      isDataLoaded={isDataLoaded}
      params={params}
      processName={processName}
      {...rest}
    />
  );
};

export default CheckoutPageAccessWrapper;
