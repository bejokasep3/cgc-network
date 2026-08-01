import {
  getProcess,
  getStatesNeedingProviderAttention,
} from '../../transactions/transaction';
import {
  states,
  getStateEnteredAtMap,
  DEADLINE_RULES,
} from '../../transactions/transactionProcessCGCUGC';
import { REVISION_ROUND_BY_STATE } from '../TransactionPage/StageTracker/StageTracker';
import { REVIEW_TYPE_OF_PROVIDER } from '../../util/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Terminal states that land a collaboration in the "completed" bucket —
// either finished successfully or ended without one (canceled/expired).
const CANCELED_STATES = [states.CANCELED, states.PAYMENT_EXPIRED];
const APPROVED_STATES = [
  states.RECEIVED,
  states.COMPLETED,
  states.REVIEWED_BY_CUSTOMER,
  states.REVIEWED_BY_PROVIDER,
  states.REVIEWED,
];

export const BUCKETS = [
  { id: 'all', labelId: 'MyCollaborationsPage.tabAll' },
  { id: 'action-needed', labelId: 'MyCollaborationsPage.tabActionNeeded' },
  { id: 'in-progress', labelId: 'MyCollaborationsPage.tabInProgress' },
  { id: 'completed', labelId: 'MyCollaborationsPage.tabCompleted' },
];

// Sub-filters only shown when the parent tab actually has more than one kind
// of row in it — see hasSubFilters in MyCollaborationsPage.js.
export const SUB_BUCKETS = {
  'action-needed': [
    { id: 'needs-shipping-info', labelId: 'MyCollaborationsPage.subNeedsShippingInfo' },
    { id: 'awaiting-product', labelId: 'MyCollaborationsPage.subAwaitingProduct' },
    { id: 'ready-to-create', labelId: 'MyCollaborationsPage.subReadyToCreate' },
    { id: 'in-revision', labelId: 'MyCollaborationsPage.subInRevision' },
  ],
  'in-progress': [
    { id: 'awaiting-brand-review', labelId: 'MyCollaborationsPage.subAwaitingBrandReview' },
    { id: 'disputed', labelId: 'MyCollaborationsPage.subDisputed' },
  ],
  completed: [
    { id: 'paid', labelId: 'MyCollaborationsPage.subPaid' },
    { id: 'canceled', labelId: 'MyCollaborationsPage.subCanceled' },
  ],
};

const bucketAndSubBucketForState = (state, isShippable) => {
  if (getStatesNeedingProviderAttention().includes(state)) {
    if (state === states.PURCHASED) {
      return {
        bucket: 'action-needed',
        subBucket: isShippable ? 'needs-shipping-info' : 'ready-to-create',
      };
    }
    if (state === states.SHIPPED) {
      return { bucket: 'action-needed', subBucket: 'awaiting-product' };
    }
    if (state === states.PRODUCT_RECEIVED) {
      return { bucket: 'action-needed', subBucket: 'ready-to-create' };
    }
    if (state === states.REVISION_REQUESTED_1 || state === states.REVISION_REQUESTED_2) {
      return { bucket: 'action-needed', subBucket: 'in-revision' };
    }
    return { bucket: 'action-needed', subBucket: null };
  }
  if (CANCELED_STATES.includes(state)) {
    return { bucket: 'completed', subBucket: 'canceled' };
  }
  if (APPROVED_STATES.includes(state)) {
    return { bucket: 'completed', subBucket: 'paid' };
  }
  if (state === states.DISPUTED) {
    return { bucket: 'in-progress', subBucket: 'disputed' };
  }
  if (
    state === states.CONTENT_SUBMITTED ||
    state === states.CONTENT_SUBMITTED_REVISED_1 ||
    state === states.CONTENT_SUBMITTED_REVISED_2
  ) {
    return { bucket: 'in-progress', subBucket: 'awaiting-brand-review' };
  }
  // initial / inquiry / pending-payment shouldn't reach this list (only
  // `only: 'sale'` transactions that have passed checkout are fetched), but
  // fall back to in-progress rather than dropping the row silently.
  return { bucket: 'in-progress', subBucket: 'awaiting-brand-review' };
};

const urgencyForDueAt = dueAt => {
  if (!dueAt) return null;
  const daysLeft = (dueAt.getTime() - Date.now()) / MS_PER_DAY;
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 3) return 'soon';
  return 'normal';
};

/**
 * Derives the fields MyCollaborationsPage needs from a raw transaction
 * entity: which tab/sub-filter it belongs in, its key dates, and how urgent
 * its current deadline is. Mirrors campaignData.js (ManageCampaignsPage) on
 * the brand side — same underlying state machine, opposite role.
 *
 * @param {Object} tx - transaction entity with listing/customer included
 * @returns {Object}
 */
export const deriveCollaboration = tx => {
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

  const isPaid = bucket === 'completed' && subBucket === 'paid';
  const earnings = isPaid ? tx.attributes?.payoutTotal || null : null;

  const providerReview = (tx.reviews || []).find(
    r => r.attributes?.type === REVIEW_TYPE_OF_PROVIDER
  );
  const reviewRating = providerReview?.attributes?.rating || null;

  return {
    tx,
    listing: tx.listing,
    customer: tx.customer,
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
    earnings,
    reviewRating,
  };
};

/**
 * Derives the fields MyCollaborationsPage needs for a pending project
 * application: an inquiry transaction (default-inquiry process) the creator
 * initiated on a brand's project-brief listing.
 *
 * @param {Object} tx - transaction entity with listing/provider (the brand) included
 * @returns {Object}
 */
export const deriveApplication = tx => ({
  tx,
  listing: tx.listing,
  brand: tx.provider,
  appliedAt: tx.attributes?.createdAt ? new Date(tx.attributes.createdAt) : null,
  processName: tx.attributes.processName,
  state: getProcess(tx.attributes.processName).getState(tx),
});
