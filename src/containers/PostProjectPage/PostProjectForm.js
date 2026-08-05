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
  composeValidators,
} from '../../util/validators';
import { isFieldForListingType } from '../../util/fieldHelpers';

import {
  Form,
  FieldTextInput,
  FieldSelect,
  FieldCheckbox,
  FieldCurrencyInput,
  CustomExtendedDataField,
  IconDelete,
  InlineTextButton,
  ErrorMessage,
  PrimaryButton,
} from '../../components';

import css from './PostProjectPage.module.css';

const { Money } = sdkTypes;

const PROJECT_LISTING_TYPE = 'project';
const TITLE_MAX_LENGTH = 60;
const MAX_DELIVERABLES = 20;
// Sane floor so a project can't be posted at a literal $0 — not a real
// pricing policy, just a guard against an empty/mistyped field. One
// marketplace-currency unit (e.g. $1.00), expressed in subunits.
const MIN_PRICE_SUBUNITS = 100;

// The per-deliverable "type" has no equivalent in Console: listing fields
// can be text/enum/multi-enum/long/boolean, but not a structured array of
// objects (IMPLEMENTATION-PLAN.md 2.4). So unlike contentNiche/platforms/
// usageRights below, these options are local, not Console-configured.
export const DELIVERABLE_TYPE_OPTIONS = [
  { key: 'video', labelId: 'PostProjectForm.deliverableType.video' },
  { key: 'photo', labelId: 'PostProjectForm.deliverableType.photo' },
  { key: 'carousel', labelId: 'PostProjectForm.deliverableType.carousel' },
  { key: 'ugc-review', labelId: 'PostProjectForm.deliverableType.ugcReview' },
];

const findFieldConfig = (listingFieldsConfig, key) =>
  (listingFieldsConfig || []).find(
    fieldConfig => fieldConfig.key === key && isFieldForListingType(PROJECT_LISTING_TYPE, fieldConfig)
  );

/**
 * Renders exactly one Console-configured listing field by key, at whatever
 * position the caller places it — unlike a generic "render everything
 * configured for this listing type" loop, this form has an explicit,
 * brief-driven field order (IMPLEMENTATION-PLAN.md F2.1) that interleaves
 * Console fields with bespoke ones (deliverables, price, due date).
 */
const SingleCustomField = ({ fieldKey, listingFieldsConfig, formId, intl }) => {
  const fieldConfig = findFieldConfig(listingFieldsConfig, fieldKey);
  return fieldConfig ? (
    <CustomExtendedDataField
      name={fieldConfig.key}
      fieldConfig={fieldConfig}
      defaultRequiredMessage={intl.formatMessage({
        id: 'PostProjectForm.defaultRequiredMessage',
      })}
      formId={formId}
    />
  ) : null;
};

const getEnumOptions = (listingFieldsConfig, key) =>
  findFieldConfig(listingFieldsConfig, key)?.enumOptions || [];

const todayISO = () => new Date().toISOString().slice(0, 10);

const notInThePast = message => value => {
  return !value || value >= todayISO() ? undefined : message;
};

// See BookingPriceVariants.js for the same pattern: FieldArray + React's
// virtual DOM need stable keys independent of array index, because removing
// a row from the middle would otherwise re-parent every field after it.
// https://github.com/final-form/react-final-form-arrays/issues/116
// The form starts with `initialCount` pre-seeded deliverable rows (1 by
// default, or however many a "Collab again" prefill carried over — see
// postProjectPrefill.js), so the key/counter state must already account for
// all of them — otherwise rows past the first render with an undefined
// React key.
const initKeys = (count = 1) => [count, Array.from({ length: count }, (_, i) => i)];
const addKey = setKeys => setKeys(([counter, keys]) => [counter + 1, [...keys, counter]]);
const removeKeyAt = (setKeys, index) =>
  setKeys(([counter, keys]) => [counter, [...keys.slice(0, index), ...keys.slice(index + 1)]]);

