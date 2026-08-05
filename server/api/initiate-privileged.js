const sharetribeSdk = require('sharetribe-flex-sdk');
const { transactionLineItems } = require('../api-util/lineItems');
const { isIntentionToMakeOffer } = require('../api-util/negotiation');
const {
  isApplicationOfferTransition,
  isCGCCollaborationCheckout,
  assertNoExistingApplication,
  buildApplicationOfferMetadata,
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

const listingPromise = (sdk, id) => sdk.listings.show({ id });

const getFullOrderData = (orderData, bodyParams, currency, agreedPriceMoney) => {
  const { offerInSubunits } = orderData || {};
  const transitionName = bodyParams.transition;
  const base = { ...orderData, ...bodyParams.params, currency };

  // A cgc-ugc-approval checkout priced from an accepted cgc-application (see
  // IMPLEMENTATION-PLAN.md 2.6) always wins over the default-negotiation
  // `offer` path below — the two never apply to the same transition.
  if (agreedPriceMoney) {
    return { ...base, agreedPrice: agreedPriceMoney };
  }

  return isIntentionToMakeOffer(offerInSubunits, transitionName)
    ? { ...base, offer: new Money(offerInSubunits, currency) }
    : base;
};

const getMetadata = (orderData, transition) => {
  const { actor, offerInSubunits } = orderData || {};
  // NOTE: for now, the actor is always "provider".
  const hasActor = ['provider', 'customer'].includes(actor);
  const by = hasActor ? actor : null;

  return isIntentionToMakeOffer(offerInSubunits, transition)
    ? {
        metadata: {
          offers: [
            {
              offerInSubunits,
              by,
              transition,
            },
          ],
        },
      }
    : {};
};

module.exports = (req, res) => {
  const { isSpeculative, orderData, bodyParams, queryParams } = req.body || {};
  const transitionName = bodyParams.transition;
  const sdk = getSdk(req, res);
  let lineItems = null;
  let metadataMaybe = {};
  // cgc-application's transition/apply carries no money at all — it must not
  // send a `lineItems` param, since the transition has no
  // action/privileged-set-line-items in process.edn to receive it.
  let includeLineItems = true;
  // Set only for a fresh cgc-ugc-approval checkout (F3.1/F3.3) — the
  // project's deliverables and its own id, seeded server-side onto the new
  // collaboration. projectId is what later lets TransactionPage look up the
  // PROJECT's requiresProduct (not the creator-profile listing's — see
  // IMPLEMENTATION-PLAN.md F3.3) — without this, a cold application (no
  // prior invitation) would never carry projectId at all.
  let deliverablesMaybe = null;
  let projectIdMaybe = null;

  const isApplicationOffer = isApplicationOfferTransition(transitionName);

  Promise.all([listingPromise(sdk, bodyParams?.params?.listingId), fetchCommission(sdk)])
    .then(([showListingResponse, fetchAssetsResponse]) => {
      const listing = showListingResponse.data.data;
      const commissionAsset = fetchAssetsResponse.data.data[0];

      const currency = listing.attributes.price?.currency || orderData.currency;
      const { providerCommission, customerCommission } =
        commissionAsset?.type === 'jsonAsset' ? commissionAsset.attributes.data : {};

      if (isApplicationOffer) {
        // A creator applying to a project (transition/apply). No lineItems;
        // the only effect is a metadata write recording the asking price.
        includeLineItems = false;
        return assertNoExistingApplication({ sdk, projectId: listing.id.uuid }).then(() => {
          metadataMaybe = buildApplicationOfferMetadata({
            orderData,
            transitionName,
            existingMetadata: {},
            listedPriceInSubunits: listing.attributes.price?.amount,
          });
          return getTrustedSdk(req);
        });
      }

      if (isCGCCollaborationCheckout(transitionName, listing.attributes.publicData)) {
        // A brand checking out a creator-profile listing directly (no prior
        // inquiry). The price MUST come from an accepted cgc-application,
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
              getFullOrderData(orderData, bodyParams, currency, agreedPriceMoney),
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

      // Existing behaviour, unchanged: stock processes, and
      // default-negotiation's make-offer transitions.
      lineItems = transactionLineItems(
        listing,
        getFullOrderData(orderData, bodyParams, currency, null),
        providerCommission,
        customerCommission
      );
      metadataMaybe = getMetadata(orderData, transitionName);

      return getTrustedSdk(req);
    })
    .then(trustedSdk => {
      const { params } = bodyParams;
      const deliverablesParamMaybe = deliverablesMaybe
        ? {
            protectedData: {
              ...params.protectedData,
              deliverables: deliverablesMaybe,
              ...(projectIdMaybe ? { projectId: projectIdMaybe } : {}),
            },
          }
        : {};

      // Add lineItems to the body params
      const body = {
        ...bodyParams,
        params: {
          ...params,
          ...(includeLineItems ? { lineItems } : {}),
          ...metadataMaybe,
          ...deliverablesParamMaybe,
        },
      };

      if (isSpeculative) {
        return trustedSdk.transactions.initiateSpeculative(body, queryParams);
      }
      return trustedSdk.transactions.initiate(body, queryParams);
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
