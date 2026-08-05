import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

import { pick } from '../../util/common';
import { initiatePrivileged, transitionPrivileged } from '../../util/api';
import { denormalisedResponseEntities } from '../../util/data';
import { storableError } from '../../util/errors';
import * as log from '../../util/log';
import { setCurrentUserHasOrders, fetchCurrentUser } from '../../ducks/user.duck';
import { transitions as applicationTransitions } from '../../transactions/transactionProcessCGCApplication';
import { CGC_APPLICATION_PROCESS_NAME } from '../../transactions/transaction';

// ================ Async thunks ================ //

////////////////////
// Initiate Order //
////////////////////
const initiateOrderPayloadCreator = (
  { orderParams, processAlias, transactionId, transitionName, isPrivilegedTransition },
  { dispatch, extra: sdk, rejectWithValue }
) => {
  // If we already have a transaction ID, we should transition, not initiate.
  const isTransition = !!transactionId;

  const {
    deliveryMethod,
    quantity,
    bookingDates,
    applicationId,
    currency,
    ...otherOrderParams
  } = orderParams;
  const quantityMaybe = quantity ? { stockReservationQuantity: quantity } : {};
  const bookingParamsMaybe = bookingDates || {};

  // Parameters only for client app's server. `applicationId` (F2.6) is never
  // sent to the Marketplace API itself — it's how the server looks up the
  // accepted cgc-application's agreed price (IMPLEMENTATION-PLAN.md 2.6).
  // `currency` is the marketplace currency, sent for the same reason: a
  // creator-profile listing has no attributes.price of its own for the
  // server to derive a currency from.
  const orderData = {
    ...(deliveryMethod ? { deliveryMethod } : {}),
    ...(applicationId ? { applicationId } : {}),
    ...(currency ? { currency } : {}),
  };

  // Parameters for Marketplace API
  const transitionParams = {
    ...quantityMaybe,
    ...bookingParamsMaybe,
    ...otherOrderParams,
  };

  const bodyParams = isTransition
    ? {
        id: transactionId,
        transition: transitionName,
        params: transitionParams,
      }
    : {
        processAlias,
        transition: transitionName,
        params: transitionParams,
      };
  const queryParams = {
    include: ['booking', 'provider'],
    expand: true,
  };

  const handleSuccess = response => {
    const entities = denormalisedResponseEntities(response);
    const order = entities[0];
    dispatch(setCurrentUserHasOrders());
    return order;
  };

  const handleError = e => {
    const transactionIdMaybe = transactionId ? { transactionId: transactionId.uuid } : {};
    log.error(e, 'initiate-order-failed', {
      ...transactionIdMaybe,
      listingId: orderParams.listingId.uuid,
      ...quantityMaybe,
      ...bookingParamsMaybe,
      ...orderData,
      statusText: e.statusText,
    });
    return rejectWithValue(storableError(e));
  };

  if (isTransition && isPrivilegedTransition) {
    // transition privileged
    return transitionPrivileged({ isSpeculative: false, orderData, bodyParams, queryParams })
      .then(handleSuccess)
      .catch(handleError);
  } else if (isTransition) {
    // transition non-privileged
    return sdk.transactions
      .transition(bodyParams, queryParams)
      .then(handleSuccess)
      .catch(handleError);
  } else if (isPrivilegedTransition) {
    // initiate privileged
    return initiatePrivileged({ isSpeculative: false, orderData, bodyParams, queryParams })
      .then(handleSuccess)
      .catch(handleError);
  } else {
    // initiate non-privileged
    return sdk.transactions
      .initiate(bodyParams, queryParams)
      .then(handleSuccess)
      .catch(handleError);
  }
};

export const initiateOrderThunk = createAsyncThunk(
  'CheckoutPage/initiateOrder',
  initiateOrderPayloadCreator
);
// Backward compatible wrapper function for initiateOrder
export const initiateOrder = (
  orderParams,
  processAlias,
  transactionId,
  transitionName,
  isPrivilegedTransition
) => dispatch => {
  return dispatch(
    initiateOrderThunk({
      orderParams,
      processAlias,
      transactionId,
      transitionName,
      isPrivilegedTransition,
    })
  ).unwrap();
};

