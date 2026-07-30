import React from 'react';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { formatDateIntoPartials } from '../../../util/dates';
import { IconCheckmark } from '../../../components';
import { CGC_UGC_PROCESS_NAME } from '../../../transactions/transaction';
import {
  states,
  getStateEnteredAtMap,
  DEADLINE_RULES,
} from '../../../transactions/transactionProcessCGCUGC';

import css from './StageTracker.module.css';

// Collapses the 19 process states into the 5 human-facing stages the client
// asked for. Built from `states` (not raw strings), so a state rename in
// transactionProcessCGCUGC.js breaks this at a glance instead of silently
// drifting out of sync with process.edn.
const STAGES = [
  { key: 'booked', states: [states.PURCHASED] },
  {
    key: 'productShipped',
    states: [states.SHIPPED, states.PRODUCT_RECEIVED],
    productOnly: true,
  },
  {
    key: 'contentSubmitted',
    states: [
      states.CONTENT_SUBMITTED,
      states.CONTENT_SUBMITTED_REVISED_1,
      states.CONTENT_SUBMITTED_REVISED_2,
    ],
  },
  { key: 'inRevision', states: [states.REVISION_REQUESTED_1, states.REVISION_REQUESTED_2] },
  {
    key: 'approvedPaid',
    states: [
      states.RECEIVED,
      states.COMPLETED,
      states.REVIEWED_BY_CUSTOMER,
      states.REVIEWED_BY_PROVIDER,
      states.REVIEWED,
    ],
  },
];

// Terminal states get their own treatment instead of pretending to be a stage
// in the happy path.
const TERMINAL_STATES = [states.CANCELED, states.DISPUTED];

// Nothing to track before checkout completes.
const PRE_TRACKING_STATES = [
  states.INITIAL,
  states.INQUIRY,
  states.PENDING_PAYMENT,
  states.PAYMENT_EXPIRED,
];

// Exported so InboxPage can show the same "Revision X of Y" counter on inbox
// rows without re-deriving it and risking drift from this component.
export const REVISION_ROUND_BY_STATE = {
  [states.REVISION_REQUESTED_1]: 1,
  [states.CONTENT_SUBMITTED_REVISED_1]: 1,
  [states.REVISION_REQUESTED_2]: 2,
  [states.CONTENT_SUBMITTED_REVISED_2]: 2,
};
export const MAX_REVISIONS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Horizontal (desktop) / vertical (mobile) tracker showing where a
 * cgc-ugc-approval collaboration stands, pinned above the transaction panel.
 * The two-revision cap and the auto-approve/auto-cancel clock are otherwise
 * invisible to both parties, so this is the surface that makes them explicit.
 *
 * @component
 * @param {Object} props
 * @param {string} props.processName
 * @param {string} props.processState
 * @param {Array} props.txTransitions - transaction.attributes.transitions
 * @param {boolean} props.isShippable - listing.attributes.publicData.requiresProduct
 * @returns {JSX.Element|null}
 */
const StageTracker = props => {
  const intl = useIntl();
  const { processName, processState, txTransitions = [], isShippable } = props;

  if (processName !== CGC_UGC_PROCESS_NAME || PRE_TRACKING_STATES.includes(processState)) {
    return null;
  }

  const stateEnteredAt = getStateEnteredAtMap(txTransitions);
  const formatDate = date => (date ? formatDateIntoPartials(date, intl).date : null);

  if (TERMINAL_STATES.includes(processState)) {
    const messageId =
      processState === states.DISPUTED
        ? 'StageTracker.terminal.disputed'
        : 'StageTracker.terminal.canceled';
    return (
      <div className={classNames(css.root, css.terminal)}>
        <FormattedMessage id={messageId} />
      </div>
    );
  }

  const stagesInOrder = STAGES.filter(stage => !stage.productOnly || isShippable);
  const currentIndex = stagesInOrder.findIndex(stage => stage.states.includes(processState));
  // A state that matches no stage (shouldn't happen for a wired process, but
  // don't render a broken tracker if it does).
  if (currentIndex === -1) {
    return null;
  }

  const revisionRound = REVISION_ROUND_BY_STATE[processState];
  const deadlineRule = DEADLINE_RULES[processState];
  const enteredCurrentStateAt = stateEnteredAt[processState];
  const deadline =
    deadlineRule && enteredCurrentStateAt
      ? new Date(new Date(enteredCurrentStateAt).getTime() + deadlineRule.days * MS_PER_DAY)
      : null;

  return (
    <div className={css.root}>
      <ol className={css.stageList}>
        {stagesInOrder.map((stage, index) => {
          const status =
            index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
          // The date a stage was "reached" is the earliest of its constituent states.
          const reachedAt = stage.states.reduce((earliest, s) => {
            const at = stateEnteredAt[s];
            return at && (!earliest || at < earliest) ? at : earliest;
          }, null);

          return (
            <li
              key={stage.key}
              className={classNames(css.stage, {
                [css.stageDone]: status === 'done',
                [css.stageCurrent]: status === 'current',
                [css.stageUpcoming]: status === 'upcoming',
              })}
            >
              <span className={css.stageMarker}>
                {status === 'done' ? (
                  <IconCheckmark rootClassName={css.stageMarkerIcon} size="small" />
                ) : (
                  index + 1
                )}
              </span>
              <span className={css.stageContent}>
                <span className={css.stageLabel}>
                  <FormattedMessage id={`StageTracker.stage.${stage.key}`} />
                </span>
                {status !== 'upcoming' && reachedAt ? (
                  <span className={css.stageDate}>{formatDate(reachedAt)}</span>
                ) : null}
                {status === 'current' && revisionRound ? (
                  <span className={css.revisionCounter}>
                    <FormattedMessage
                      id="StageTracker.revisionCounter"
                      values={{ round: revisionRound, max: MAX_REVISIONS }}
                    />
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      {deadlineRule && deadline ? (
        <p className={css.deadline}>
          <FormattedMessage
            id={`StageTracker.deadline.${deadlineRule.kind}`}
            values={{ date: formatDate(deadline) }}
          />
        </p>
      ) : null}
    </div>
  );
};

export default StageTracker;
