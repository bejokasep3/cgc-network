/**
 * Transaction process graph for CGC UGC Approval Process:
 *   - cgc-ugc-approval
 *
 * This mirrors ext/transaction-processes/cgc-ugc-approval/process.edn.
 * Keep the two in sync: the app can only offer transitions that exist in the
 * process pushed to Console.
 *
 * Roles: customer = BRAND, provider = CREATOR.
 */

export const transitions = {
  INQUIRE: 'transition/inquire',
  REQUEST_PAYMENT: 'transition/request-payment',
  REQUEST_PAYMENT_AFTER_INQUIRY: 'transition/request-payment-after-inquiry',
  CONFIRM_PAYMENT: 'transition/confirm-payment',
  EXPIRE_PAYMENT: 'transition/expire-payment',

  // Product shipping (brand -> creator)
  PROVIDER_ADD_SHIPPING_ADDRESS: 'transition/provider-add-shipping-address',
  MARK_SHIPPED: 'transition/mark-shipped',
  MARK_PRODUCT_RECEIVED: 'transition/mark-product-received',
  AUTO_MARK_PRODUCT_RECEIVED: 'transition/auto-mark-product-received',

  // Content submission (creator -> brand)
  SUBMIT_CONTENT: 'transition/submit-content',
  SUBMIT_CONTENT_AFTER_SHIPPING: 'transition/submit-content-after-shipping',

  // Revisions (max 2)
  REQUEST_REVISION_1: 'transition/request-revision-1',
  RESUBMIT_CONTENT_1: 'transition/resubmit-content-1',
  REQUEST_REVISION_2: 'transition/request-revision-2',
  RESUBMIT_CONTENT_2: 'transition/resubmit-content-2',

  // Approval & payout
  APPROVE_CONTENT: 'transition/approve-content',
  APPROVE_CONTENT_REVISED_1: 'transition/approve-content-revised-1',
  APPROVE_CONTENT_REVISED_2: 'transition/approve-content-revised-2',
  AUTO_APPROVE_CONTENT: 'transition/auto-approve-content',
  AUTO_APPROVE_CONTENT_REVISED_1: 'transition/auto-approve-content-revised-1',
  AUTO_APPROVE_CONTENT_REVISED_2: 'transition/auto-approve-content-revised-2',

  // Disputes
  DISPUTE: 'transition/dispute',
  DISPUTE_REVISED_1: 'transition/dispute-revised-1',
  DISPUTE_REVISED_2: 'transition/dispute-revised-2',
  OPERATOR_DISPUTE: 'transition/operator-dispute',
  MARK_RECEIVED_FROM_DISPUTED: 'transition/mark-received-from-disputed',
  CANCEL_FROM_DISPUTED: 'transition/cancel-from-disputed',
  AUTO_CANCEL_FROM_DISPUTED: 'transition/auto-cancel-from-disputed',

  // Cancellation
  CANCEL: 'transition/cancel',
  AUTO_CANCEL: 'transition/auto-cancel',
  CANCEL_FROM_SHIPPED: 'transition/cancel-from-shipped',
  CANCEL_FROM_PRODUCT_RECEIVED: 'transition/cancel-from-product-received',
  AUTO_CANCEL_FROM_PRODUCT_RECEIVED: 'transition/auto-cancel-from-product-received',
  CANCEL_FROM_REVISION_1: 'transition/cancel-from-revision-1',
  CANCEL_FROM_REVISION_2: 'transition/cancel-from-revision-2',
  AUTO_CANCEL_FROM_REVISION_1: 'transition/auto-cancel-from-revision-1',
  AUTO_CANCEL_FROM_REVISION_2: 'transition/auto-cancel-from-revision-2',

  // Completion & reviews
  AUTO_COMPLETE: 'transition/auto-complete',
  REVIEW_1_BY_PROVIDER: 'transition/review-1-by-provider',
  REVIEW_2_BY_PROVIDER: 'transition/review-2-by-provider',
  REVIEW_1_BY_CUSTOMER: 'transition/review-1-by-customer',
  REVIEW_2_BY_CUSTOMER: 'transition/review-2-by-customer',
  EXPIRE_REVIEW_PERIOD: 'transition/expire-review-period',
  EXPIRE_PROVIDER_REVIEW_PERIOD: 'transition/expire-provider-review-period',
  EXPIRE_CUSTOMER_REVIEW_PERIOD: 'transition/expire-customer-review-period',
};

