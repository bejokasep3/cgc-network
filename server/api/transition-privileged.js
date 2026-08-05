const sharetribeSdk = require('sharetribe-flex-sdk');
const { transactionLineItems } = require('../api-util/lineItems');
const {
  addOfferToMetadata,
  getAmountFromPreviousOffer,
  isIntentionToMakeCounterOffer,
  isIntentionToMakeOffer,
  isIntentionToRevokeCounterOffer,
  isIntentionToUpdateOffer,
  throwErrorIfNegotiationOfferHasInvalidHistory,
} = require('../api-util/negotiation');
const {
  isApplicationOfferTransition,
  isCGCCollaborationCheckout,
  isMarkCollaboratingTransition,
  buildApplicationOfferMetadata,
  buildMarkCollaboratingProtectedData,
  fetchAgreedPriceMoney,
  fetchProjectDeliverables,
} = require('../api-util/cgcCheckout');
const {
  getSdk,
  getTrustedSdk,
  handleError,
  serialize,
  fetchCommission,
} = require('../api-util/sdk');

const { Money } = sharetribeSdk.types;

const transactionPromise = (sdk, id) => sdk.transactions.show({ id, include: ['listing'] });
const getListingRelationShip = transactionShowAPIData => {
  const { data, included } = transactionShowAPIData;
  const { relationships } = data;
  const { listing: listingRef } = relationships;
  return included.find(i => i.id.uuid === listingRef.data.id.uuid);
};

// When a provider is making an offer, make sure that customer related
// protected data is not being saved
const getRoleBasedBodyParams = (orderData, bodyParams) => {
  const { offerInSubunits } = orderData || {};
  const transitionName = bodyParams?.transition;
  const isProviderOffer =
    isIntentionToMakeOffer(offerInSubunits, transitionName) ||
    isIntentionToUpdateOffer(offerInSubunits, transitionName);

  if (!isProviderOffer) {
    return bodyParams;
  } else {
    const protectedData = bodyParams?.params?.protectedData || {};

    const filteredProtectedData = Object.entries(protectedData).reduce(
      (validEntries, [key, value]) => {
        if (key === 'customerDefaultMessage' || key.startsWith('customer_')) {
          return validEntries;
        } else {
          return { ...validEntries, [key]: value };
        }
      },
      {}
    );

    return {
      ...bodyParams,
      params: {
        ...bodyParams.params,
        protectedData: filteredProtectedData,
      },
    };
  }
};

const getFullOrderData = (orderData, bodyParams, currency, offers, agreedPriceMoney) => {
  const { offerInSubunits } = orderData || {};
  const transitionName = bodyParams.transition;

  const roleBasedBodyParams = getRoleBasedBodyParams(orderData, bodyParams);
  const orderDataAndParams = { ...orderData, ...roleBasedBodyParams.params, currency };

  // A cgc-ugc-approval checkout priced from an accepted cgc-application (see
  // IMPLEMENTATION-PLAN.md 2.6) always wins over the default-negotiation
  // `offer` path below — the two never apply to the same transition.
  if (agreedPriceMoney) {
    return { ...orderDataAndParams, agreedPrice: agreedPriceMoney };
  }

  const isNewOffer =
    isIntentionToMakeOffer(offerInSubunits, transitionName) ||
    isIntentionToMakeCounterOffer(offerInSubunits, transitionName) ||
    isIntentionToUpdateOffer(offerInSubunits, transitionName);

  return isNewOffer
    ? {
        ...orderDataAndParams,
        offer: new Money(offerInSubunits, currency),
      }
    : isIntentionToRevokeCounterOffer(transitionName)
    ? {
        ...orderDataAndParams,
        offer: new Money(getAmountFromPreviousOffer(offers), currency),
      }
    : orderDataAndParams;
};

const getUpdatedMetadata = (orderData, transition, existingMetadata) => {
  const { actor, offerInSubunits } = orderData || {};
  // NOTE: for default-negotiation process, the actor is always "provider" when making an offer.
  const hasActor = ['provider', 'customer'].includes(actor);
  const by = hasActor ? actor : null;

  const isNewOffer =
    isIntentionToMakeOffer(offerInSubunits, transition) ||
    isIntentionToMakeCounterOffer(offerInSubunits, transition) ||
    isIntentionToUpdateOffer(offerInSubunits, transition);

  return isNewOffer
    ? addOfferToMetadata(existingMetadata, {
        offerInSubunits,
        by,
        transition,
      })
    : isIntentionToRevokeCounterOffer(transition)
    ? addOfferToMetadata(existingMetadata, {
        offerInSubunits: getAmountFromPreviousOffer(existingMetadata.offers),
        by,
        transition,
      })
    : addOfferToMetadata(existingMetadata, null);
};

