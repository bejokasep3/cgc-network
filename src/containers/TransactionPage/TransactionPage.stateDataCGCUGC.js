import {
  TX_TRANSITION_ACTOR_CUSTOMER as CUSTOMER,
  TX_TRANSITION_ACTOR_PROVIDER as PROVIDER,
  CONDITIONAL_RESOLVER_WILDCARD,
  ConditionalResolver,
} from '../../transactions/transaction';

/**
 * Get state data for the cgc-ugc-approval process, i.e. which action buttons the
 * TransactionPage should render for the current state and role.
 *
 * Role mapping for this process:
 *   customer = BRAND   (pays, ships the product, reviews & approves content)
 *   provider = CREATOR (receives the product, delivers UGC, gets paid)
 *
 * @param {*} txInfo details about the transaction
 * @param {*} processInfo details about the process
 */
export const getStateDataForCGCUGCProcess = (txInfo, processInfo) => {
  const { transaction, transactionRole, nextTransitions, onOpenCGCActionModal, listing } = txInfo;
  const isProviderBanned = transaction?.provider?.attributes?.banned;
  // A collaboration only involves shipping when the creator's own listing
  // requires it — set by the creator, not derived from the brand's checkout
  // choices. Sharetribe's own delivery methods are never enabled on
  // creator-profile listings (see CGC-SETUP.md §2a), since that would make the
  // creator collect a shipping fee instead of the brand shipping its own
  // product; requiresProduct is the real signal.
  const isShippable = listing?.attributes?.publicData?.requiresProduct === true;
  const hasShippingAddress = !!transaction?.attributes?.protectedData?.shippingAddressLine1;
  const _ = CONDITIONAL_RESOLVER_WILDCARD;

  const {
    processName,
    processState,
    states,
    transitions,
    actionButtonProps,
    leaveReviewProps,
  } = processInfo;

  // Several transitions lead to the same state (e.g. approve-content and
  // auto-approve-content both end in 'received'), so the state-level ActivityFeed
  // message is not specific enough. These override it per transition.
  const tr = 'TransactionPage.ActivityFeed.cgc-ugc-approval.transition';
  const transitionMessages = [
    {
      transition: transitions.PROVIDER_ADD_SHIPPING_ADDRESS,
      translationId: `${tr}.provider-add-shipping-address`,
    },
    { transition: transitions.MARK_SHIPPED, translationId: `${tr}.mark-shipped` },
    {
      transition: transitions.AUTO_MARK_PRODUCT_RECEIVED,
      translationId: `${tr}.auto-mark-product-received`,
    },
    { transition: transitions.SUBMIT_CONTENT, translationId: `${tr}.submit-content` },
    {
      transition: transitions.SUBMIT_CONTENT_AFTER_SHIPPING,
      translationId: `${tr}.submit-content`,
    },
    { transition: transitions.RESUBMIT_CONTENT_1, translationId: `${tr}.resubmit-content` },
    { transition: transitions.RESUBMIT_CONTENT_2, translationId: `${tr}.resubmit-content` },
    { transition: transitions.APPROVE_CONTENT, translationId: `${tr}.approve-content` },
    { transition: transitions.APPROVE_CONTENT_REVISED_1, translationId: `${tr}.approve-content` },
    { transition: transitions.APPROVE_CONTENT_REVISED_2, translationId: `${tr}.approve-content` },
    { transition: transitions.AUTO_APPROVE_CONTENT, translationId: `${tr}.auto-approve-content` },
    {
      transition: transitions.AUTO_APPROVE_CONTENT_REVISED_1,
      translationId: `${tr}.auto-approve-content`,
    },
    {
      transition: transitions.AUTO_APPROVE_CONTENT_REVISED_2,
      translationId: `${tr}.auto-approve-content`,
    },
    {
      transition: transitions.MARK_RECEIVED_FROM_DISPUTED,
      translationId: `${tr}.mark-received-from-disputed`,
    },
    { transition: transitions.AUTO_CANCEL, translationId: `${tr}.auto-cancel` },
    {
      transition: transitions.AUTO_CANCEL_FROM_PRODUCT_RECEIVED,
      translationId: `${tr}.auto-cancel-no-content`,
    },
    {
      transition: transitions.AUTO_CANCEL_FROM_REVISION_1,
      translationId: `${tr}.auto-cancel-no-revision`,
    },
    {
      transition: transitions.AUTO_CANCEL_FROM_REVISION_2,
      translationId: `${tr}.auto-cancel-no-revision`,
    },
    {
      transition: transitions.AUTO_CANCEL_FROM_DISPUTED,
      translationId: `${tr}.auto-cancel-from-disputed`,
    },
  ];

  const base = { processName, processState, transitionMessages, showDetailCardHeadings: true };

  // These three transitions need structured input, so their buttons open
  // CGCActionModal instead of transitioning straight away. The modal reads the
  // matching *Transition key to know what to fire.
  const openModal = variant => ({ onAction: onOpenCGCActionModal(variant) });

  return new ConditionalResolver([processState, transactionRole])
    .cond([states.INQUIRY, CUSTOMER], () => {
      const transitionNames = Array.isArray(nextTransitions)
        ? nextTransitions.map(t => t.attributes.name)
        : [];
      const hasCorrectNextTransition = transitionNames.includes(
        transitions.REQUEST_PAYMENT_AFTER_INQUIRY
      );
      const showOrderPanel = !isProviderBanned && hasCorrectNextTransition;
      return { ...base, showOrderPanel };
    })
    .cond([states.INQUIRY, PROVIDER], () => {
      return { ...base };
    })

    // --- Brand has paid. Either it ships a product, or the creator starts work.
    .cond([states.PURCHASED, CUSTOMER], () => {
      return {
        ...base,
        showExtraInfo: true,
        showActionButtons: isShippable,
        shippingTransition: transitions.MARK_SHIPPED,
        primaryButtonProps: isShippable
          ? actionButtonProps(transitions.MARK_SHIPPED, CUSTOMER, openModal('shipping'))
          : null,
      };
    })
    .cond([states.PURCHASED, PROVIDER], () => {
      // When the brand needs to ship a product, the creator supplies their
      // delivery address first — the brand otherwise has nowhere to send it
      // to. This fires a self-transition (purchased -> purchased): it only
      // records data, it never changes state.
      const needsShippingAddress = isShippable && !hasShippingAddress;
      return {
        ...base,
        showExtraInfo: true,
        showActionButtons: true,
        contentSubmitTransition: transitions.SUBMIT_CONTENT,
        addShippingAddressTransition: transitions.PROVIDER_ADD_SHIPPING_ADDRESS,
        primaryButtonProps: needsShippingAddress
          ? actionButtonProps(
              transitions.PROVIDER_ADD_SHIPPING_ADDRESS,
              PROVIDER,
              openModal('addShippingAddress')
            )
          : actionButtonProps(transitions.SUBMIT_CONTENT, PROVIDER, openModal('submitContent')),
      };
    })

    // --- Product in transit.
    .cond([states.SHIPPED, PROVIDER], () => {
      return {
        ...base,
        showExtraInfo: true,
        showActionButtons: true,
        primaryButtonProps: actionButtonProps(transitions.MARK_PRODUCT_RECEIVED, PROVIDER),
      };
    })
    .cond([states.SHIPPED, CUSTOMER], () => {
      return { ...base, showExtraInfo: true };
    })

    // --- Product delivered, creator produces the content.
    .cond([states.PRODUCT_RECEIVED, PROVIDER], () => {
      return {
        ...base,
        showActionButtons: true,
        contentSubmitTransition: transitions.SUBMIT_CONTENT_AFTER_SHIPPING,
        primaryButtonProps: actionButtonProps(
          transitions.SUBMIT_CONTENT_AFTER_SHIPPING,
          PROVIDER,
          openModal('submitContent')
        ),
      };
    })

    // --- Content is with the brand for review. Approve / request revision /
    //     escalate. Each submission state has its own dispute transition.
    .cond([states.CONTENT_SUBMITTED, CUSTOMER], () => {
      // ApprovalDecisionPanel renders approve/revise/escalate together, so the
      // generic action-button area and diminished dispute link are suppressed
      // here (showActionButtons/showDispute: false) rather than duplicated.
      return {
        ...base,
        showActionButtons: false,
        showDispute: false,
        showApprovalDecisionPanel: true,
        disputeTransition: transitions.DISPUTE,
        revisionTransition: transitions.REQUEST_REVISION_1,
        primaryButtonProps: actionButtonProps(transitions.APPROVE_CONTENT, CUSTOMER),
        secondaryButtonProps: actionButtonProps(
          transitions.REQUEST_REVISION_1,
          CUSTOMER,
          openModal('requestRevision')
        ),
      };
    })

    // --- First revision round.
    .cond([states.REVISION_REQUESTED_1, PROVIDER], () => {
      return {
        ...base,
        showActionButtons: true,
        contentSubmitTransition: transitions.RESUBMIT_CONTENT_1,
        primaryButtonProps: actionButtonProps(
          transitions.RESUBMIT_CONTENT_1,
          PROVIDER,
          openModal('submitContent')
        ),
      };
    })
    .cond([states.CONTENT_SUBMITTED_REVISED_1, CUSTOMER], () => {
      return {
        ...base,
        showActionButtons: false,
        showDispute: false,
        showApprovalDecisionPanel: true,
        disputeTransition: transitions.DISPUTE_REVISED_1,
        revisionTransition: transitions.REQUEST_REVISION_2,
        primaryButtonProps: actionButtonProps(transitions.APPROVE_CONTENT_REVISED_1, CUSTOMER),
        secondaryButtonProps: actionButtonProps(
          transitions.REQUEST_REVISION_2,
          CUSTOMER,
          openModal('requestRevision')
        ),
      };
    })

    // --- Second (final) revision round. No further revisions are allowed, so
    //     the brand can only approve or escalate to the operator.
    .cond([states.REVISION_REQUESTED_2, PROVIDER], () => {
      return {
        ...base,
        showActionButtons: true,
        contentSubmitTransition: transitions.RESUBMIT_CONTENT_2,
        primaryButtonProps: actionButtonProps(
          transitions.RESUBMIT_CONTENT_2,
          PROVIDER,
          openModal('submitContent')
        ),
      };
    })
    .cond([states.CONTENT_SUBMITTED_REVISED_2, CUSTOMER], () => {
      // No revisionTransition here — the two-revision cap is exhausted.
      // ApprovalDecisionPanel explains that explicitly instead of just
      // omitting the button.
      return {
        ...base,
        showActionButtons: false,
        showDispute: false,
        showApprovalDecisionPanel: true,
        disputeTransition: transitions.DISPUTE_REVISED_2,
        primaryButtonProps: actionButtonProps(transitions.APPROVE_CONTENT_REVISED_2, CUSTOMER),
      };
    })

    // --- Approved & paid out, then two-way reviews.
    .cond([states.COMPLETED, _], () => {
      return {
        ...base,
        showReviewAsFirstLink: true,
        showActionButtons: true,
        primaryButtonProps: leaveReviewProps,
      };
    })
    .cond([states.REVIEWED_BY_PROVIDER, CUSTOMER], () => {
      return {
        ...base,
        showReviewAsSecondLink: true,
        showActionButtons: true,
        primaryButtonProps: leaveReviewProps,
      };
    })
    .cond([states.REVIEWED_BY_CUSTOMER, PROVIDER], () => {
      return {
        ...base,
        showReviewAsSecondLink: true,
        showActionButtons: true,
        primaryButtonProps: leaveReviewProps,
      };
    })
    .cond([states.REVIEWED, _], () => {
      return { ...base, showReviews: true };
    })
    .default(() => {
      // Waiting states (the other party needs to act), plus disputed,
      // pending-payment, payment-expired, canceled and received.
      return { ...base };
    })
    .resolve();
};
