import React, { useState } from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../util/reactIntl';
import { CGC_UGC_PROCESS_NAME } from '../../../transactions/transaction';
import { Heading, ExternalLink, IconArrowHead } from '../../../components';
import DeliverableList from '../DeliverableList/DeliverableList';

import css from './TransactionPanel.module.css';

// Anything the creator pastes into the submission field is untrusted input, so
// only render it as a link when it is an http(s) URL we can vouch for.
const isSafeUrl = value => /^https?:\/\/\S+$/i.test(value);

// A numbered deliverables list with a per-item "Open" affordance, instead of a
// wall of raw URLs. Non-URL entries (or anything that fails isSafeUrl) are
// still shown as plain text — never rendered as a link or embed.
const DeliverablesList = ({ value }) => {
  const entries = value
    .split(/[\n,]/)
    .map(l => l.trim())
    .filter(Boolean);

  return (
    <ol className={css.deliverablesList}>
      {entries.map((entry, index) => (
        <li key={entry} className={css.deliverableItem}>
          <span className={css.deliverableIndex}>{index + 1}</span>
          <span className={css.deliverableUrl}>{entry}</span>
          {isSafeUrl(entry) ? (
            <ExternalLink href={entry} className={css.deliverableOpen}>
              <FormattedMessage id="CollaborationDetails.openDeliverable" />
            </ExternalLink>
          ) : null}
        </li>
      ))}
    </ol>
  );
};

/**
 * Shows the collaboration data both parties have added over the course of a
 * cgc-ugc-approval transaction: the creator's delivery address, shipping/tracking
 * details from the brand, the deliverables list (DeliverableList, F3.1), and —
 * for transactions from before that — the old free-text submission timeline.
 * All of it lives in the transaction's protected data, written by the
 * update-protected-data action on each transition.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className]
 * @param {string} [props.rootClassName]
 * @param {string} props.processName
 * @param {Object} props.protectedData - The transaction's protected data
 * @param {boolean} [props.canManageDeliverables] - true only for the creator,
 *   only while a content-submission transition is currently available
 * @param {Object} [props.deliverableDrafts] - staged, not-yet-submitted
 *   versions, keyed by deliverable id (TransactionPage.js's cgcDeliverableDrafts)
 * @param {Function} [props.onAddDeliverableVersion] - `(deliverableId) => void`
 * @param {Function} [props.onSubmitDeliverables]
 * @param {boolean} [props.submitDeliverablesInProgress]
 * @param {propTypes.error} [props.submitDeliverablesError]
 * @returns {JSX.Element|null}
 */
