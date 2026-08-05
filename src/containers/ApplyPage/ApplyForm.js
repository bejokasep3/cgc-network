import React, { useState } from 'react';
import { Form as FinalForm } from 'react-final-form';
import { FieldArray } from 'react-final-form-arrays';
import arrayMutators from 'final-form-arrays';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { types as sdkTypes } from '../../util/sdkLoader';
import appSettings from '../../config/settings';
import { formatMoney } from '../../util/currency';
import {
  required,
  nonEmptyArray,
  numberAtLeast,
  moneySubUnitAmountAtLeast,
  validBusinessURL,
  composeValidators,
} from '../../util/validators';

import {
  Form,
  FieldTextInput,
  FieldSelect,
  FieldCheckboxGroup,
  FieldCurrencyInput,
  InlineTextButton,
  IconDelete,
  ErrorMessage,
  PrimaryButton,
} from '../../components';

import css from './ApplyPage.module.css';

const { Money } = sdkTypes;

const MAX_HANDLES = 6;
const SAMPLE_WORK_COUNT = 3;
// Sane floor so an indicative rate can't be a literal $0 typo — not a real
// pricing policy, mirrors PostProjectForm's own MIN_PRICE_SUBUNITS guard.
const MIN_RATE_SUBUNITS = 100;

const initKeys = () => [1, [0]];
const addKey = setKeys => setKeys(([counter, keys]) => [counter + 1, [...keys, counter]]);
const removeKeyAt = (setKeys, index) =>
  setKeys(([counter, keys]) => [counter, [...keys.slice(0, index), ...keys.slice(index + 1)]]);

const HandleRow = ({ name, index, platformOptions, onRemove, showRemove, formId, intl }) => {
  const idPrefix = `${formId}_handle_${index}`;
  return (
    <div className={css.handleRow}>
      <FieldSelect
        className={css.handleField}
        id={`${idPrefix}_platform`}
        name={`${name}.platform`}
        label={intl.formatMessage({ id: 'ApplyForm.handlePlatformLabel' })}
        validate={required(intl.formatMessage({ id: 'ApplyForm.handlePlatformRequired' }))}
      >
        <option disabled value="">
          {intl.formatMessage({ id: 'ApplyForm.handlePlatformPlaceholder' })}
        </option>
        {platformOptions.map(option => (
          <option key={`${option.option}`} value={`${option.option}`}>
            {option.label}
          </option>
        ))}
      </FieldSelect>

      <FieldTextInput
        className={css.handleField}
        type="text"
        id={`${idPrefix}_url`}
        name={`${name}.url`}
        label={intl.formatMessage({ id: 'ApplyForm.handleUrlLabel' })}
        placeholder={intl.formatMessage({ id: 'ApplyForm.handleUrlPlaceholder' })}
        validate={composeValidators(
          required(intl.formatMessage({ id: 'ApplyForm.handleUrlRequired' })),
          validBusinessURL(intl.formatMessage({ id: 'ApplyForm.handleUrlInvalid' }))
        )}
      />

      <FieldTextInput
        className={css.handleFieldNarrow}
        type="number"
        min="0"
        id={`${idPrefix}_followers`}
        name={`${name}.followers`}
        label={intl.formatMessage({ id: 'ApplyForm.handleFollowersLabel' })}
        placeholder={intl.formatMessage({ id: 'ApplyForm.handleFollowersPlaceholder' })}
      />

      {showRemove ? (
        <InlineTextButton className={css.handleRemove} type="button" onClick={onRemove}>
          <IconDelete rootClassName={css.handleRemoveIcon} />
          <FormattedMessage id="ApplyForm.removeHandle" />
        </InlineTextButton>
      ) : null}
    </div>
  );
};

const HandlesField = ({ formId, listingFieldsConfig, intl }) => {
  const [[counter, keys], setKeys] = useState(initKeys);
  const platformOptions = (listingFieldsConfig || []).find(f => f.key === 'platforms')
    ?.enumOptions || [];

  return (
    <FieldArray
      name="handles"
      validate={nonEmptyArray(intl.formatMessage({ id: 'ApplyForm.handlesRequired' }))}
    >
      {({ fields }) => (
        <div className={css.field}>
          <label className={css.fieldArrayLabel}>
            <FormattedMessage id="ApplyForm.handlesLabel" />
          </label>

          {fields.map((name, index) => (
            <HandleRow
              key={keys[index]}
              name={name}
              index={index}
              platformOptions={platformOptions}
              showRemove={fields.length > 1}
              onRemove={() => {
                fields.remove(index);
                removeKeyAt(setKeys, index);
              }}
              formId={formId}
              intl={intl}
            />
          ))}

          {fields.length < MAX_HANDLES ? (
            <InlineTextButton
              className={css.addHandle}
              type="button"
              onClick={() => {
                fields.push({ platform: '', url: '', followers: '' });
                addKey(setKeys);
              }}
            >
              <FormattedMessage id="ApplyForm.addHandle" />
            </InlineTextButton>
          ) : null}
        </div>
      )}
    </FieldArray>
  );
};