/////////////////////
// Confirm Payment //
/////////////////////
const confirmPaymentPayloadCreator = (
  { transactionId, transitionName, transitionParams = {} },
  { extra: sdk, rejectWithValue }
) => {
  const bodyParams = {
    id: transactionId,
    transition: transitionName,
    params: transitionParams,
  };
  const queryParams = {
    include: ['booking', 'provider'],
    expand: true,
  };

  return sdk.transactions
    .transition(bodyParams, queryParams)
    .then(response => {
      const order = response.data.data;
      return order;
    })
    .catch(e => {
      const transactionIdMaybe = transactionId ? { transactionId: transactionId.uuid } : {};
      log.error(e, 'initiate-order-failed', {
        ...transactionIdMaybe,
      });
      return rejectWithValue(storableError(e));
    });
};

export const confirmPaymentThunk = createAsyncThunk(
  'CheckoutPage/confirmPayment',
  confirmPaymentPayloadCreator
);
// Backward compatible wrapper function for confirmPayment
export const confirmPayment = (
  transactionId,
  transitionName,
  transitionParams = {}
) => dispatch => {
  return dispatch(
    confirmPaymentThunk({
      transactionId,
      transitionName,
      transitionParams,
    })
  ).unwrap();
};

//////////////////////
// Initiate Inquiry //
//////////////////////

const initiateInquiryPayloadCreator = (
  { inquiryParams, processAlias, transitionName },
  { extra: sdk, rejectWithValue }
) => {
  if (!processAlias) {
    const error = new Error('No transaction process attached to listing');
    log.error(error, 'listing-process-missing', {
      listingId: inquiryParams?.listingId?.uuid,
    });
    return rejectWithValue(storableError(error));
  }

  const bodyParams = {
    transition: transitionName,
    processAlias,
    params: inquiryParams,
  };
  const queryParams = {
    include: ['provider'],
    expand: true,
  };

  return sdk.transactions
    .initiate(bodyParams, queryParams)
    .then(response => {
      const transactionId = response.data.data.id;
      return transactionId;
    })
    .catch(e => {
      return rejectWithValue(storableError(e));
    });
};

export const initiateInquiryThunk = createAsyncThunk(
  'CheckoutPage/initiateInquiry',
  initiateInquiryPayloadCreator
);
// Backward compatible wrapper function for initiateInquiryWithoutPayment
/**
 * Initiate transaction against default-inquiry process
 * Note: At this point inquiry transition is made directly against Marketplace API.
 *       So, client app's server is not involved here unlike with transitions including payments.
 *
 * @param {Object} params
 * @param {Object} params.inquiryParams contains listingId and protectedData
 * @param {String} params.processAlias 'default-inquiry/release-1'
 * @param {String} params.transitionName 'transition/inquire-without-payment'
 * @returns
 */
export const initiateInquiryWithoutPayment = (
  inquiryParams,
  processAlias,
  transitionName
) => dispatch => {
  return dispatch(
    initiateInquiryThunk({
      inquiryParams,
      processAlias,
      transitionName,
    })
  ).unwrap();
};

///////////////////////////
// Speculate Transaction //
///////////////////////////
/**
 * Initiate or transition the speculative transaction with the given
 * booking details
 *
 * The API allows us to do speculative transaction initiation and
 * transitions. This way we can create a test transaction and get the
 * actual pricing information as if the transaction had been started,
 * without affecting the actual data.
 *
 * We store this speculative transaction in the page store and use the
 * pricing info for the booking breakdown to get a proper estimate for
 * the price with the chosen information.
 */