module.exports = (req, res) => {
  const { isSpeculative, orderData, bodyParams, queryParams } = req.body || {};

  const sdk = getSdk(req, res);
  const transitionName = bodyParams.transition;
  let lineItems = null;
  let metadataMaybe = {};
  // transition/brand-counter carries no money at all — it must not send a
  // `lineItems` param, since the transition has no
  // action/privileged-set-line-items in process.edn to receive it.
  let includeLineItems = true;
  // Set only for a fresh cgc-ugc-approval checkout (F3.1/F3.3) — the
  // project's deliverables and its own id, seeded server-side onto the new
  // collaboration. projectId is what later lets TransactionPage look up the
  // PROJECT's requiresProduct (not the creator-profile listing's — see
  // IMPLEMENTATION-PLAN.md F3.3).
  let deliverablesMaybe = null;
  let projectIdMaybe = null;

  const isApplicationOffer = isApplicationOfferTransition(transitionName);

  Promise.all([transactionPromise(sdk, bodyParams?.id), fetchCommission(sdk)])
    .then(responses => {
      const [showTransactionResponse, fetchAssetsResponse] = responses;
      const transaction = showTransactionResponse.data.data;
      const listing = getListingRelationShip(showTransactionResponse.data);
      const commissionAsset = fetchAssetsResponse.data.data[0];

      const existingMetadata = transaction?.attributes?.metadata;
      const existingOffers = existingMetadata?.offers || [];
      const transitions = transaction.attributes.transitions;

      const currency =
        transaction.attributes.payinTotal?.currency ||
        listing.attributes.price?.currency ||
        orderData.currency;
      const { providerCommission, customerCommission } =
        commissionAsset?.type === 'jsonAsset' ? commissionAsset.attributes.data : {};

      if (isApplicationOffer) {
        // The brand's one counter-offer on an existing cgc-application
        // (transition/brand-counter). No lineItems; the only effect is a
        // metadata write appending the counter amount.
        includeLineItems = false;
        metadataMaybe = buildApplicationOfferMetadata({
          orderData,
          transitionName,
          existingMetadata,
        });
        return getTrustedSdk(req);
      }

      if (isMarkCollaboratingTransition(transitionName)) {
        // The brand linking a just-paid cgc-ugc-approval transaction back
        // onto this application, right after checkout (IMPLEMENTATION-PLAN.md
        // 2.6). No lineItems; the only effect is a protectedData write, and
        // only after the paid transaction has been thoroughly verified.
        includeLineItems = false;
        return sdk.currentUser
          .show()
          .then(currentUserResponse =>
            buildMarkCollaboratingProtectedData({
              orderData,
              applicationTx: transaction,
              currentUserId: currentUserResponse.data.data.id,
            })
          )
          .then(result => {
            metadataMaybe = result;
            return getTrustedSdk(req);
          });
      }

      if (isCGCCollaborationCheckout(transitionName, listing.attributes.publicData)) {
        // A brand completing checkout after a prior inquiry/invitation
        // (transition/request-payment-after-inquiry) on a creator-profile
        // listing. The price MUST come from an accepted cgc-application,
        // never from the listing's own (indicative-only) price — this is a
        // hard security invariant, not a convenience. See
        // IMPLEMENTATION-PLAN.md 2.6.
        return sdk.currentUser
          .show()
          .then(currentUserResponse =>
            fetchAgreedPriceMoney({
              applicationId: orderData?.applicationId,
              listing,
              currentUserId: currentUserResponse.data.data.id,
              currency,
              Money,
            })
          )
          .then(({ agreedPriceMoney, projectId }) => {
            lineItems = transactionLineItems(
              listing,
              getFullOrderData(orderData, bodyParams, currency, existingOffers, agreedPriceMoney),
              providerCommission,
              customerCommission
            );
            projectIdMaybe = projectId;
            return fetchProjectDeliverables({ projectId });
          })
          .then(deliverables => {
            deliverablesMaybe = deliverables;
            return getTrustedSdk(req);
          });
      }

      // Existing behaviour, unchanged: default-negotiation's counter-offer /
      // update-offer / revoke transitions.
      throwErrorIfNegotiationOfferHasInvalidHistory(transitionName, existingOffers, transitions);

      lineItems = transactionLineItems(
        listing,
        getFullOrderData(orderData, bodyParams, currency, existingOffers, null),
        providerCommission,
        customerCommission
      );

      metadataMaybe = getUpdatedMetadata(orderData, transitionName, existingMetadata);

      return getTrustedSdk(req);
    })
    .then(trustedSdk => {
      // Pass role based params to make sure that protectedData only contains protected data
      // for the correct role.
      // - For the default-negotiation process, this removes any customer
      //   related protected data fields if the transition is from a provider
      // - If you customize the transaction process to allow customers to update protected data
      //   after a provider's offer, you can add that logic in this same function.
      const roleBasedBodyParams = getRoleBasedBodyParams(orderData, bodyParams);
      // Omit listingId from params (transition/request-payment-after-inquiry does not need it)
      const { listingId, ...restParams } = roleBasedBodyParams?.params || {};
      const deliverablesParamMaybe = deliverablesMaybe
        ? {
            protectedData: {
              ...restParams.protectedData,
              deliverables: deliverablesMaybe,
              ...(projectIdMaybe ? { projectId: projectIdMaybe } : {}),
            },
          }
        : {};

      // Add lineItems to the body params
      const body = {
        ...bodyParams,
        params: {
          ...restParams,
          ...(includeLineItems ? { lineItems } : {}),
          ...metadataMaybe,
          ...deliverablesParamMaybe,
        },
      };

      if (isSpeculative) {
        return trustedSdk.transactions.transitionSpeculative(body, queryParams);
      }
      return trustedSdk.transactions.transition(body, queryParams);
    })
    .then(apiResponse => {
      const { status, statusText, data } = apiResponse;
      res
        .status(status)
        .set('Content-Type', 'application/transit+json')
        .send(
          serialize({
            status,
            statusText,
            data,
          })
        )
        .end();
    })
    .catch(e => {
      handleError(res, e);
    });
};