const DeliverableRow = ({ name, index, platformOptions, onRemove, showRemove, formId, intl }) => {
  const idPrefix = `${formId}_deliverable_${index}`;
  return (
    <div className={css.deliverableRow}>
      <div className={css.deliverableRowFields}>
        <FieldSelect
          className={css.deliverableField}
          id={`${idPrefix}_type`}
          name={`${name}.type`}
          label={intl.formatMessage({ id: 'PostProjectForm.deliverableTypeLabel' })}
          validate={required(intl.formatMessage({ id: 'PostProjectForm.deliverableTypeRequired' }))}
        >
          <option disabled value="">
            {intl.formatMessage({ id: 'PostProjectForm.deliverableTypePlaceholder' })}
          </option>
          {DELIVERABLE_TYPE_OPTIONS.map(option => (
            <option key={option.key} value={option.key}>
              {intl.formatMessage({ id: option.labelId })}
            </option>
          ))}
        </FieldSelect>

        <FieldSelect
          className={css.deliverableField}
          id={`${idPrefix}_platform`}
          name={`${name}.platform`}
          label={intl.formatMessage({ id: 'PostProjectForm.deliverablePlatformLabel' })}
          validate={required(
            intl.formatMessage({ id: 'PostProjectForm.deliverablePlatformRequired' })
          )}
        >
          <option disabled value="">
            {intl.formatMessage({ id: 'PostProjectForm.deliverablePlatformPlaceholder' })}
          </option>
          {platformOptions.map(option => (
            <option key={`${option.option}`} value={`${option.option}`}>
              {option.label}
            </option>
          ))}
        </FieldSelect>

        <FieldTextInput
          className={css.deliverableFieldNarrow}
          type="number"
          min="1"
          id={`${idPrefix}_quantity`}
          name={`${name}.quantity`}
          label={intl.formatMessage({ id: 'PostProjectForm.deliverableQuantityLabel' })}
          placeholder={intl.formatMessage({ id: 'PostProjectForm.deliverableQuantityPlaceholder' })}
          validate={composeValidators(
            required(intl.formatMessage({ id: 'PostProjectForm.deliverableQuantityRequired' })),
            numberAtLeast(intl.formatMessage({ id: 'PostProjectForm.deliverableQuantityTooLow' }), 1)
          )}
        />
      </div>

      <FieldTextInput
        className={css.deliverableField}
        type="text"
        id={`${idPrefix}_spec`}
        name={`${name}.spec`}
        label={intl.formatMessage({ id: 'PostProjectForm.deliverableSpecLabel' })}
        placeholder={intl.formatMessage({ id: 'PostProjectForm.deliverableSpecPlaceholder' })}
        validate={required(intl.formatMessage({ id: 'PostProjectForm.deliverableSpecRequired' }))}
      />

      {showRemove ? (
        <InlineTextButton className={css.deliverableRemove} type="button" onClick={onRemove}>
          <IconDelete rootClassName={css.deliverableRemoveIcon} />
          <FormattedMessage id="PostProjectForm.removeDeliverable" />
        </InlineTextButton>
      ) : null}
    </div>
  );
};

/**
 * The list of deliverables a brand wants from a project. Each row becomes
 * one entry of the `deliverables` array stored on the project listing (see
 * IMPLEMENTATION-PLAN.md 2.4) — this is what the client-side apply flow
 * (F2.3) copies from, and what the collaboration workspace (F3.1) tracks
 * status/versions against per item. A stable `id` (`d1`, `d2`, …) is
 * generated here from the same monotonic counter used for React keys, so ids
 * never collide even after a row in the middle is removed.
 */
