import React from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { required, validBusinessURL, composeValidators } from '../../util/validators';

import { Form, FieldTextInput, FieldSelect, ErrorMessage, PrimaryButton } from '../../components';

import css from './RequestAccessPage.module.css';

// Local, not Console-configured — this is signup-flow data (§2.7's
// accessRequest shape), not a listing field, so there's nothing in
// config.listing.listingFields to reuse here.
const MONTHLY_VOLUME_OPTIONS = ['1-5', '6-20', '21-50', '50+'];
const BUDGET_RANGE_OPTIONS = ['under-1k', '1k-5k', '5k-20k', '20k-plus'];
const SOURCE_OPTIONS = ['referral', 'search', 'social', 'other'];

/**
 * Brand access-request form (IMPLEMENTATION-PLAN.md F4.1, shape per §2.7).
 * Submitted once, right after signup, while the account sits in
 * Sharetribe's built-in `pending-approval` state — BLUEPRINT B2: this is
 * both the operator's vetting material and prospect data (a brand with zero
 * projected volume isn't worth chasing for a subscription renewal).
 *
 * @component
 * @param {Object} props
 * @param {boolean} [props.inProgress]
 * @param {propTypes.error} [props.apiSubmitError]
 * @returns {JSX.Element}
 */
const RequestAccessForm = props => (
  <FinalForm
    {...props}
    render={fieldRenderProps => {
      const {
        rootClassName,
        className,
        formId = 'RequestAccessForm',
        handleSubmit,
        inProgress = false,
        invalid,
        apiSubmitError,
      } = fieldRenderProps;
      const intl = useIntl();
      const classes = classNames(rootClassName || css.form, className);
      const submitDisabled = invalid || inProgress;

      const optionLabel = (prefix, key) =>
        intl.formatMessage({ id: `RequestAccessForm.${prefix}Option.${key}` });

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          <FieldTextInput
            className={css.field}
            type="text"
            id={`${formId}_company`}
            name="company"
            label={intl.formatMessage({ id: 'RequestAccessForm.companyLabel' })}
            placeholder={intl.formatMessage({ id: 'RequestAccessForm.companyPlaceholder' })}
            validate={required(intl.formatMessage({ id: 'RequestAccessForm.companyRequired' }))}
          />

          <FieldTextInput
            className={css.field}
            type="text"
            id={`${formId}_website`}
            name="website"
            label={intl.formatMessage({ id: 'RequestAccessForm.websiteLabel' })}
            placeholder={intl.formatMessage({ id: 'RequestAccessForm.websitePlaceholder' })}
            validate={composeValidators(
              required(intl.formatMessage({ id: 'RequestAccessForm.websiteRequired' })),
              validBusinessURL(intl.formatMessage({ id: 'RequestAccessForm.websiteInvalid' }))
            )}
          />

          <FieldTextInput
            className={css.field}
            type="text"
            id={`${formId}_category`}
            name="category"
            label={intl.formatMessage({ id: 'RequestAccessForm.categoryLabel' })}
            placeholder={intl.formatMessage({ id: 'RequestAccessForm.categoryPlaceholder' })}
            validate={required(intl.formatMessage({ id: 'RequestAccessForm.categoryRequired' }))}
          />

          <FieldSelect
            className={css.field}
            id={`${formId}_monthlyVolume`}
            name="monthlyVolume"
            label={intl.formatMessage({ id: 'RequestAccessForm.monthlyVolumeLabel' })}
            validate={required(
              intl.formatMessage({ id: 'RequestAccessForm.monthlyVolumeRequired' })
            )}
          >
            <option disabled value="">
              {intl.formatMessage({ id: 'RequestAccessForm.monthlyVolumePlaceholder' })}
            </option>
            {MONTHLY_VOLUME_OPTIONS.map(key => (
              <option key={key} value={key}>
                {optionLabel('monthlyVolume', key)}
              </option>
            ))}
          </FieldSelect>

          <FieldSelect
            className={css.field}
            id={`${formId}_budgetRange`}
            name="budgetRange"
            label={intl.formatMessage({ id: 'RequestAccessForm.budgetRangeLabel' })}
            validate={required(
              intl.formatMessage({ id: 'RequestAccessForm.budgetRangeRequired' })
            )}
          >
            <option disabled value="">
              {intl.formatMessage({ id: 'RequestAccessForm.budgetRangePlaceholder' })}
            </option>
            {BUDGET_RANGE_OPTIONS.map(key => (
              <option key={key} value={key}>
                {optionLabel('budgetRange', key)}
              </option>
            ))}
          </FieldSelect>

          <FieldSelect
            className={css.field}
            id={`${formId}_source`}
            name="source"
            label={intl.formatMessage({ id: 'RequestAccessForm.sourceLabel' })}
            validate={required(intl.formatMessage({ id: 'RequestAccessForm.sourceRequired' }))}
          >
            <option disabled value="">
              {intl.formatMessage({ id: 'RequestAccessForm.sourcePlaceholder' })}
            </option>
            {SOURCE_OPTIONS.map(key => (
              <option key={key} value={key}>
                {optionLabel('source', key)}
              </option>
            ))}
          </FieldSelect>

          {apiSubmitError ? <ErrorMessage error={apiSubmitError} /> : null}

          <PrimaryButton type="submit" inProgress={inProgress} disabled={submitDisabled}>
            <FormattedMessage id="RequestAccessForm.submit" />
          </PrimaryButton>
        </Form>
      );
    }}
  />
);

export default RequestAccessForm;
