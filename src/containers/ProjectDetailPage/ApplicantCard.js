import React, { useState } from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { types as sdkTypes } from '../../util/sdkLoader';
import appSettings from '../../config/settings';
import { formatMoney } from '../../util/currency';
import { formatDateIntoPartials } from '../../util/dates';
import { getProcess, CGC_APPLICATION_PROCESS_NAME } from '../../transactions/transaction';
import { states } from '../../transactions/transactionProcessCGCApplication';
import { getAgreedPriceInSubunits, canCounter } from '../../util/application';
import { required, composeValidators, moneySubUnitAmountAtLeast } from '../../util/validators';

import {
  Avatar,
  NamedLink,
  FieldCurrencyInput,
  FieldTextInput,
  Form,
  InlineTextButton,
  ErrorMessage,
  PrimaryButton,
  SecondaryButton,
} from '../../components';

import css from './ProjectDetailPage.module.css';

const { Money } = sdkTypes;

const MIN_PRICE_SUBUNITS = 100;

const STATUS_LABEL_IDS = {
  [states.APPLIED]: 'ApplicantCard.status.applied',
  [states.COUNTERED]: 'ApplicantCard.status.countered',
  [states.ACCEPTED]: 'ApplicantCard.status.accepted',
  [states.DECLINED]: 'ApplicantCard.status.declined',
  [states.WITHDRAWN]: 'ApplicantCard.status.withdrawn',
  [states.EXPIRED]: 'ApplicantCard.status.expired',
};

// Whichever side proposed the current price, this shows the brand at a
// glance how it compares to what they originally listed — "matches",
// "+$75 over", or "-$20 under" — rather than making them do the subtraction.
const PriceComparison = ({ agreedPriceInSubunits, listedPriceInSubunits, currency, intl }) => {
  if (!Number.isInteger(agreedPriceInSubunits) || !Number.isInteger(listedPriceInSubunits)) {
    return null;
  }
  const deltaInSubunits = agreedPriceInSubunits - listedPriceInSubunits;
  if (deltaInSubunits === 0) {
    return (
      <span className={css.priceMatch}>
        <FormattedMessage id="ApplicantCard.priceMatches" />
      </span>
    );
  }
  const deltaLabel = formatMoney(intl, new Money(Math.abs(deltaInSubunits), currency));
  return (
    <span className={classNames(css.priceDelta, { [css.priceDeltaOver]: deltaInSubunits > 0 })}>
      <FormattedMessage
        id={deltaInSubunits > 0 ? 'ApplicantCard.priceOver' : 'ApplicantCard.priceUnder'}
        values={{ delta: deltaLabel }}
      />
    </span>
  );
};

// Collapsed behind a link, like ApplyForm's own counter-offer fields — a
// brand's counter is a bigger commitment (their one shot, BLUEPRINT D2) than
// Accept, so it shouldn't compete visually with the primary action.
const CounterOfferForm = ({ marketplaceCurrency, onSubmit, onCancel, inProgress, intl }) => (
  <FinalForm
    onSubmit={onSubmit}
    render={fieldRenderProps => {
      const { handleSubmit, invalid } = fieldRenderProps;
      const minPrice = formatMoney(intl, new Money(MIN_PRICE_SUBUNITS, marketplaceCurrency));
      const proposedPriceTooLowMessage = intl.formatMessage(
        { id: 'ApplicantCard.counterPriceTooLow' },
        { minPrice }
      );

      return (
        <Form className={css.counterFields} onSubmit={handleSubmit}>
          <FieldCurrencyInput
            className={css.field}
            id="counterPrice"
            name="proposedPrice"
            label={intl.formatMessage({ id: 'ApplicantCard.counterPriceLabel' })}
            placeholder={intl.formatMessage({ id: 'ApplicantCard.counterPricePlaceholder' })}
            currencyConfig={appSettings.getCurrencyFormatting(marketplaceCurrency)}
            validate={composeValidators(
              required(intl.formatMessage({ id: 'ApplicantCard.counterPriceRequired' })),
              moneySubUnitAmountAtLeast(proposedPriceTooLowMessage, MIN_PRICE_SUBUNITS)
            )}
          />
          <FieldTextInput
            className={css.field}
            type="textarea"
            id="counterReason"
            name="reason"
            label={intl.formatMessage({ id: 'ApplicantCard.counterReasonLabel' })}
            placeholder={intl.formatMessage({ id: 'ApplicantCard.counterReasonPlaceholder' })}
          />
          <div className={css.applicantCardActions}>
            <SecondaryButton type="button" onClick={onCancel} disabled={inProgress}>
              <FormattedMessage id="ApplicantCard.cancelCounter" />
            </SecondaryButton>
            <PrimaryButton type="submit" inProgress={inProgress} disabled={invalid || inProgress}>
              <FormattedMessage id="ApplicantCard.sendCounter" />
            </PrimaryButton>
          </div>
        </Form>
      );
    }}
  />
);

/**
 * One applicant, shown as an equal-weight card so a brand can compare them
 * side by side (F2.4). Actions are state-driven: an already-countered or
 * resolved application only ever shows its status, never stale buttons.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.tx - the cgc-application sale transaction (with `customer` included)
 * @param {number} [props.listedPriceInSubunits] - the project listing's own price
 * @param {string} props.currency
 * @param {string} props.marketplaceCurrency
 * @param {boolean} props.isResponding - true while this specific card's action is in flight
 * @param {propTypes.error} [props.respondError]
 * @param {Function} props.onAccept
 * @param {Function} props.onDecline
 * @param {Function} props.onCounter
 * @returns {JSX.Element}
 */