export const states = {
  INITIAL: 'initial',
  INQUIRY: 'inquiry',
  PENDING_PAYMENT: 'pending-payment',
  PAYMENT_EXPIRED: 'payment-expired',
  PURCHASED: 'purchased',
  SHIPPED: 'shipped',
  PRODUCT_RECEIVED: 'product-received',
  CONTENT_SUBMITTED: 'content-submitted',
  REVISION_REQUESTED_1: 'revision-requested-1',
  CONTENT_SUBMITTED_REVISED_1: 'content-submitted-revised-1',
  REVISION_REQUESTED_2: 'revision-requested-2',
  CONTENT_SUBMITTED_REVISED_2: 'content-submitted-revised-2',
  DISPUTED: 'disputed',
  RECEIVED: 'received',
  CANCELED: 'canceled',
  COMPLETED: 'completed',
  REVIEWED: 'reviewed',
  REVIEWED_BY_CUSTOMER: 'reviewed-by-customer',
  REVIEWED_BY_PROVIDER: 'reviewed-by-provider',
};

export const graph = {
  id: 'cgc-ugc-approval/release-1',
  initial: states.INITIAL,
  states: {
    [states.INITIAL]: {
      on: {
        [transitions.INQUIRE]: states.INQUIRY,
        [transitions.REQUEST_PAYMENT]: states.PENDING_PAYMENT,
      },
    },
    [states.INQUIRY]: {
      on: {
        [transitions.REQUEST_PAYMENT_AFTER_INQUIRY]: states.PENDING_PAYMENT,
      },
    },
    [states.PENDING_PAYMENT]: {
      on: {
        [transitions.EXPIRE_PAYMENT]: states.PAYMENT_EXPIRED,
        [transitions.CONFIRM_PAYMENT]: states.PURCHASED,
      },
    },
    [states.PAYMENT_EXPIRED]: {},
    [states.PURCHASED]: {
      on: {
        [transitions.PROVIDER_ADD_SHIPPING_ADDRESS]: states.PURCHASED,
        [transitions.MARK_SHIPPED]: states.SHIPPED,
        [transitions.SUBMIT_CONTENT]: states.CONTENT_SUBMITTED,
        [transitions.AUTO_CANCEL]: states.CANCELED,
        [transitions.CANCEL]: states.CANCELED,
      },
    },
    [states.SHIPPED]: {
      on: {
        [transitions.MARK_PRODUCT_RECEIVED]: states.PRODUCT_RECEIVED,
        [transitions.AUTO_MARK_PRODUCT_RECEIVED]: states.PRODUCT_RECEIVED,
        [transitions.CANCEL_FROM_SHIPPED]: states.CANCELED,
      },
    },
    [states.PRODUCT_RECEIVED]: {
      on: {
        [transitions.SUBMIT_CONTENT_AFTER_SHIPPING]: states.CONTENT_SUBMITTED,
        [transitions.CANCEL_FROM_PRODUCT_RECEIVED]: states.CANCELED,
        [transitions.AUTO_CANCEL_FROM_PRODUCT_RECEIVED]: states.CANCELED,
      },
    },
    [states.CONTENT_SUBMITTED]: {
      on: {
        [transitions.APPROVE_CONTENT]: states.RECEIVED,
        [transitions.AUTO_APPROVE_CONTENT]: states.RECEIVED,
        [transitions.REQUEST_REVISION_1]: states.REVISION_REQUESTED_1,
        [transitions.DISPUTE]: states.DISPUTED,
        [transitions.OPERATOR_DISPUTE]: states.DISPUTED,
      },
    },
    [states.REVISION_REQUESTED_1]: {
      on: {
        [transitions.RESUBMIT_CONTENT_1]: states.CONTENT_SUBMITTED_REVISED_1,
        [transitions.CANCEL_FROM_REVISION_1]: states.CANCELED,
        [transitions.AUTO_CANCEL_FROM_REVISION_1]: states.CANCELED,
      },
    },
    [states.CONTENT_SUBMITTED_REVISED_1]: {
      on: {
        [transitions.APPROVE_CONTENT_REVISED_1]: states.RECEIVED,
        [transitions.AUTO_APPROVE_CONTENT_REVISED_1]: states.RECEIVED,
        [transitions.REQUEST_REVISION_2]: states.REVISION_REQUESTED_2,
        [transitions.DISPUTE_REVISED_1]: states.DISPUTED,
      },
    },
    [states.REVISION_REQUESTED_2]: {
      on: {
        [transitions.RESUBMIT_CONTENT_2]: states.CONTENT_SUBMITTED_REVISED_2,
        [transitions.CANCEL_FROM_REVISION_2]: states.CANCELED,
        [transitions.AUTO_CANCEL_FROM_REVISION_2]: states.CANCELED,
      },
    },
    [states.CONTENT_SUBMITTED_REVISED_2]: {
      on: {
        [transitions.APPROVE_CONTENT_REVISED_2]: states.RECEIVED,
        [transitions.AUTO_APPROVE_CONTENT_REVISED_2]: states.RECEIVED,
        [transitions.DISPUTE_REVISED_2]: states.DISPUTED,
      },
    },
    [states.DISPUTED]: {
      on: {
        [transitions.MARK_RECEIVED_FROM_DISPUTED]: states.RECEIVED,
        [transitions.CANCEL_FROM_DISPUTED]: states.CANCELED,
        [transitions.AUTO_CANCEL_FROM_DISPUTED]: states.CANCELED,
      },
    },
    [states.RECEIVED]: {
      on: {
        [transitions.AUTO_COMPLETE]: states.COMPLETED,
      },
    },
    [states.CANCELED]: {},
    [states.COMPLETED]: {
      on: {
        [transitions.EXPIRE_REVIEW_PERIOD]: states.REVIEWED,
        [transitions.REVIEW_1_BY_CUSTOMER]: states.REVIEWED_BY_CUSTOMER,
        [transitions.REVIEW_1_BY_PROVIDER]: states.REVIEWED_BY_PROVIDER,
      },
    },
    [states.REVIEWED_BY_CUSTOMER]: {
      on: {
        [transitions.REVIEW_2_BY_PROVIDER]: states.REVIEWED,
        [transitions.EXPIRE_PROVIDER_REVIEW_PERIOD]: states.REVIEWED,
      },
    },
    [states.REVIEWED_BY_PROVIDER]: {
      on: {
        [transitions.REVIEW_2_BY_CUSTOMER]: states.REVIEWED,
        [transitions.EXPIRE_CUSTOMER_REVIEW_PERIOD]: states.REVIEWED,
      },
    },
    [states.REVIEWED]: { type: 'final' },
  },
};