const speculateTransactionPayloadCreator = (
  { orderParams, processAlias, transactionId, transitionName, isPrivilegedTransition },
  { dispatch, extra: sdk, rejectWithValue }
) => {
  // If we already have a transaction ID, we should transition, not initiate.
  const isTransition = !!transactionId;

  const {
    deliveryMethod,
    priceVariantName,
    quantity,
    bookingDates,
    applicationId,
    currency,
    ...otherOrderParams
  } = orderParams;
  const quantityMaybe = quantity ? { stockReservationQuantity: quantity } : {};
  const bookingParamsMaybe = bookingDates || {};

  // Parameters only for client app's server. `applicationId` (F2.6) is never
  // sent to the Marketplace API itself — it's how the server looks up the
  // accepted cgc-application's agreed price (IMPLEMENTATION-PLAN.md 2.6), for
  // both this speculative preview and the real transition. `currency` is the
  // marketplace currency, sent for the same reason: a creator-profile
  // listing has no attributes.price of its own for the server to derive a
  // currency from.
  const orderData = {
    ...(deliveryMethod ? { deliveryMethod } : {}),
    ...(priceVariantName ? { priceVariantName } : {}),
    ...(applicationId ? { applicationId } : {}),
    ...(currency ? { currency } : {}),
  };

  // Parameters for Marketplace API
  const transitionParams = {
    ...quantityMaybe,
    ...bookingParamsMaybe,
    ...otherOrderParams,
    cardToken: 'CheckoutPage_speculative_card_token',
  };

  const bodyParams = isTransition
    ? {
        id: transactionId,
        transition: transitionName,
        params: transitionParams,
      }
    : {
        processAlias,
        transition: transitionName,
        params: transitionParams,
      };

  const queryParams = {
    include: ['booking', 'provider'],
    expand: true,
  };

  const handleSuccess = response => {
    const entities = denormalisedResponseEntities(response);
    if (entities.length !== 1) {
      throw new Error('Expected a resource in the speculate response');
    }
    const tx = entities[0];
    return tx;
  };

  const handleError = e => {
    log.error(e, 'speculate-transaction-failed', {
      listingId: transitionParams.listingId.uuid,
      ...quantityMaybe,
      ...bookingParamsMaybe,
      ...orderData,
      statusText: e.statusText,
    });
    return rejectWithValue(storableError(e));
  };

  if (isTransition && isPrivilegedTransition) {
    // transition privileged
    return transitionPrivileged({ isSpeculative: true, orderData, bodyParams, queryParams })
      .then(handleSuccess)
      .catch(handleError);
  } else if (isTransition) {
    // transition non-privileged
    return sdk.transactions
      .transitionSpeculative(bodyParams, queryParams)
      .then(handleSuccess)
      .catch(handleError);
  } else if (isPrivilegedTransition) {
    // initiate privileged
    return initiatePrivileged({ isSpeculative: true, orderData, bodyParams, queryParams })
      .then(handleSuccess)
      .catch(handleError);
  } else {
    // initiate non-privileged
    return sdk.transactions
      .initiateSpeculative(bodyParams, queryParams)
      .then(handleSuccess)
      .catch(handleError);
  }
};

export const speculateTransactionThunk = createAsyncThunk(
  'CheckoutPage/speculateTransaction',
  speculateTransactionPayloadCreator
);
// Backward compatible wrapper function for speculateTransaction
export const speculateTransaction = (
  orderParams,
  processAlias,
  transactionId,
  transitionName,
  isPrivilegedTransition
) => dispatch => {
  return dispatch(
    speculateTransactionThunk({
      orderParams,
      processAlias,
      transactionId,
      transitionName,
      isPrivilegedTransition,
    })
  ).unwrap();
};

///////////////////////////
// Fetch Stripe Customer //
///////////////////////////
const stripeCustomerPayloadCreator = ({}, { dispatch, rejectWithValue }) => {
  const fetchCurrentUserOptions = {
    callParams: { include: ['stripeCustomer.defaultPaymentMethod'] },
    updateHasListings: false,
    updateNotifications: false,
    enforce: true,
  };

  return dispatch(fetchCurrentUser(fetchCurrentUserOptions))
    .then(response => {
      return response;
    })
    .catch(e => {
      return rejectWithValue(storableError(e));
    });
};

