import {
  getProcess,
  getStatesNeedingCustomerAttention,
} from '../../transactions/transaction';
import {
  states,
  getStateEnteredAtMap,
  DEADLINE_RULES,
} from '../../transactions/transactionProcessCGCUGC';
import { REVISION_ROUND_BY_STATE } from '../TransactionPage/StageTracker/StageTracker';
import { REVIEW_TYPE_OF_PROVIDER } from '../../util/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Terminal states that land a campaign in the "completed" bucket — either
// finished successfully or ended without one (canceled/expired).
const CANCELED_STATES = [states.CANCELED, states.PAYMENT_EXPIRED];
const APPROVED_STATES = [
  states.RECEIVED,
  states.COMPLETED,
  states.REVIEWED_BY_CUSTOMER,
  states.REVIEWED_BY_PROVIDER,
  states.REVIEWED,
];

export const BUCKETS = [
  { id: 'all', labelId: 'ManageCampaignsPage.tabAll' },
  { id: 'needs-review', labelId: 'ManageCampaignsPage.tabNeedsReview' },
  { id: 'in-progress', labelId: 'ManageCampaignsPage.tabInProgress' },
  { id: 'completed', labelId: 'ManageCampaignsPage.tabCompleted' },
];

// Sub-filters only shown when the parent tab actually has more than one kind
// of row in it — see hasMultipleSubBuckets in ManageCampaignsPage.js.
export const SUB_BUCKETS = {
  'in-progress': [
    { id: 'awaiting-shipment', labelId: 'ManageCampaignsPage.subAwaitingShipment' },
    { id: 'in-production', labelId: 'ManageCampaignsPage.subInProduction' },
    { id: 'in-revision', labelId: 'ManageCampaignsPage.subInRevision' },
    { id: 'disputed', labelId: 'ManageCampaignsPage.subDisputed' },
  ],
  completed: [
    { id: 'approved', labelId: 'ManageCampaignsPage.subApproved' },
    { id: 'canceled', labelId: 'ManageCampaignsPage.subCanceled' },
  ],
};

const bucketAndSubBucketForState = (state, isShippable) => {
  if (getStatesNeedingCustomerAttention().includes(state)) {
    return { bucket: 'needs-review', subBucket: null };
  }
  if (CANCELED_STATES.includes(state)) {
    return { bucket: 'completed', subBucket: 'canceled' };
  }
  if (APPROVED_STATES.includes(state)) {
    return { bucket: 'completed', subBucket: 'approved' };
  }
  if (state === states.DISPUTED) {
    return { bucket: 'in-progress', subBucket: 'disputed' };
  }
  if (state === states.REVISION_REQUESTED_1 || state === states.REVISION_REQUESTED_2) {
    return { bucket: 'in-progress', subBucket: 'in-revision' };
  }
  if (state === states.SHIPPED) {
    return { bucket: 'in-progress', subBucket: 'awaiting-shipment' };
  }
  if (state === states.PRODUCT_RECEIVED) {
    return { bucket: 'in-progress', subBucket: 'in-production' };
  }
  if (state === states.PURCHASED) {
    return {
      bucket: 'in-progress',
      subBucket: isShippable ? 'awaiting-shipment' : 'in-production',
    };
  }
  // initial / inquiry / pending-payment shouldn't reach this list (only
  // `only: 'order'` transactions that have passed checkout are fetched), but
  // fall back to in-progress rather than dropping the row silently.
  return { bucket: 'in-progress', subBucket: 'in-production' };
};

const urgencyForDueAt = dueAt => {
  if (!dueAt) return null;
  const daysLeft = (dueAt.getTime() - Date.now()) / MS_PER_DAY;
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 3) return 'soon';
  return 'normal';
};

/**
 * Derives the fields ManageCampaignsPage needs from a raw transaction entity:
 * which tab/sub-filter it belongs in, its key dates, and how urgent its
 * current deadline is. Kept as a pure function so the page component only
 * has to render, not re-derive this logic.
 *
 * @param {Object} tx - transaction entity with listing/provider included
 * @returns {Object}
 */
export const deriveCampaign = tx => {
  const processName = tx.attributes.processName;
  const state = getProcess(processName).getState(tx);
  const isShippable = !!tx.listing?.attributes?.publicData?.requiresProduct;
  const turnaroundDays = tx.listing?.attributes?.publicData?.turnaroundDays;

  const { bucket, subBucket } = bucketAndSubBucketForState(state, isShippable);

  const stateEnteredAt = getStateEnteredAtMap(tx.attributes?.transitions);
  const startedAtIso = stateEnteredAt[states.PURCHASED];
  const startedAt = startedAtIso ? new Date(startedAtIso) : null;

  const targetAt =
    startedAt && Number.isFinite(turnaroundDays)
      ? new Date(startedAt.getTime() + turnaroundDays * MS_PER_DAY)
      : null;

  const deadlineRule = DEADLINE_RULES[state];
  const enteredCurrentStateAt = stateEnteredAt[state];
  const dueAt =
    deadlineRule && enteredCurrentStateAt
      ? new Date(new Date(enteredCurrentStateAt).getTime() + deadlineRule.days * MS_PER_DAY)
      : null;

  // "Final payment" in the project is the payout release to the creator, which
  // only happens once content is approved (bucket/subBucket already encode
  // that check) — there's no separate payment-collected state to track here,
  // since the brand's card is charged up front at checkout.
  const isPaid = bucket === 'completed' && subBucket === 'approved';

  const protectedData = tx.attributes?.protectedData || {};
  const trackingNumber = protectedData.trackingNumber || null;
  const shippingCarrier = protectedData.shippingCarrier || null;

  const providerReview = (tx.reviews || []).find(
    r => r.attributes?.type === REVIEW_TYPE_OF_PROVIDER
  );
  const reviewRating = providerReview?.attributes?.rating || null;

  return {
    tx,
    listing: tx.listing,
    provider: tx.provider,
    processName,
    state,
    bucket,
    subBucket,
    startedAt,
    targetAt,
    dueAt,
    deadlineKind: deadlineRule?.kind || null,
    urgency: urgencyForDueAt(dueAt),
    revisionRound: REVISION_ROUND_BY_STATE[state] || null,
    isPaid,
    trackingNumber,
    shippingCarrier,
    reviewRating,
  };
};
