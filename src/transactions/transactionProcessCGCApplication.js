/**
 * Transaction process graph for CGC Application process:
 *   - cgc-application
 *
 * This mirrors ext/transaction-processes/cgc-application/process.edn.
 * Keep the two in sync: the app can only offer transitions that exist in the
 * process pushed to Console.
 *
 * Roles: customer = CREATOR (applies), provider = BRAND (owns the project
 * listing). This is the inverse of cgc-ugc-approval's roles — see
 * BLUEPRINT.md D1/D2 and IMPLEMENTATION-PLAN.md 1.3 for why. This process
 * never moves money; it only records an application and, if negotiated, the
 * agreed price (in transaction metadata, not here — see 2.3b).
 */

export const transitions = {
  APPLY: 'transition/apply',
  BRAND_ACCEPT: 'transition/brand-accept',
  BRAND_DECLINE: 'transition/brand-decline',
  BRAND_COUNTER: 'transition/brand-counter',
  CREATOR_WITHDRAW: 'transition/creator-withdraw',
  EXPIRE_APPLICATION: 'transition/expire-application',
  CREATOR_ACCEPT_COUNTER: 'transition/creator-accept-counter',
  CREATOR_DECLINE_COUNTER: 'transition/creator-decline-counter',
  EXPIRE_COUNTER: 'transition/expire-counter',
  MARK_COLLABORATING: 'transition/mark-collaborating',
};

export const states = {
  INITIAL: 'initial',
  APPLIED: 'applied',
  COUNTERED: 'countered',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  WITHDRAWN: 'withdrawn',
  EXPIRED: 'expired',
};

export const graph = {
  id: 'cgc-application/release-1',
  initial: states.INITIAL,
  states: {
    [states.INITIAL]: {
      on: {
        [transitions.APPLY]: states.APPLIED,
      },
    },
    [states.APPLIED]: {
      on: {
        [transitions.BRAND_ACCEPT]: states.ACCEPTED,
        [transitions.BRAND_DECLINE]: states.DECLINED,
        [transitions.BRAND_COUNTER]: states.COUNTERED,
        [transitions.CREATOR_WITHDRAW]: states.WITHDRAWN,
        [transitions.EXPIRE_APPLICATION]: states.EXPIRED,
      },
    },
    [states.COUNTERED]: {
      on: {
        [transitions.CREATOR_ACCEPT_COUNTER]: states.ACCEPTED,
        [transitions.CREATOR_DECLINE_COUNTER]: states.DECLINED,
        [transitions.EXPIRE_COUNTER]: states.EXPIRED,
      },
    },
    [states.ACCEPTED]: {
      on: {
        [transitions.MARK_COLLABORATING]: states.ACCEPTED,
      },
    },
    [states.DECLINED]: {},
    [states.WITHDRAWN]: {},
    [states.EXPIRED]: {},
  },
};

// Transitions that are shown in the ActivityFeed of the transaction page.
export const isRelevantPastTransition = transition => {
  return [
    transitions.APPLY,
    transitions.BRAND_ACCEPT,
    transitions.BRAND_DECLINE,
    transitions.BRAND_COUNTER,
    transitions.CREATOR_WITHDRAW,
    transitions.EXPIRE_APPLICATION,
    transitions.CREATOR_ACCEPT_COUNTER,
    transitions.CREATOR_DECLINE_COUNTER,
    transitions.EXPIRE_COUNTER,
  ].includes(transition);
};

export const isCustomerReview = () => false;
export const isProviderReview = () => false;

// APPLY and BRAND_COUNTER are privileged because they write the offer amount
// to transaction metadata (server-only scope — see IMPLEMENTATION-PLAN.md
// 2.3b for why the amount can't live in protectedData). CREATOR_ACCEPT_COUNTER
// does NOT need to be privileged: it adds no new offer, since the agreed
// price is already the brand's last counter amount. MARK_COLLABORATING is
// privileged for a different reason — see process.edn.
export const isPrivileged = transition => {
  return [transitions.APPLY, transitions.BRAND_COUNTER, transitions.MARK_COLLABORATING].includes(
    transition
  );
};

// This process never releases a payout — it only produces an accepted
// application that the app's own server then uses to start a paid
// transaction on cgc-ugc-approval. See IMPLEMENTATION-PLAN.md 1.3/2.6.
export const isCompleted = () => false;

// No money ever moves in this process, so nothing is ever refunded here.
export const isRefunded = () => false;

// States where the CREATOR (customer) needs to act.
export const statesNeedingCustomerAttention = [states.COUNTERED];

// States where the BRAND (provider) needs to act.
export const statesNeedingProviderAttention = [states.APPLIED];

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
 * time each state was entered.
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
// process.edn. Keep these in sync if the timing there changes.
export const DEADLINE_RULES = {
  [states.APPLIED]: { days: 7, kind: 'autoExpire' },
  [states.COUNTERED]: { days: 3, kind: 'autoExpire' },
};
