import React, { useState } from 'react';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { Heading, ExternalLink, Button, IconArrowHead } from '../../../components';
import { DELIVERABLE_TYPE_OPTIONS } from '../../PostProjectPage/PostProjectForm';

import css from './DeliverableList.module.css';

// Anything the creator pastes into a version's content links is untrusted
// input, so only render it as a link when it is an http(s) URL we can vouch
// for — mirrors CollaborationDetailsMaybe.js's isSafeUrl (IMPLEMENTATION-PLAN.md
// F3.1's "jangan merender URL creator tanpa isSafeUrl" rule).
const isSafeUrl = value => /^https?:\/\/\S+$/i.test(value);

const deliverableTypeLabel = (intl, type) => {
  const option = DELIVERABLE_TYPE_OPTIONS.find(o => o.key === type);
  return option ? intl.formatMessage({ id: option.labelId }) : type;
};

const ContentLinks = ({ value }) => {
  const entries = (value || '')
    .split(/[\n,]/)
    .map(l => l.trim())
    .filter(Boolean);

  return (
    <ul className={css.linkList}>
      {entries.map((entry, index) => (
        <li key={`${entry}-${index}`} className={css.linkItem}>
          <span className={css.linkText}>{entry}</span>
          {isSafeUrl(entry) ? (
            <ExternalLink href={entry} className={css.linkOpen}>
              <FormattedMessage id="DeliverableList.openLink" />
            </ExternalLink>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

const VersionHistory = ({ versions }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (versions.length === 0) {
    return null;
  }

  return (
    <div className={css.versionHistory}>
      <button
        type="button"
        className={css.versionToggle}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <FormattedMessage
          id="DeliverableList.versionHistoryToggle"
          values={{ count: versions.length }}
        />
        <IconArrowHead
          direction={isOpen ? 'up' : 'down'}
          rootClassName={css.versionToggleIcon}
        />
      </button>
      {isOpen ? (
        <ol className={css.versionList}>
          {versions.map((version, index) => (
            <li key={`v${index}`} className={css.versionItem}>
              <p className={css.versionLabel}>
                <FormattedMessage id="DeliverableList.versionLabel" values={{ number: index + 1 }} />
              </p>
              {version.contentLinks ? <ContentLinks value={version.contentLinks} /> : null}
              {version.submissionNote ? (
                <p className={css.versionNote}>{version.submissionNote}</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
};

const DeliverableRow = ({
  deliverable,
  isTargetedForRevision,
  draft,
  canManage,
  onAddVersion,
  intl,
}) => {
  const versions = Array.isArray(deliverable.versions) ? deliverable.versions : [];
  const hasVersion = versions.length > 0;

  const statusId = isTargetedForRevision
    ? 'DeliverableList.status.revisionRequested'
    : draft
    ? 'DeliverableList.status.readyToSubmit'
    : hasVersion
    ? 'DeliverableList.status.submitted'
    : 'DeliverableList.status.pending';

  return (
    <li
      className={classNames(css.row, { [css.rowNeedsAttention]: isTargetedForRevision })}
    >
      <div className={css.rowHeader}>
        <span className={css.rowTitle}>
          <FormattedMessage
            id="DeliverableList.rowTitle"
            values={{
              quantity: deliverable.quantity,
              type: deliverableTypeLabel(intl, deliverable.type),
              platform: deliverable.platform,
            }}
          />
        </span>
        <span
          className={classNames(css.statusBadge, {
            [css.statusBadgeAttention]: isTargetedForRevision,
            [css.statusBadgeReady]: !!draft,
          })}
        >
          <FormattedMessage id={statusId} />
        </span>
      </div>

      {deliverable.spec ? <p className={css.rowSpec}>{deliverable.spec}</p> : null}

      <VersionHistory versions={versions} />

      {draft ? (
        <div className={css.draftPreview}>
          <FormattedMessage id="DeliverableList.draftPreviewLabel" />
          <ContentLinks value={draft.contentLinks} />
        </div>
      ) : null}

      {canManage ? (
        <Button type="button" className={css.addVersionButton} onClick={onAddVersion}>
          <FormattedMessage
            id={hasVersion || draft ? 'DeliverableList.addAnotherVersion' : 'DeliverableList.addVersion'}
          />
        </Button>
      ) : null}
    </li>
  );
};

/**
 * The deliverables of a cgc-ugc-approval collaboration, rendered as
 * structured objects (IMPLEMENTATION-PLAN.md F3.1 / BLUEPRINT R12) instead
 * of a single blob of pasted links: each row tracks its own status and an
 * openable version history, and — for the creator, while it's their turn —
 * a per-item "add version" action. Uploads are staged locally (`drafts`)
 * until "submit for review" bundles every staged version into one
 * transition, since the underlying process only allows one content
 * submission per round (see TransactionPage.js's onSubmitDeliverables).
 *
 * @component
 * @param {Object} props
 * @param {Array} props.deliverables - `protectedData.deliverables`, each
 *   `{ id, type, platform, spec, quantity, versions: [] }`
 * @param {boolean} props.canManage - true only for the creator, only while a
 *   content-submission transition is currently available to them
 * @param {Object} [props.drafts] - `{ [deliverableId]: { contentLinks, submissionNote } }`,
 *   staged locally, not yet sent to the server
 * @param {Array<string>} [props.targetDeliverableIds] - deliverable ids the
 *   brand's latest revision request pointed at
 * @param {Function} props.onAddVersion - `(deliverableId) => void`, opens
 *   the per-item upload modal
 * @param {Function} props.onSubmitForReview
 * @param {boolean} [props.submitInProgress]
 * @param {propTypes.error} [props.submitError]
 * @returns {JSX.Element|null}
 */
const DeliverableList = props => {
  const intl = useIntl();
  const {
    deliverables,
    canManage,
    drafts = {},
    targetDeliverableIds = [],
    onAddVersion,
    onSubmitForReview,
    submitInProgress = false,
    submitError,
  } = props;

  if (!Array.isArray(deliverables) || deliverables.length === 0) {
    return null;
  }

  const canSubmitForReview = deliverables.every(
    d => (Array.isArray(d.versions) && d.versions.length > 0) || !!drafts[d.id]
  );

  return (
    <div className={css.root}>
      <Heading as="h3" rootClassName={css.heading}>
        <FormattedMessage id="DeliverableList.heading" values={{ count: deliverables.length }} />
      </Heading>
      <ul className={css.list}>
        {deliverables.map(deliverable => (
          <DeliverableRow
            key={deliverable.id}
            deliverable={deliverable}
            isTargetedForRevision={canManage && targetDeliverableIds.includes(deliverable.id)}
            draft={drafts[deliverable.id]}
            canManage={canManage}
            onAddVersion={() => onAddVersion(deliverable.id)}
            intl={intl}
          />
        ))}
      </ul>

      {canManage ? (
        <div className={css.submitRow}>
          {submitError ? (
            <p className={css.error}>
              <FormattedMessage id="DeliverableList.submitFailed" />
            </p>
          ) : null}
          <Button
            type="button"
            inProgress={submitInProgress}
            disabled={!canSubmitForReview || submitInProgress}
            onClick={onSubmitForReview}
          >
            <FormattedMessage id="DeliverableList.submitForReview" />
          </Button>
          {!canSubmitForReview ? (
            <p className={css.submitHint}>
              <FormattedMessage id="DeliverableList.submitHint" />
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default DeliverableList;