// Transitions that are shown in the ActivityFeed of the transaction page.
export const isRelevantPastTransition = transition => {
  return [
    transitions.CONFIRM_PAYMENT,
    transitions.PROVIDER_ADD_SHIPPING_ADDRESS,
    transitions.MARK_SHIPPED,
    transitions.MARK_PRODUCT_RECEIVED,
    transitions.AUTO_MARK_PRODUCT_RECEIVED,
    transitions.SUBMIT_CONTENT,
    transitions.SUBMIT_CONTENT_AFTER_SHIPPING,
    transitions.REQUEST_REVISION_1,
    transitions.RESUBMIT_CONTENT_1,
    transitions.REQUEST_REVISION_2,
    transitions.RESUBMIT_CONTENT_2,
    transitions.APPROVE_CONTENT,
    transitions.APPROVE_CONTENT_REVISED_1,
    transitions.APPROVE_CONTENT_REVISED_2,
    transitions.AUTO_APPROVE_CONTENT,
    transitions.AUTO_APPROVE_CONTENT_REVISED_1,
    transitions.AUTO_APPROVE_CONTENT_REVISED_2,
    transitions.DISPUTE,
    transitions.DISPUTE_REVISED_1,
    transitions.DISPUTE_REVISED_2,
    transitions.OPERATOR_DISPUTE,
    transitions.MARK_RECEIVED_FROM_DISPUTED,
    transitions.CANCEL_FROM_DISPUTED,
    transitions.AUTO_CANCEL_FROM_DISPUTED,
    transitions.CANCEL,
    transitions.AUTO_CANCEL,
    transitions.CANCEL_FROM_SHIPPED,
    transitions.CANCEL_FROM_PRODUCT_RECEIVED,
    transitions.AUTO_CANCEL_FROM_PRODUCT_RECEIVED,
    transitions.CANCEL_FROM_REVISION_1,
    transitions.CANCEL_FROM_REVISION_2,
    transitions.AUTO_CANCEL_FROM_REVISION_1,
    transitions.AUTO_CANCEL_FROM_REVISION_2,
    transitions.AUTO_COMPLETE,
    transitions.REVIEW_1_BY_CUSTOMER,
    transitions.REVIEW_1_BY_PROVIDER,
    transitions.REVIEW_2_BY_CUSTOMER,
    transitions.REVIEW_2_BY_PROVIDER,
  ].includes(transition);
};

export const isCustomerReview = transition => {
  return [transitions.REVIEW_1_BY_CUSTOMER, transitions.REVIEW_2_BY_CUSTOMER].includes(transition);
};

export const isProviderReview = transition => {
  return [transitions.REVIEW_1_BY_PROVIDER, transitions.REVIEW_2_BY_PROVIDER].includes(transition);
};

