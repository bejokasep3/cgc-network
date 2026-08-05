import React, { useState } from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { types as sdkTypes } from '../../util/sdkLoader';
import appSettings from '../../config/settings';
import { formatMoney } from '../../util/currency';
import {
  required,
  composeValidators,
  moneySubUnitAmountAtLeast,
} from '../../util/validators';

import {
  Form,
  FieldTextInput,
  FieldCurrencyInput,
  InlineTextButton,
  ErrorMessage,
  PrimaryButton,
} from '../../components';

import css from './ProjectDetailPage.module.css';

const { Money } = sdkTypes;

// Sane floor so a counter-offer can't be a literal $0 — mirrors
// PostProjectForm.js's MIN_PRICE_SUBUNITS for the same reason.
const MIN_PRICE_SUBUNITS = 100;

const todayISO = () => new Date().toISOString().slice(0, 10);

const notInThePast = message => value => {
  return !value || value >= todayISO() ? undefined : message;
};

/**
 * The "propose a different price" half of the apply form (BLUEPRINT D2):
 * collapsed by default behind a small text link so the one-tap "apply at
 * this price" path stays the obviously lighter action. Only rendered at all
 * when the project's `priceNegotiable` allows it.
 */
const CounterOfferFields = ({ marketplaceCurrency, formId, intl }) => {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <InlineTextButton
        type="button"
        className={css.proposeDifferentPrice}
        onClick={() => setOpen(true)}
      >
        <FormattedMessage id="ApplyForm.proposeDifferentPrice" />
      </InlineTextButton>
    );
  }

  const minPrice = formatMoney(intl, new Money(MIN_PRICE_SUBUNITS, marketplaceCurrency));
  const proposedPriceTooLowMessage = intl.formatMessage(
    { id: 'ApplyForm.proposedPriceTooLow' },
    { minPrice }
  );

  return (
    <div className={css.counterFields}>
      <FieldCurrencyInput
        className={css.field}
        id={formId ? `${formId}.proposedPrice` : 'proposedPrice'}
        name="proposedPrice"
        label={intl.formatMessage({ id: 'ApplyForm.proposedPriceLabel' })}
        placeholder={intl.formatMessage({ id: 'ApplyForm.proposedPricePlaceholder' })}
        currencyConfig={appSettings.getCurrencyFormatting(marketplaceCurrency)}
        validate={composeValidators(
          required(intl.formatMessage({ id: 'ApplyForm.proposedPriceRequired' })),
          moneySubUnitAmountAtLeast(proposedPriceTooLowMessage, MIN_PRICE_SUBUNITS)
        )}
      />
      <FieldTextInput
        className={css.field}
        type="textarea"
        id={formId ? `${formId}.offerReason` : 'offerReason'}
        name="offerReason"
        label={intl.formatMessage({ id: 'ApplyForm.offerReasonLabel' })}
        placeholder={intl.formatMessage({ id: 'ApplyForm.offerReasonPlaceholder' })}
        validate={required(intl.formatMessage({ id: 'ApplyForm.offerReasonRequired' }))}
      />
      <InlineTextButton type="button" className={css.cancelCounter} onClick={() => setOpen(false)}>
        <FormattedMessage id="ApplyForm.cancelCounter" />
      </InlineTextButton>
    </div>
  );
};

/**
 * @component
 * @param {Object} props
 * @param {Object} props.price - the project listing's price (Money)
 * @param {boolean} props.priceNegotiable
 * @param {string} [props.defaultReadyByDate] - ISO date, from the project's contentDueDate
 * @param {string} props.marketplaceCurrency
 * @param {boolean} [props.inProgress]
 * @param {propTypes.error} [props.applyError]
 * @returns {JSX.Element}
 */
const ApplyForm = props => (
  <FinalForm
    {...props}
    initialValues={{ readyByDate: props.defaultReadyByDate || '' }}
    render={fieldRenderProps => {
      const {
        rootClassName,
        className,
        formId = 'ApplyForm',
        handleSubmit,
        inProgress = false,
        applyError,
        price,
        priceNegotiable,
        marketplaceCurrency,
        invalid,
        values,
      } = fieldRenderProps;

      const intl = useIntl();
      const classes = classNames(rootClassName || css.applyForm, className);
      const submitDisabled = invalid || inProgress;
      const isCountering = values.proposedPrice instanceof Money;

      const readyByRequiredMessage = intl.formatMessage({
        id: 'ApplyForm.readyByDateRequired',
      });
      const readyByPastMessage = intl.formatMessage({ id: 'ApplyForm.readyByDatePastError' });
      const priceLabel = price ? formatMoney(intl, price) : '';

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          <FieldTextInput
            className={css.field}
            type="date"
            id={formId ? `${formId}.readyByDate` : 'readyByDate'}
            name="readyByDate"
            label={intl.formatMessage({ id: 'ApplyForm.readyByDateLabel' })}
            min={todayISO()}
            validate={composeValidators(
              required(readyByRequiredMessage),
              notInThePast(readyByPastMessage)
            )}
          />
          <FieldTextInput
            className={css.field}
            type="textarea"
            id={formId ? `${formId}.applicantNote` : 'applicantNote'}
            name="applicantNote"
            label={intl.formatMessage({ id: 'ApplyForm.applicantNoteLabel' })}
            placeholder={intl.formatMessage({ id: 'ApplyForm.applicantNotePlaceholder' })}
          />

          {priceNegotiable ? (
            <CounterOfferFields
              marketplaceCurrency={marketplaceCurrency}
              formId={formId}
              intl={intl}
            />
          ) : null}

          <div className={css.applySubmitRow}>
            <ErrorMessage error={applyError} />
            <PrimaryButton type="submit" inProgress={inProgress} disabled={submitDisabled}>
              {isCountering ? (
                <FormattedMessage id="ApplyForm.submitCounter" />
              ) : (
                <FormattedMessage id="ApplyForm.submitAtPrice" values={{ price: priceLabel }} />
              )}
            </PrimaryButton>
          </div>
        </Form>
      );
    }}
  />
);

export default ApplyForm;