export const stripeCustomerThunk = createAsyncThunk(
  'CheckoutPage/stripeCustomer',
  stripeCustomerPayloadCreator
);
// Backward compatible wrapper function for stripeCustomer
export const stripeCustomer = () => dispatch => {
  return dispatch(stripeCustomerThunk({})).unwrap();
};

// A project is matched to exactly one creator (client's requirement, not
// just a UX nicety — quality and the relationship stay clearly owned by one
// brand-creator pair). Any other applicant still sitting in 'applied' once
// this project is paid for is no longer a live option, so decline it on the
// brand's behalf instead of leaving it to go stale on its own. Declining
// only reaches 'applied' applicants — `transition/brand-decline` isn't
// available from 'countered' (only the creator can act on their own pending
// counter-offer there; see process.edn) — that's a rarer edge the brand can
// still clear by hand.
//
// Best-effort per applicant: one failing decline shouldn't stop the others,
// and none of this should ever surface as a checkout error (the payment that
// actually matters has already succeeded by the time this runs).
const declineOtherApplicantsMaybe = (sdk, projectId, applicationId) => {
  return sdk.transactions
    .query({
      only: 'sale',
      processNames: [CGC_APPLICATION_PROCESS_NAME],
      'fields.transaction': ['protectedData', 'lastTransition'],
    })
    .then(response => {
      const others = response.data.data.filter(
        tx =>
          tx.id.uuid !== applicationId.uuid &&
          tx.attributes.protectedData?.projectId === projectId.uuid &&
          tx.attributes.lastTransition === applicationTransitions.APPLY
      );
      return Promise.all(
        others.map(tx =>
          sdk.transactions
            .transition(
              { id: tx.id, transition: applicationTransitions.BRAND_DECLINE, params: {} },
              {}
            )
            .catch(e => {
              log.error(e, 'auto-decline-other-applicant-failed', {
                applicationId: tx.id.uuid,
                projectId: projectId.uuid,
              });
            })
        )
      );
    })
    .catch(e => {
      log.error(e, 'auto-decline-other-applicants-query-failed', { projectId: projectId.uuid });
    });
};

////////////////////////////////////////
// F2.6: finalize CGC collaboration   //
////////////////////////////////////////
// After a brand pays for a creator-profile checkout backed by an accepted
// cgc-application (IMPLEMENTATION-PLAN.md 2.6), bookkeeping writes still
// need to happen: link the newly-paid transaction back onto the application
// (transition/mark-collaborating, privileged — see
// server/api-util/cgcCheckout.js for why), flip the project listing to
// 'matched' and close it (a project is matched to one creator — see
// declineOtherApplicantsMaybe above), and decline any other still-pending
// applicant. All of this fires only after the payment that actually matters
// has already succeeded, so a failure here is only logged, never surfaced as
// a checkout error — see the call site in CheckoutPageWithPayment.js.
const finalizeCollaborationPayloadCreator = (
  { applicationId, projectId, collaborationTxId },
  { extra: sdk, rejectWithValue }
) => {
  const transitionPromise = transitionPrivileged({
    isSpeculative: false,
    orderData: { collaborationTxId },
    bodyParams: {
      id: applicationId,
      transition: applicationTransitions.MARK_COLLABORATING,
      params: {},
    },
    queryParams: {},
  });
  const listingUpdatePromise = sdk.ownListings.update({
    id: projectId,
    publicData: { projectStatus: 'matched' },
  });
  const listingClosePromise = sdk.ownListings.close({ id: projectId });
  const declineOthersPromise = declineOtherApplicantsMaybe(sdk, projectId, applicationId);

  return Promise.all([
    transitionPromise,
    listingUpdatePromise,
    listingClosePromise,
    declineOthersPromise,
  ])
    .then(() => true)
    .catch(e => {
      log.error(e, 'finalize-cgc-collaboration-failed', {
        applicationId: applicationId?.uuid,
        projectId: projectId?.uuid,
      });
      return rejectWithValue(storableError(e));
    });
};