export const isPrivileged = transition => {
  return [transitions.REQUEST_PAYMENT, transitions.REQUEST_PAYMENT_AFTER_INQUIRY].includes(
    transition
  );
};

// Payout to the creator has been released.
export const isCompleted = transition => {
  return [
    transitions.APPROVE_CONTENT,
    transitions.APPROVE_CONTENT_REVISED_1,
    transitions.APPROVE_CONTENT_REVISED_2,
    transitions.AUTO_APPROVE_CONTENT,
    transitions.AUTO_APPROVE_CONTENT_REVISED_1,
    transitions.AUTO_APPROVE_CONTENT_REVISED_2,
    transitions.MARK_RECEIVED_FROM_DISPUTED,
    transitions.AUTO_COMPLETE,
    transitions.REVIEW_1_BY_CUSTOMER,
    transitions.REVIEW_1_BY_PROVIDER,
    transitions.REVIEW_2_BY_CUSTOMER,
    transitions.REVIEW_2_BY_PROVIDER,
  ].includes(transition);
};

// The brand's payment has been refunded.
export const isRefunded = transition => {
  return [
    transitions.EXPIRE_PAYMENT,
    transitions.CANCEL,
    transitions.AUTO_CANCEL,
    transitions.CANCEL_FROM_SHIPPED,
    transitions.CANCEL_FROM_PRODUCT_RECEIVED,
    transitions.AUTO_CANCEL_FROM_PRODUCT_RECEIVED,
    transitions.CANCEL_FROM_REVISION_1,
    transitions.CANCEL_FROM_REVISION_2,
    transitions.AUTO_CANCEL_FROM_REVISION_1,
    transitions.AUTO_CANCEL_FROM_REVISION_2,
    transitions.CANCEL_FROM_DISPUTED,
    transitions.AUTO_CANCEL_FROM_DISPUTED,
  ].includes(transition);
};

// States where the CREATOR needs to act.
export const statesNeedingProviderAttention = [
  states.PURCHASED,
  states.SHIPPED,
  states.PRODUCT_RECEIVED,
  states.REVISION_REQUESTED_1,
  states.REVISION_REQUESTED_2,
];

// States where the BRAND needs to act.
export const statesNeedingCustomerAttention = [
  states.CONTENT_SUBMITTED,
  states.CONTENT_SUBMITTED_REVISED_1,
  states.CONTENT_SUBMITTED_REVISED_2,
];

// Reverse lookup built from `graph`, so it can't drift from the state machine
// above: transition name -> the state it leads to.
const transitionToState = Object.values(graph.states).reduce((acc, stateNode) => {
  Object.entries(stateNode.on || {}).forEach(([transitionName, nextState]) => {
    acc[transitionName] = nextState;
  });
  return acc;
}, {});

/**
 * Given a transaction's `attributes.transitions` array (each entry
 * `{ transition, createdAt, by }`), returns `{ [state]: Date }` — the first
 * time each state was entered. Self-transitions (provider-add-shipping-address)
 * map back to their own state, same as any other transition here, so they
 * don't affect when 'purchased' was first reached.
 */
export const getStateEnteredAtMap = (txTransitions = []) => {
  return txTransitions.reduce((acc, entry) => {
    const state = transitionToState[entry.transition];
    const enteredAt = entry.createdAt;
    if (state && enteredAt && (!acc[state] || enteredAt < acc[state])) {
      acc[state] = enteredAt;
    }
    return acc;
  }, {});
};

// Mirrors the :fn/period values on the :at (time-based) transitions in
// process.edn. Keep these in sync if the timing there changes — there's no way
// to derive them at runtime from the pushed process on the client.
export const DEADLINE_RULES = {
  [states.PURCHASED]: { days: 14, kind: 'autoCancel' },
  [states.SHIPPED]: { days: 7, kind: 'autoReceive' },
  [states.PRODUCT_RECEIVED]: { days: 21, kind: 'autoCancel' },
  [states.CONTENT_SUBMITTED]: { days: 7, kind: 'autoApprove' },
  [states.CONTENT_SUBMITTED_REVISED_1]: { days: 7, kind: 'autoApprove' },
  [states.CONTENT_SUBMITTED_REVISED_2]: { days: 7, kind: 'autoApprove' },
  [states.REVISION_REQUESTED_1]: { days: 14, kind: 'autoCancel' },
  [states.REVISION_REQUESTED_2]: { days: 14, kind: 'autoCancel' },
  [states.DISPUTED]: { days: 60, kind: 'autoCancel' },
};
