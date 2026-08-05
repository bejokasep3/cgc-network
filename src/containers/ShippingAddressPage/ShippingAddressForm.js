import React from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { required } from '../../util/validators';
import getCountryCodes from '../../translations/countryCodes';

import { Form, FieldTextInput, FieldSelect, ErrorMessage, PrimaryButton } from '../../components';

import css from './ShippingAddressPage.module.css';

/**
 * Field names mirror CGC_MODAL_VARIANTS.addShippingAddress in
 * TransactionPage/CGCActionModal/CGCActionModal.js exactly, so the values
 * saved here can later prefill that per-collaboration modal without any key
 * translation.
 *
 * @component
 * @param {Object} props
 * @param {boolean} [props.inProgress]
 * @param {propTypes.error} [props.apiSubmitError]
 * @returns {JSX.Element}
 */
const ShippingAddressForm = props => (
  <FinalForm
    {...props}
    render={fieldRenderProps => {
      const {
        rootClassName,
        className,
        formId = 'ShippingAddressForm',
        handleSubmit,
        inProgress = false,
        invalid,
        apiSubmitError,
      } = fieldRenderProps;
      const intl = useIntl();
      const classes = classNames(rootClassName || css.form, className);
      const submitDisabled = invalid || inProgress;
      const countryCodes = getCountryCodes(intl.locale);

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          <FieldTextInput
            className={css.field}
            type="text"
            id={`${formId}_shippingRecipientName`}
            name="shippingRecipientName"
            label={intl.formatMessage({ id: 'ShippingAddressForm.recipientNameLabel' })}
            placeholder={intl.formatMessage({
              id: 'ShippingAddressForm.recipientNamePlaceholder',
            })}
            validate={required(
              intl.formatMessage({ id: 'ShippingAddressForm.recipientNameRequired' })
            )}
          />

          <FieldTextInput
            className={css.field}
            type="text"
            id={`${formId}_shippingAddressLine1`}
            name="shippingAddressLine1"
            label={intl.formatMessage({ id: 'ShippingAddressForm.addressLine1Label' })}
            placeholder={intl.formatMessage({
              id: 'ShippingAddressForm.addressLine1Placeholder',
            })}
            validate={required(
              intl.formatMessage({ id: 'ShippingAddressForm.addressLine1Required' })
            )}
          />

          <FieldTextInput
            className={css.field}
            type="text"
            id={`${formId}_shippingAddressLine2`}
            name="shippingAddressLine2"
            label={intl.formatMessage({ id: 'ShippingAddressForm.addressLine2Label' })}
            placeholder={intl.formatMessage({
              id: 'ShippingAddressForm.addressLine2Placeholder',
            })}
          />

          <div className={css.fieldRow}>
            <FieldTextInput
              className={css.field}
              type="text"
              id={`${formId}_shippingCity`}
              name="shippingCity"
              label={intl.formatMessage({ id: 'ShippingAddressForm.cityLabel' })}
              placeholder={intl.formatMessage({ id: 'ShippingAddressForm.cityPlaceholder' })}
              validate={required(intl.formatMessage({ id: 'ShippingAddressForm.cityRequired' }))}
            />

            <FieldTextInput
              className={css.field}
              type="text"
              id={`${formId}_shippingPostalCode`}
              name="shippingPostalCode"
              label={intl.formatMessage({ id: 'ShippingAddressForm.postalCodeLabel' })}
              placeholder={intl.formatMessage({
                id: 'ShippingAddressForm.postalCodePlaceholder',
              })}
              validate={required(
                intl.formatMessage({ id: 'ShippingAddressForm.postalCodeRequired' })
              )}
            />
          </div>

          <FieldSelect
            className={css.field}
            id={`${formId}_shippingCountry`}
            name="shippingCountry"
            label={intl.formatMessage({ id: 'ShippingAddressForm.countryLabel' })}
            validate={required(intl.formatMessage({ id: 'ShippingAddressForm.countryRequired' }))}
          >
            <option disabled value="">
              {intl.formatMessage({ id: 'ShippingAddressForm.countryPlaceholder' })}
            </option>
            {countryCodes.map(country => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </FieldSelect>

          {apiSubmitError ? <ErrorMessage error={apiSubmitError} /> : null}

          <PrimaryButton type="submit" inProgress={inProgress} disabled={submitDisabled}>
            <FormattedMessage id="ShippingAddressForm.submit" />
          </PrimaryButton>
        </Form>
      );
    }}
  />
);

export default ShippingAddressForm;