export const finalizeCollaborationThunk = createAsyncThunk(
  'CheckoutPage/finalizeCollaboration',
  finalizeCollaborationPayloadCreator
);
export const finalizeCgcCollaboration = params => dispatch => {
  return dispatch(finalizeCollaborationThunk(params));
};

// ================ Slice ================ //

const initialState = {
  listing: null,
  orderData: null,
  speculateTransactionInProgress: false,
  speculateTransactionError: null,
  speculatedTransaction: null,
  isClockInSync: false,
  transaction: null,
  initiateOrderError: null,
  confirmPaymentError: null,
  stripeCustomerFetched: false,
  stripeCustomerFetchError: null,
  initiateInquiryInProgress: false,
  initiateInquiryError: null,
};

const checkoutPageSlice = createSlice({
  name: 'CheckoutPage',
  initialState,
  reducers: {
    setInitialValues: (state, action) => {
      return { ...initialState, ...pick(action.payload, Object.keys(initialState)) };
    },
  },
  extraReducers: builder => {
    builder
      // Initiate Order cases
      .addCase(initiateOrderThunk.pending, state => {
        state.initiateOrderError = null;
      })
      .addCase(initiateOrderThunk.fulfilled, (state, action) => {
        state.transaction = action.payload;
      })
      .addCase(initiateOrderThunk.rejected, (state, action) => {
        console.error(action.payload);
        state.initiateOrderError = action.payload;
      })
      // Confirm Payment cases
      .addCase(confirmPaymentThunk.pending, state => {
        state.confirmPaymentError = null;
      })
      .addCase(confirmPaymentThunk.fulfilled, state => {
        // Payment confirmed successfully, no state change needed
      })
      .addCase(confirmPaymentThunk.rejected, (state, action) => {
        console.error(action.payload);
        state.confirmPaymentError = action.payload;
      })
      // Speculate Transaction cases
      .addCase(speculateTransactionThunk.pending, state => {
        state.speculateTransactionInProgress = true;
        state.speculateTransactionError = null;
        state.speculatedTransaction = null;
      })
      .addCase(speculateTransactionThunk.fulfilled, (state, action) => {
        // Check that the local devices clock is within a minute from the server
        const lastTransitionedAt = action.payload?.attributes?.lastTransitionedAt;
        const localTime = new Date();
        const minute = 60000;
        state.speculateTransactionInProgress = false;
        state.speculatedTransaction = action.payload;
        state.isClockInSync =
          Math.abs(lastTransitionedAt?.getTime() - localTime.getTime()) < minute;
      })
      .addCase(speculateTransactionThunk.rejected, (state, action) => {
        console.error(action.payload);
        state.speculateTransactionInProgress = false;
        state.speculateTransactionError = action.payload;
      })
      // Stripe Customer cases
      .addCase(stripeCustomerThunk.pending, state => {
        state.stripeCustomerFetched = false;
        state.stripeCustomerFetchError = null;
      })
      .addCase(stripeCustomerThunk.fulfilled, state => {
        state.stripeCustomerFetched = true;
      })
      .addCase(stripeCustomerThunk.rejected, (state, action) => {
        console.error(action.payload);
        state.stripeCustomerFetchError = action.payload;
      })
      // Initiate Inquiry cases
      .addCase(initiateInquiryThunk.pending, state => {
        state.initiateInquiryInProgress = true;
        state.initiateInquiryError = null;
      })
      .addCase(initiateInquiryThunk.fulfilled, state => {
        state.initiateInquiryInProgress = false;
      })
      .addCase(initiateInquiryThunk.rejected, (state, action) => {
        state.initiateInquiryInProgress = false;
        state.initiateInquiryError = action.payload;
      });
  },
});

// Export the action creators
export const { setInitialValues } = checkoutPageSlice.actions;

// Export the reducer
export default checkoutPageSlice.reducer;
