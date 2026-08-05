import React, { useState } from 'react';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { types as sdkTypes } from '../../util/sdkLoader';
import { formatMoney } from '../../util/currency';

import { Avatar, ExternalLink, Button, InlineTextButton, ErrorMessage } from '../../components';

import css from './AdminApplicationsPage.module.css';

const { Money } = sdkTypes;

// Untrusted input pasted by an applicant — only render as a clickable link
// when it's an http(s) URL we can vouch for. Same rule DeliverableList.js /
// CollaborationDetailsMaybe.js apply to creator-submitted content links.
const isSafeUrl = value => /^https?:\/\/\S+$/i.test(value || '');

const SafeLink = ({ value }) =>
  isSafeUrl(value) ? (
    <ExternalLink href={value} className={css.link}>
      {value}
    </ExternalLink>
  ) : (
    <span>{value}</span>
  );

const enumLabel = (listingFieldsConfig, key, value) => {
  const fieldConfig = (listingFieldsConfig || []).find(c => c.key === key);
  const option = fieldConfig?.enumOptions?.find(o => `${o.option}` === `${value}`);
  return option?.label || value;
};

const DECISION_LABEL_IDS = {
  rejected: 'AdminApplicationsPage.decisionBadge.rejected',
  moreInfoRequested: 'AdminApplicationsPage.decisionBadge.moreInfoRequested',
};

const DecisionBadge = ({ decision }) => {
  if (!decision) return null;
  const labelId = DECISION_LABEL_IDS[decision.status];
  if (!labelId) return null;
  return (
    <div className={css.decisionBadge}>
      <span className={classNames(css.decisionBadgeStatus, css[`decision-${decision.status}`])}>
        <FormattedMessage id={labelId} />
      </span>
      {decision.note ? <p className={css.decisionNote}>{decision.note}</p> : null}
    </div>
  );
};

const CreatorApplicationDetails = ({ application, listingFieldsConfig, marketplaceCurrency, intl }) => {
  if (!application) return null;
  const { handles = [], sampleWorks = [], niches = [], typicalTurnaroundDays, indicativeRateInSubunits } =
    application;

  return (
    <div className={css.details}>
      <div className={css.detailRow}>
        <span className={css.detailLabel}>
          <FormattedMessage id="AdminApplicationsPage.handlesLabel" />
        </span>
        <ul className={css.plainList}>
          {handles.map((h, i) => (
            <li key={i}>
              {h.platform} — <SafeLink value={h.url} />
              {h.followers ? ` (${intl.formatNumber(h.followers)})` : ''}
            </li>
          ))}
        </ul>
      </div>

      <div className={css.detailRow}>
        <span className={css.detailLabel}>
          <FormattedMessage id="AdminApplicationsPage.sampleWorksLabel" />
        </span>
        <ul className={css.plainList}>
          {sampleWorks.map((url, i) => (
            <li key={i}>
              <SafeLink value={url} />
            </li>
          ))}
        </ul>
      </div>

      <div className={css.detailRow}>
        <span className={css.detailLabel}>
          <FormattedMessage id="AdminApplicationsPage.nichesLabel" />
        </span>
        <span>{niches.map(n => enumLabel(listingFieldsConfig, 'contentNiche', n)).join(', ')}</span>
      </div>

      <div className={css.detailRow}>
        <span className={css.detailLabel}>
          <FormattedMessage id="AdminApplicationsPage.turnaroundLabel" />
        </span>
        <span>
          <FormattedMessage
            id="AdminApplicationsPage.turnaroundValue"
            values={{ days: typicalTurnaroundDays }}
          />
        </span>
      </div>

      <div className={css.detailRow}>
        <span className={css.detailLabel}>
          <FormattedMessage id="AdminApplicationsPage.rateLabel" />
        </span>
        <span>
          {Number.isFinite(indicativeRateInSubunits)
            ? formatMoney(intl, new Money(indicativeRateInSubunits, marketplaceCurrency))
            : '—'}
        </span>
      </div>
    </div>
  );
};

const BrandAccessRequestDetails = ({ accessRequest }) => {
  if (!accessRequest) return null;
  const { company, website, category, monthlyVolume, budgetRange, source } = accessRequest;

  const row = (labelId, value) =>
    value ? (
      <div className={css.detailRow}>
        <span className={css.detailLabel}>
          <FormattedMessage id={labelId} />
        </span>
        <span>{value}</span>
      </div>
    ) : null;

  return (
    <div className={css.details}>
      {row('AdminApplicationsPage.companyLabel', company)}
      <div className={css.detailRow}>
        <span className={css.detailLabel}>
          <FormattedMessage id="AdminApplicationsPage.websiteLabel" />
        </span>
        <SafeLink value={website} />
      </div>
      {row('AdminApplicationsPage.categoryLabel', category)}
      {row('AdminApplicationsPage.monthlyVolumeLabel', monthlyVolume)}
      {row('AdminApplicationsPage.budgetRangeLabel', budgetRange)}
      {row('AdminApplicationsPage.sourceLabel', source)}
    </div>
  );
};