const CollaborationDetailsMaybe = props => {
  // Collapsed by default — shipping/tracking is reference info the reviewer
  // rarely needs to re-check, so it shouldn't compete for space with the
  // deliverables and content history below it.
  const [shippingOpen, setShippingOpen] = useState(false);

  const {
    className,
    rootClassName,
    processName,
    protectedData,
    canManageDeliverables = false,
    deliverableDrafts,
    onAddDeliverableVersion,
    onSubmitDeliverables,
    submitDeliverablesInProgress,
    submitDeliverablesError,
  } = props;

  if (processName !== CGC_UGC_PROCESS_NAME || !protectedData) {
    return null;
  }

  const {
    shippingRecipientName,
    shippingAddressLine1,
    shippingAddressLine2,
    shippingCity,
    shippingPostalCode,
    shippingCountry,
    shippingCarrier,
    trackingNumber,
    trackingUrl,
    deliverables,
    targetDeliverableIds,
    targetDeliverableIds2,
    contentLinks,
    submissionNote,
    revisionNote,
    contentLinksRevision1,
    submissionNoteRevision1,
    revisionNote2,
    contentLinksRevision2,
    submissionNoteRevision2,
    disputeReason,
  } = protectedData;

  // Transactions checked out after F3.1 carry a structured `deliverables`
  // array (seeded server-side at checkout — see cgcCheckout.js). Anything
  // older falls through to the legacy free-text timeline below it never had.
  const hasStructuredDeliverables = Array.isArray(deliverables) && deliverables.length > 0;

  // The creator's own delivery address, supplied via the
  // provider-add-shipping-address self-transition — the brand has no other way
  // to see where to ship a product.
  const hasShippingAddress = !!shippingAddressLine1;
  const hasTracking = !!(shippingCarrier || trackingNumber || trackingUrl);

  // Chronological order: the original submission, then each round's revision
  // request and the resubmission that followed it. Entries only appear once
  // they actually happened.
  const timeline = [
    contentLinks || submissionNote
      ? {
          key: 'submission-0',
          type: 'submission',
          headingId: 'CollaborationDetails.originalSubmissionHeading',
          contentLinks,
          submissionNote,
        }
      : null,
    revisionNote
      ? {
          key: 'request-1',
          type: 'request',
          headingId: 'CollaborationDetails.revision1RequestedHeading',
          note: revisionNote,
        }
      : null,
    contentLinksRevision1 || submissionNoteRevision1
      ? {
          key: 'submission-1',
          type: 'submission',
          headingId: 'CollaborationDetails.revision1SubmissionHeading',
          contentLinks: contentLinksRevision1,
          submissionNote: submissionNoteRevision1,
        }
      : null,
    revisionNote2
      ? {
          key: 'request-2',
          type: 'request',
          headingId: 'CollaborationDetails.revision2RequestedHeading',
          note: revisionNote2,
        }
      : null,
    contentLinksRevision2 || submissionNoteRevision2
      ? {
          key: 'submission-2',
          type: 'submission',
          headingId: 'CollaborationDetails.revision2SubmissionHeading',
          contentLinks: contentLinksRevision2,
          submissionNote: submissionNoteRevision2,
        }
      : null,
  ].filter(Boolean);

  if (
    !hasShippingAddress &&
    !hasTracking &&
    timeline.length === 0 &&
    !disputeReason &&
    !hasStructuredDeliverables
  ) {
    return null;
  }

  const classes = classNames(rootClassName || css.deliveryInfoContainer, className);

  const row = (id, children) => (
    <div className={css.collaborationRow}>
      <span className={css.collaborationLabel}>
        <FormattedMessage id={id} />
      </span>
      <span className={css.collaborationValue}>{children}</span>
    </div>
  );

  const shippingHeadingId = hasTracking
    ? 'CollaborationDetails.trackingHeading'
    : 'CollaborationDetails.shippingAddressHeading';

  return (
    <div className={classes}>
      {hasShippingAddress || hasTracking ? (
        <div className={css.collapsibleSection}>
          <button
            type="button"
            className={css.collapsibleToggle}
            onClick={() => setShippingOpen(!shippingOpen)}
            aria-expanded={shippingOpen}
          >
            <FormattedMessage id={shippingHeadingId} />
            <IconArrowHead
              direction={shippingOpen ? 'up' : 'down'}
              rootClassName={css.collapsibleToggleIcon}
            />
          </button>
          {shippingOpen ? (
            <div className={css.collapsibleContent}>
              {hasShippingAddress ? (
                <>
                  {row('CollaborationDetails.recipient', shippingRecipientName)}
                  {row(
                    'CollaborationDetails.address',
                    <>
                      {shippingAddressLine1}
                      {shippingAddressLine2 ? `, ${shippingAddressLine2}` : ''}
                      <br />
                      {shippingPostalCode} {shippingCity}
                      <br />
                      {shippingCountry}
                    </>
                  )}
                </>
              ) : null}

              {hasTracking ? (
                <>
                  {shippingCarrier ? row('CollaborationDetails.carrier', shippingCarrier) : null}
                  {trackingNumber
                    ? row('CollaborationDetails.trackingNumber', trackingNumber)
                    : null}
                  {trackingUrl && isSafeUrl(trackingUrl)
                    ? row(
                        'CollaborationDetails.trackingUrl',
                        <ExternalLink href={trackingUrl}>
                          <FormattedMessage id="CollaborationDetails.trackShipment" />
                        </ExternalLink>
                      )
                    : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {hasStructuredDeliverables ? (
        <DeliverableList
          deliverables={deliverables}
          canManage={canManageDeliverables}
          drafts={deliverableDrafts}
          targetDeliverableIds={targetDeliverableIds2 || targetDeliverableIds || []}
          onAddVersion={onAddDeliverableVersion}
          onSubmitForReview={onSubmitDeliverables}
          submitInProgress={submitDeliverablesInProgress}
          submitError={submitDeliverablesError}
        />
      ) : null}

      {timeline.length > 0 ? (
        <>
          <Heading as="h3" rootClassName={css.sectionHeading}>
            <FormattedMessage id="CollaborationDetails.contentHeading" />
          </Heading>
          <ol className={css.timeline}>
            {timeline.map(item => (
              <li key={item.key} className={css.timelineItem}>
                <span className={css.timelineMarker} aria-hidden="true" />
                <div className={css.timelineBody}>
                  <p className={css.timelineHeading}>
                    <FormattedMessage id={item.headingId} />
                  </p>
                  {item.type === 'submission' ? (
                    <>
                      {item.contentLinks ? <DeliverablesList value={item.contentLinks} /> : null}
                      {item.submissionNote ? (
                        <p className={css.timelineNote}>{item.submissionNote}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className={css.timelineNote}>{item.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {disputeReason ? (
        <>
          <Heading as="h3" rootClassName={css.sectionHeading}>
            <FormattedMessage id="CollaborationDetails.disputeHeading" />
          </Heading>
          {row('CollaborationDetails.disputeReason', disputeReason)}
        </>
      ) : null}
    </div>
  );
};

export default CollaborationDetailsMaybe;
