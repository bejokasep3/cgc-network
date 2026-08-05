import { getProcess } from '../../transactions/transaction';
import { states } from '../../transactions/transactionProcessCGCUGC';
import { types as sdkTypes } from '../../util/sdkLoader';

const { Money } = sdkTypes;

// IMPLEMENTATION-PLAN.md F8.2: "cair, ditahan, menunggu tinjauan" — three
// buckets a creator's own sale transactions fall into. All three read
// tx.attributes.payoutTotal (set once at the confirm-payment transition and
// unchanged afterwards in this process, since no later transition edits line
// items) — the only thing that differs between buckets is whether that
// amount has actually been released yet, and if not, whose turn it is to
// act next.
export const EARNINGS_BUCKETS = {
  PAID: 'paid',
  AWAITING_REVIEW: 'awaitingReview',
  HELD: 'held',
};

// Released to the creator — mirrors MyCollaborationsPage/collaborationData.js's
// APPROVED_STATES exactly (same "payout released" states, see that file's
// comment and transaction.js's isCompleted()).
const PAID_STATES = [
  states.RECEIVED,
  states.COMPLETED,
  states.REVIEWED_BY_CUSTOMER,
  states.REVIEWED_BY_PROVIDER,
  states.REVIEWED,
];

// Content has been submitted (or disputed) — money is escrowed and the ball
// is in the brand's or operator's court, not the creator's.
const AWAITING_REVIEW_STATES = [
  states.CONTENT_SUBMITTED,
  states.CONTENT_SUBMITTED_REVISED_1,
  states.CONTENT_SUBMITTED_REVISED_2,
  states.DISPUTED,
];

// Money is captured but the creator hasn't submitted anything yet (or a
// revision was requested) — the ball is in the creator's court.
const HELD_STATES = [
  states.PURCHASED,
  states.SHIPPED,
  states.PRODUCT_RECEIVED,
  states.REVISION_REQUESTED_1,
  states.REVISION_REQUESTED_2,
];

// Canceled/expired transactions never paid out and are excluded from every
// bucket — same as CANCELED_STATES in collaborationData.js.
export const bucketForState = state => {
  if (PAID_STATES.includes(state)) return EARNINGS_BUCKETS.PAID;
  if (AWAITING_REVIEW_STATES.includes(state)) return EARNINGS_BUCKETS.AWAITING_REVIEW;
  if (HELD_STATES.includes(state)) return EARNINGS_BUCKETS.HELD;
  return null;
};

/**
 * @param {Object} tx - transaction entity, with listing/customer included
 * @returns {Object|null} row data, or null for a transaction outside all
 *   three buckets (canceled/expired/pre-payment)
 */
export const deriveEarningsRow = tx => {
  const processName = tx.attributes.processName;
  const state = getProcess(processName).getState(tx);
  const bucket = bucketForState(state);
  if (!bucket) {
    return null;
  }

  return {
    tx,
    listing: tx.listing,
    customer: tx.customer,
    state,
    bucket,
    amount: tx.attributes?.payoutTotal || null,
    lastTransitionedAt: tx.attributes?.lastTransitionedAt
      ? new Date(tx.attributes.lastTransitionedAt)
      : null,
  };
};

/**
 * Sums each bucket's amounts into one Money per bucket. Assumes a single
 * marketplace currency (the same assumption PostProjectForm/FieldCurrencyInput
 * make via config.currency) — summing raw subunits across rows and wrapping
 * once, rather than trying to add Money instances one at a time.
 *
 * @param {Array<Object>} rows - deriveEarningsRow() output, nulls filtered out
 * @param {string} currency - config.currency, used when a bucket is empty
 * @returns {Object} { [bucketId]: { total: Money, count: number } }
 */
export const summarizeEarnings = (rows, currency) => {
  const summary = {
    [EARNINGS_BUCKETS.PAID]: { amount: 0, count: 0 },
    [EARNINGS_BUCKETS.AWAITING_REVIEW]: { amount: 0, count: 0 },
    [EARNINGS_BUCKETS.HELD]: { amount: 0, count: 0 },
  };

  rows.forEach(row => {
    if (!row.amount) return;
    summary[row.bucket].amount += row.amount.amount;
    summary[row.bucket].count += 1;
  });

  return Object.fromEntries(
    Object.entries(summary).map(([bucket, { amount, count }]) => [
      bucket,
      { total: new Money(amount, currency), count },
    ])
  );
};
