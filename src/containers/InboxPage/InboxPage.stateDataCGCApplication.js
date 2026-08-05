import {
  TX_TRANSITION_ACTOR_CUSTOMER as CUSTOMER,
  TX_TRANSITION_ACTOR_PROVIDER as PROVIDER,
  CONDITIONAL_RESOLVER_WILDCARD,
  ConditionalResolver,
} from '../../transactions/transaction';
import {
  statesNeedingCustomerAttention,
  statesNeedingProviderAttention,
} from '../../transactions/transactionProcessCGCApplication';

// Get UI data mapped to specific transaction state & role, for cgc-application
// (project applications) — without this, an application never shows up
// anywhere for either party (IMPLEMENTATION-PLAN.md F3.4). Mirrors
// InboxPage.stateDataCGCUGC.js's shape; actionNeeded is derived from the same
// statesNeeding*Attention lists ProjectDetailPage/ApplicantCard use, so the
// inbox notification dot can't drift from what's actually actionable there.
//
// Roles: customer = CREATOR (applies), provider = BRAND (owns the project) —
// inverse of cgc-ugc-approval, see BLUEPRINT.md D1/D2.
export const getStateDataForCGCApplicationProcess = (txInfo, processInfo) => {
  const { transactionRole } = txInfo;
  const { processName, processState, states } = processInfo;
  const _ = CONDITIONAL_RESOLVER_WILDCARD;

  const actionNeeded =
    transactionRole === CUSTOMER
      ? statesNeedingCustomerAttention.includes(processState)
      : statesNeedingProviderAttention.includes(processState);

  return new ConditionalResolver([processState, transactionRole])
    .cond([states.APPLIED, PROVIDER], () => {
      return { processName, processState, actionNeeded: true, isSaleNotification: true };
    })
    .cond([states.COUNTERED, CUSTOMER], () => {
      return { processName, processState, actionNeeded: true, isOrderNotification: true };
    })
    .cond([states.DECLINED, _], () => {
      return { processName, processState, isFinal: true };
    })
    .cond([states.WITHDRAWN, _], () => {
      return { processName, processState, isFinal: true };
    })
    .cond([states.EXPIRED, _], () => {
      return { processName, processState, isFinal: true };
    })
    .default(() => {
      // Covers APPLIED/CUSTOMER, COUNTERED/PROVIDER, and ACCEPTED (either
      // role) — none of these need a notification dot per the shared
      // statesNeeding*Attention lists above.
      return { processName, processState, actionNeeded };
    })
    .resolve();
};
