import {
  TX_TRANSITION_ACTOR_CUSTOMER as CUSTOMER,
  TX_TRANSITION_ACTOR_PROVIDER as PROVIDER,
  CONDITIONAL_RESOLVER_WILDCARD,
  ConditionalResolver,
} from '../../transactions/transaction';
import {
  statesNeedingCustomerAttention,
  statesNeedingProviderAttention,
} from '../../transactions/transactionProcessCGCUGC';

// Get UI data mapped to specific transaction state & role.
// The mid-collaboration actionNeeded flag is derived from the same
// statesNeeding*Attention lists that drive the TransactionPage action
// buttons, so the inbox and the transaction page can't drift apart.
export const getStateDataForCGCUGCProcess = (txInfo, processInfo) => {
  const { transactionRole } = txInfo;
  const { processName, processState, states } = processInfo;
  const _ = CONDITIONAL_RESOLVER_WILDCARD;

  const actionNeeded =
    transactionRole === CUSTOMER
      ? statesNeedingCustomerAttention.includes(processState)
      : statesNeedingProviderAttention.includes(processState);

  return new ConditionalResolver([processState, transactionRole])
    .cond([states.INQUIRY, _], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.PENDING_PAYMENT, CUSTOMER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.PENDING_PAYMENT, PROVIDER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.PAYMENT_EXPIRED, _], () => {
      return { processName, processState, isFinal: true };
    })
    .cond([states.PURCHASED, PROVIDER], () => {
      return { processName, processState, actionNeeded, isSaleNotification: true };
    })
    .cond([states.CANCELED, _], () => {
      return { processName, processState, isFinal: true };
    })
    .cond([states.DISPUTED, _], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.COMPLETED, _], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.REVIEWED_BY_PROVIDER, CUSTOMER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.REVIEWED_BY_CUSTOMER, PROVIDER], () => {
      return { processName, processState, actionNeeded: true };
    })
    .cond([states.REVIEWED, _], () => {
      return { processName, processState, isFinal: true };
    })
    .default(() => {
      // Covers the core collaboration states: purchased/shipped/product-received/
      // revision-requested-* for the creator, content-submitted* for the brand.
      return { processName, processState, actionNeeded };
    })
    .resolve();
};