const DecisionForm = ({ status, onSubmit, onCancel, inProgress }) => {
  const [note, setNote] = useState('');
  const labelId =
    status === 'rejected'
      ? 'AdminApplicationsPage.rejectReasonLabel'
      : 'AdminApplicationsPage.requestInfoNoteLabel';
  const submitLabelId =
    status === 'rejected'
      ? 'AdminApplicationsPage.confirmReject'
      : 'AdminApplicationsPage.confirmRequestInfo';

  return (
    <div className={css.decisionForm}>
      <label className={css.decisionFormLabel}>
        <FormattedMessage id={labelId} />
      </label>
      <textarea
        className={css.decisionFormTextarea}
        value={note}
        onChange={e => setNote(e.target.value)}
      />
      <div className={css.decisionFormActions}>
        <Button
          type="button"
          className={css.decisionFormSubmit}
          disabled={!note.trim() || inProgress}
          inProgress={inProgress}
          onClick={() => onSubmit(note.trim())}
        >
          <FormattedMessage id={submitLabelId} />
        </Button>
        <InlineTextButton type="button" onClick={onCancel} disabled={inProgress}>
          <FormattedMessage id="AdminApplicationsPage.cancel" />
        </InlineTextButton>
      </div>
    </div>
  );
};

/**
 * One applicant in the operator's review queue (IMPLEMENTATION-PLAN.md F5.2)
 * — a creator application or a brand access request, with the actions an
 * operator can take on it.
 *
 * @param {Object} props
 * @param {Object} props.applicant - server/api-util/adminApplications.js's serializeApplicant() shape
 * @param {Array} props.listingFieldsConfig - config.listing.listingFields
 * @param {string} props.marketplaceCurrency
 * @param {boolean} props.isActioning
 * @param {propTypes.error} [props.actionError]
 * @param {Function} props.onApprove
 * @param {Function} props.onDecide - (status, note) => void
 * @returns {JSX.Element}
 */
const ApplicantReviewCard = ({
  applicant,
  listingFieldsConfig,
  marketplaceCurrency,
  isActioning,
  actionError,
  onApprove,
  onDecide,
}) => {
  const intl = useIntl();
  const [openDecisionStatus, setOpenDecisionStatus] = useState(null);

  const { displayName, email, userType, createdAt, application, accessRequest, decision, inviteCode } =
    applicant;

  return (
    <li className={css.card}>
      <div className={css.cardHeader}>
        <Avatar
          user={{ id: { uuid: applicant.id }, attributes: { profile: { displayName } } }}
          className={css.avatar}
          disableProfileLink
        />
        <div className={css.cardHeaderInfo}>
          <span className={css.name}>{displayName || email}</span>
          <span className={css.email}>{email}</span>
        </div>
        <span className={css.userTypeBadge}>
          <FormattedMessage id={`AdminApplicationsPage.userType.${userType}`} />
        </span>
      </div>

      <p className={css.appliedOn}>
        <FormattedMessage
          id="AdminApplicationsPage.appliedOn"
          values={{ date: intl.formatDate(new Date(createdAt)) }}
        />
        {inviteCode ? (
          <FormattedMessage id="AdminApplicationsPage.viaInviteCode" values={{ code: inviteCode }} />
        ) : null}
      </p>

      <DecisionBadge decision={decision} />

      {userType === 'creator' ? (
        <CreatorApplicationDetails
          application={application}
          listingFieldsConfig={listingFieldsConfig}
          marketplaceCurrency={marketplaceCurrency}
          intl={intl}
        />
      ) : (
        <BrandAccessRequestDetails accessRequest={accessRequest} />
      )}

      {actionError ? <ErrorMessage error={actionError} /> : null}

      {openDecisionStatus ? (
        <DecisionForm
          status={openDecisionStatus}
          inProgress={isActioning}
          onCancel={() => setOpenDecisionStatus(null)}
          onSubmit={note => onDecide(openDecisionStatus, note)}
        />
      ) : (
        <div className={css.actions}>
          <Button
            type="button"
            className={css.approveButton}
            inProgress={isActioning}
            disabled={isActioning}
            onClick={onApprove}
          >
            <FormattedMessage id="AdminApplicationsPage.approve" />
          </Button>
          <InlineTextButton
            type="button"
            className={css.rejectButton}
            disabled={isActioning}
            onClick={() => setOpenDecisionStatus('rejected')}
          >
            <FormattedMessage id="AdminApplicationsPage.reject" />
          </InlineTextButton>
          <InlineTextButton
            type="button"
            disabled={isActioning}
            onClick={() => setOpenDecisionStatus('moreInfoRequested')}
          >
            <FormattedMessage id="AdminApplicationsPage.requestInfo" />
          </InlineTextButton>
        </div>
      )}
    </li>
  );
};

export default ApplicantReviewCard;