const ApplicantCard = props => {
  const {
    tx,
    projectId,
    listedPriceInSubunits,
    currency,
    marketplaceCurrency,
    isResponding,
    respondError,
    onAccept,
    onDecline,
    onCounter,
  } = props;
  const intl = useIntl();
  const [showCounterForm, setShowCounterForm] = useState(false);

  const customer = tx.customer;
  const displayName = customer?.attributes?.profile?.displayName;
  const protectedData = tx.attributes.protectedData || {};
  const metadata = tx.attributes.metadata || {};
  const creatorListingId = protectedData.creatorListingId;

  const state = getProcess(CGC_APPLICATION_PROCESS_NAME).getState(tx);
  const statusLabelId = STATUS_LABEL_IDS[state] || STATUS_LABEL_IDS[states.APPLIED];
  const agreedPriceInSubunits = getAgreedPriceInSubunits(metadata);
  const priceLabel =
    Number.isInteger(agreedPriceInSubunits) && currency
      ? formatMoney(intl, new Money(agreedPriceInSubunits, currency))
      : null;

  const appliedOn = tx.attributes.createdAt
    ? formatDateIntoPartials(tx.attributes.createdAt, intl).date
    : null;

  const isAwaitingDecision = state === states.APPLIED;
  const showCounterOption = isAwaitingDecision && canCounter(metadata);

  const handleCounterSubmit = values => {
    const proposedPrice = values.proposedPrice;
    if (!(proposedPrice instanceof Money)) {
      return;
    }
    onCounter({
      transactionId: tx.id,
      proposedPriceInSubunits: proposedPrice.amount,
      reason: values.reason,
    });
  };

  return (
    <li className={css.applicantCard}>
      <div className={css.applicantCardHeader}>
        <Avatar user={customer} className={css.avatar} disableProfileLink />
        <div className={css.applicantCardHeaderInfo}>
          {creatorListingId ? (
            <NamedLink
              className={css.applicantName}
              name="CreatorProfilePage"
              params={{ id: creatorListingId }}
            >
              {displayName}
            </NamedLink>
          ) : (
            <span className={css.applicantName}>{displayName}</span>
          )}
          {appliedOn ? (
            <span className={css.applicantAppliedOn}>
              <FormattedMessage id="ApplicantCard.appliedOn" values={{ date: appliedOn }} />
            </span>
          ) : null}
        </div>
        <span className={css.applicantStatusBadge}>
          <FormattedMessage id={statusLabelId} />
        </span>
      </div>

      <div className={css.applicantCardBody}>
        {priceLabel ? (
          <div className={css.applicantPriceRow}>
            <span className={css.applicantPrice}>{priceLabel}</span>
            <PriceComparison
              agreedPriceInSubunits={agreedPriceInSubunits}
              listedPriceInSubunits={listedPriceInSubunits}
              currency={currency}
              intl={intl}
            />
          </div>
        ) : null}

        {protectedData.readyByDate ? (
          <div className={css.applicantDetailRow}>
            <span className={css.applicantDetailLabel}>
              <FormattedMessage id="ApplicantCard.readyByLabel" />
            </span>
            <span className={css.applicantDetailValue}>{protectedData.readyByDate}</span>
          </div>
        ) : null}

        {protectedData.applicantNote ? (
          <p className={css.applicantNote}>{protectedData.applicantNote}</p>
        ) : null}
      </div>

      <ErrorMessage error={respondError} />

      {isAwaitingDecision ? (
        showCounterForm ? (
          <CounterOfferForm
            marketplaceCurrency={marketplaceCurrency}
            onSubmit={handleCounterSubmit}
            onCancel={() => setShowCounterForm(false)}
            inProgress={isResponding}
            intl={intl}
          />
        ) : (
          <div className={css.applicantCardActions}>
            <PrimaryButton
              type="button"
              inProgress={isResponding}
              disabled={isResponding}
              onClick={() => onAccept({ transactionId: tx.id })}
            >
              <FormattedMessage id="ApplicantCard.accept" />
            </PrimaryButton>
            {showCounterOption ? (
              <InlineTextButton
                type="button"
                className={css.applicantCounterLink}
                disabled={isResponding}
                onClick={() => setShowCounterForm(true)}
              >
                <FormattedMessage id="ApplicantCard.proposeCounter" />
              </InlineTextButton>
            ) : null}
            <InlineTextButton
              type="button"
              className={css.applicantDeclineLink}
              disabled={isResponding}
              onClick={() => onDecline({ transactionId: tx.id })}
            >
              <FormattedMessage id="ApplicantCard.decline" />
            </InlineTextButton>
          </div>
        )
      ) : state === states.COUNTERED ? (
        <p className={css.applicantWaiting}>
          <FormattedMessage id="ApplicantCard.waitingOnCreator" />
        </p>
      ) : state === states.ACCEPTED && protectedData.collaborationTxId ? (
        // The brand is the customer on cgc-ugc-approval (BLUEPRINT D1/D2:
        // roles are inverted relative to this cgc-application card), so
        // their view of the paid collaboration lives at OrderDetailsPage,
        // not SaleDetailsPage.
        <NamedLink
          className={css.applicantPayLink}
          name="OrderDetailsPage"
          params={{ id: protectedData.collaborationTxId }}
        >
          <FormattedMessage id="ApplicantCard.paid" />
        </NamedLink>
      ) : state === states.ACCEPTED ? (
        <NamedLink
          className={css.applicantPayLink}
          name="ProjectAcceptPage"
          params={{ id: projectId }}
          to={{ search: `applicationId=${tx.id.uuid}` }}
        >
          <FormattedMessage id="ApplicantCard.proceedToPayment" />
        </NamedLink>
      ) : null}
    </li>
  );
};

export default ApplicantCard;