const DeliverablesField = ({ formId, listingFieldsConfig, intl, initialCount }) => {
  const [[counter, keys], setKeys] = useState(() => initKeys(initialCount));
  const platformOptions = getEnumOptions(listingFieldsConfig, 'platforms');
  // The Platform select below is a required field with no fallback value —
  // if Console has no enum options configured for `platforms` (or hasn't
  // scoped that field to the `project` listing type), every row renders an
  // empty, unusable dropdown and the form can never be submitted. Surface
  // that as an explicit message instead of a silent dead end.
  const noPlatformsConfigured = platformOptions.length === 0;

  return (
    <FieldArray
      name="deliverables"
      validate={nonEmptyArray(intl.formatMessage({ id: 'PostProjectForm.deliverablesRequired' }))}
    >
      {({ fields }) => (
        <div className={css.field}>
          <label className={css.deliverablesLabel}>
            <FormattedMessage id="PostProjectForm.deliverablesLabel" />
          </label>

          {noPlatformsConfigured ? (
            <div className={css.deliverablesEmptyError}>
              <FormattedMessage id="PostProjectForm.noPlatformsConfigured" />
            </div>
          ) : null}

          {fields.length === 0 ? (
            <div className={css.deliverablesEmptyError}>
              <FormattedMessage id="PostProjectForm.deliverablesRequired" />
            </div>
          ) : null}

          {fields.map((name, index) => (
            <DeliverableRow
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

          {fields.length < MAX_DELIVERABLES ? (
            <InlineTextButton
              className={css.addDeliverable}
              type="button"
              onClick={() => {
                fields.push({ id: `d${counter}`, type: '', platform: '', spec: '', quantity: '' });
                addKey(setKeys);
              }}
            >
              <FormattedMessage id="PostProjectForm.addDeliverable" />
            </InlineTextButton>
          ) : null}
        </div>
      )}
    </FieldArray>
  );
};

const DEFAULT_INITIAL_VALUES = {
  deliverables: [{ id: 'd0', type: '', platform: '', spec: '', quantity: '' }],
};

/**
 * @component
 * @param {Object} props
 * @param {Array<Object>} props.listingFieldsConfig - config.listing.listingFields
 * @param {string} props.marketplaceCurrency - config.currency
 * @param {boolean} [props.inProgress]
 * @param {propTypes.error} [props.apiSubmitError]
 * @param {Object} [props.initialValues] - e.g. from RosterPage's "Collab
 *   again" (F8.1), via postProjectPrefill.js. Defaults to one empty
 *   deliverable row.
 * @returns {JSX.Element}
 */
const PostProjectForm = props => {
  const { initialValues: initialValuesProp, ...rest } = props;
  const initialValues = initialValuesProp || DEFAULT_INITIAL_VALUES;
  const initialDeliverablesCount = initialValues.deliverables?.length || 1;

  return (
    <FinalForm
      {...rest}
      mutators={{ ...arrayMutators }}
      initialValues={initialValues}
      render={fieldRenderProps => {
        const {
          rootClassName,
          className,
          formId = 'PostProjectForm',
          handleSubmit,
          inProgress = false,
          apiSubmitError,
          listingFieldsConfig,
          marketplaceCurrency,
          invalid,
        } = fieldRenderProps;

        const intl = useIntl();
        const classes = classNames(rootClassName || css.form, className);
        const submitDisabled = invalid || inProgress;

        const titleRequiredMessage = intl.formatMessage({ id: 'PostProjectForm.titleRequired' });
        const priceRequiredMessage = intl.formatMessage({ id: 'PostProjectForm.priceRequired' });
        const minPrice = marketplaceCurrency
          ? formatMoney(intl, new Money(MIN_PRICE_SUBUNITS, marketplaceCurrency))
          : '';
        const priceTooLowMessage = intl.formatMessage(
          { id: 'PostProjectForm.priceTooLow' },
          { minPrice }
        );
        const dueDateRequiredMessage = intl.formatMessage({
          id: 'PostProjectForm.contentDueDateRequired',
        });
        const dueDatePastMessage = intl.formatMessage({
          id: 'PostProjectForm.contentDueDatePastError',
        });

        return (
          <Form className={classes} onSubmit={handleSubmit}>
            <FieldTextInput
              className={css.field}
              type="text"
              id={formId ? `${formId}.title` : 'title'}
              name="title"
              label={intl.formatMessage({ id: 'PostProjectForm.titleLabel' })}
              placeholder={intl.formatMessage({ id: 'PostProjectForm.titlePlaceholder' })}
              maxLength={TITLE_MAX_LENGTH}
              validate={required(titleRequiredMessage)}
              autoFocus
            />
            <FieldTextInput
              className={css.field}
              type="textarea"
              id={formId ? `${formId}.description` : 'description'}
              name="description"
              label={intl.formatMessage({ id: 'PostProjectForm.descriptionLabel' })}
              placeholder={intl.formatMessage({ id: 'PostProjectForm.descriptionPlaceholder' })}
              validate={required(intl.formatMessage({ id: 'PostProjectForm.descriptionRequired' }))}
            />

            <DeliverablesField
              formId={formId}
              listingFieldsConfig={listingFieldsConfig}
              intl={intl}
              initialCount={initialDeliverablesCount}
            />

            <div className={css.field}>
              <SingleCustomField
                fieldKey="usageRights"
                listingFieldsConfig={listingFieldsConfig}
                formId={formId}
                intl={intl}
              />
            </div>

            <FieldTextInput
              className={css.field}
              type="date"
              id={formId ? `${formId}.contentDueDate` : 'contentDueDate'}
              name="contentDueDate"
              label={intl.formatMessage({ id: 'PostProjectForm.contentDueDateLabel' })}
              min={todayISO()}
              validate={composeValidators(
                required(dueDateRequiredMessage),
                notInThePast(dueDatePastMessage)
              )}
            />

            <FieldCurrencyInput
              className={css.field}
              id={formId ? `${formId}.price` : 'price'}
              name="price"
              label={intl.formatMessage({ id: 'PostProjectForm.priceLabel' })}
              placeholder={intl.formatMessage({ id: 'PostProjectForm.pricePlaceholder' })}
              currencyConfig={appSettings.getCurrencyFormatting(marketplaceCurrency)}
              validate={composeValidators(
                required(priceRequiredMessage),
                moneySubUnitAmountAtLeast(priceTooLowMessage, MIN_PRICE_SUBUNITS)
              )}
            />
            <FieldCheckbox
              className={css.field}
              id={formId ? `${formId}.priceNegotiable` : 'priceNegotiable'}
              name="priceNegotiable"
              value="priceNegotiable"
              label={intl.formatMessage({ id: 'PostProjectForm.priceNegotiableLabel' })}
            />

            <div className={css.field}>
              <SingleCustomField
                fieldKey="requiresProduct"
                listingFieldsConfig={listingFieldsConfig}
                formId={formId}
                intl={intl}
              />
            </div>

            <div className={css.field}>
              <SingleCustomField
                fieldKey="contentNiche"
                listingFieldsConfig={listingFieldsConfig}
                formId={formId}
                intl={intl}
              />
            </div>
            <div className={css.field}>
              <SingleCustomField
                fieldKey="platforms"
                listingFieldsConfig={listingFieldsConfig}
                formId={formId}
                intl={intl}
              />
            </div>

            <div className={css.submitRow}>
              <ErrorMessage error={apiSubmitError} />
              <PrimaryButton type="submit" inProgress={inProgress} disabled={submitDisabled}>
                <FormattedMessage id="PostProjectForm.submitButtonText" />
              </PrimaryButton>
            </div>
          </Form>
        );
      }}
    />
  );
};

export default PostProjectForm;