/**
 * Creator application form (IMPLEMENTATION-PLAN.md F4.1, shape per §2.7).
 * Submitted once, right after signup, while the account sits in Sharetribe's
 * built-in `pending-approval` state — this is what gives the operator (F5.2)
 * something to actually review, since account approval alone tells them
 * nothing about who the creator is.
 *
 * @component
 * @param {Object} props
 * @param {Array<Object>} props.listingFieldsConfig - config.listing.listingFields
 * @param {string} props.marketplaceCurrency - config.currency
 * @param {boolean} [props.inProgress]
 * @param {propTypes.error} [props.apiSubmitError]
 * @returns {JSX.Element}
 */
const ApplyForm = props => (
  <FinalForm
    {...props}
    mutators={{ ...arrayMutators }}
    initialValues={{ handles: [{ platform: '', url: '', followers: '' }] }}
    render={fieldRenderProps => {
      const {
        rootClassName,
        className,
        formId = 'ApplyForm',
        handleSubmit,
        inProgress = false,
        invalid,
        apiSubmitError,
        listingFieldsConfig,
        marketplaceCurrency,
      } = fieldRenderProps;
      const intl = useIntl();
      const classes = classNames(rootClassName || css.form, className);
      const submitDisabled = invalid || inProgress;

      const nicheOptions = (listingFieldsConfig || []).find(f => f.key === 'contentNiche')
        ?.enumOptions || [];

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          <HandlesField formId={formId} listingFieldsConfig={listingFieldsConfig} intl={intl} />

          <div className={css.field}>
            <label className={css.fieldArrayLabel}>
              <FormattedMessage id="ApplyForm.sampleWorksLabel" />
            </label>
            <p className={css.fieldHint}>
              <FormattedMessage id="ApplyForm.sampleWorksHint" />
            </p>
            {Array.from({ length: SAMPLE_WORK_COUNT }, (_, i) => (
              <FieldTextInput
                key={`sampleWork${i}`}
                className={css.field}
                type="text"
                id={`${formId}_sampleWork${i}`}
                name={`sampleWork${i}`}
                label={intl.formatMessage(
                  { id: 'ApplyForm.sampleWorkLabel' },
                  { number: i + 1 }
                )}
                placeholder={intl.formatMessage({ id: 'ApplyForm.sampleWorkPlaceholder' })}
                validate={composeValidators(
                  required(intl.formatMessage({ id: 'ApplyForm.sampleWorkRequired' })),
                  validBusinessURL(intl.formatMessage({ id: 'ApplyForm.sampleWorkInvalid' }))
                )}
              />
            ))}
          </div>

          <FieldCheckboxGroup
            className={css.field}
            id={`${formId}_niches`}
            name="niches"
            label={intl.formatMessage({ id: 'ApplyForm.nichesLabel' })}
            options={nicheOptions.map(o => ({ key: `${o.option}`, label: o.label }))}
            validate={nonEmptyArray(intl.formatMessage({ id: 'ApplyForm.nichesRequired' }))}
          />

          <FieldTextInput
            className={css.field}
            type="number"
            min="1"
            id={`${formId}_typicalTurnaroundDays`}
            name="typicalTurnaroundDays"
            label={intl.formatMessage({ id: 'ApplyForm.typicalTurnaroundDaysLabel' })}
            placeholder={intl.formatMessage({ id: 'ApplyForm.typicalTurnaroundDaysPlaceholder' })}
            validate={composeValidators(
              required(intl.formatMessage({ id: 'ApplyForm.typicalTurnaroundDaysRequired' })),
              numberAtLeast(
                intl.formatMessage({ id: 'ApplyForm.typicalTurnaroundDaysTooLow' }),
                1
              )
            )}
          />

          <FieldCurrencyInput
            className={css.field}
            id={`${formId}_indicativeRate`}
            name="indicativeRate"
            label={intl.formatMessage({ id: 'ApplyForm.indicativeRateLabel' })}
            placeholder={intl.formatMessage({ id: 'ApplyForm.indicativeRatePlaceholder' })}
            currencyConfig={appSettings.getCurrencyFormatting(marketplaceCurrency)}
            validate={composeValidators(
              required(intl.formatMessage({ id: 'ApplyForm.indicativeRateRequired' })),
              moneySubUnitAmountAtLeast(
                intl.formatMessage(
                  { id: 'ApplyForm.indicativeRateTooLow' },
                  { minPrice: formatMoney(intl, new Money(MIN_RATE_SUBUNITS, marketplaceCurrency)) }
                ),
                MIN_RATE_SUBUNITS
              )
            )}
          />

          {apiSubmitError ? <ErrorMessage error={apiSubmitError} /> : null}

          <PrimaryButton type="submit" inProgress={inProgress} disabled={submitDisabled}>
            <FormattedMessage id="ApplyForm.submit" />
          </PrimaryButton>
        </Form>
      );
    }}
  />
);

export default ApplyForm;
