import React, { useState } from 'react';

import { FormattedMessage } from '../../../util/reactIntl';
import { PrimaryButton, SecondaryButton, InlineTextButton } from '../../../components';

import css from './TransactionPanel.module.css';

// Fixed by BLUEPRINT R15/D2 — not configurable per project.
const MAX_REVISIONS = 2;

/**
 * Consolidates the brand's content-review decision — approve, request a
 * revision, or escalate — into one place, instead of a primary button, a
 * secondary button, and an unrelated dispute link elsewhere on the page.
 * Approving releases payment and can't be undone, so it goes through an
 * inline confirmation step rather than firing on the first click.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.primaryButtonProps - Fires the approve transition (inProgress, error, onAction, buttonText, errorText)
 * @param {Object} [props.secondaryButtonProps] - Opens the request-revision modal; absent once the revision cap is exhausted
 * @param {number} [props.revisionsUsed] - How many of the two revisions have been used as of this review (F3.2 — the quota should always be visible, not just implied by which round it is)
 * @param {Function} props.onOpenDisputeModal
 * @returns {JSX.Element|null}
 */
const ApprovalDecisionPanel = props => {
  const { primaryButtonProps, secondaryButtonProps, revisionsUsed, onOpenDisputeModal } = props;
  const [confirming, setConfirming] = useState(false);

  if (!primaryButtonProps) {
    return null;
  }

  const { inProgress, error, onAction, buttonText, errorText } = primaryButtonProps;
  const errorMessage = error ? <p className={css.genericError}>{errorText}</p> : null;
  const revisionQuota = Number.isInteger(revisionsUsed) ? (
    <p className={css.revisionQuota}>
      <FormattedMessage
        id="ApprovalDecisionPanel.revisionQuota"
        values={{ used: revisionsUsed, max: MAX_REVISIONS }}
      />
    </p>
  ) : null;

  return (
    <div className={css.approvalPanel}>
      {confirming ? (
        <>
          <p className={css.approvalConfirmText}>
            <FormattedMessage id="ApprovalDecisionPanel.confirmText" />
          </p>
          {errorMessage}
          <div className={css.approvalActions}>
            <SecondaryButton
              type="button"
              disabled={inProgress}
              onClick={() => setConfirming(false)}
            >
              <FormattedMessage id="ApprovalDecisionPanel.cancel" />
            </SecondaryButton>
            <PrimaryButton type="button" inProgress={inProgress} onClick={onAction}>
              <FormattedMessage id="ApprovalDecisionPanel.confirmApprove" />
            </PrimaryButton>
          </div>
        </>
      ) : (
        <>
          <p className={css.approvalHeading}>
            <FormattedMessage id="ApprovalDecisionPanel.heading" />
          </p>
          {revisionQuota}
          {errorMessage}
          <div className={css.approvalActions}>
            <PrimaryButton type="button" onClick={() => setConfirming(true)}>
              {buttonText}
            </PrimaryButton>
            {secondaryButtonProps ? (
              <SecondaryButton type="button" onClick={secondaryButtonProps.onAction}>
                {secondaryButtonProps.buttonText}
              </SecondaryButton>
            ) : null}
          </div>
          {!secondaryButtonProps ? (
            <p className={css.revisionExhaustedNote}>
              <FormattedMessage id="ApprovalDecisionPanel.revisionExhausted" />
            </p>
          ) : null}
          <InlineTextButton
            type="button"
            className={css.approvalEscalate}
            onClick={onOpenDisputeModal}
          >
            <FormattedMessage id="TransactionPanel.cgc-ugc-approval.disputeOrder" />
          </InlineTextButton>
        </>
      )}
    </div>
  );
};

export default ApprovalDecisionPanel;
