import React from 'react';
import { Form as FinalForm } from 'react-final-form';
import arrayMutators from 'final-form-arrays';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { required, composeValidators, moneySubUnitAmountAtLeast } from '../../util/validators';
import { isFieldForListingType } from '../../util/fieldHelpers';

import appSettings from '../../config/settings';
import { formatMoney } from '../../util/currency';
import { types as sdkTypes } from '../../util/sdkLoader';
import {
  Form,
  FieldTextInput,
  FieldCurrencyInput,
  CustomExtendedDataField,
  ErrorMessage,
  PrimaryButton,
} from '../../components';

const { Money } = sdkTypes;
const MIN_PRICE_SUBUNITS = 500;

import css from './CreatorPackagePage.module.css';

const CREATOR_PROFILE_LISTING_TYPE = 'creator-profile';
const TITLE_MAX_LENGTH = 60;

/**
 * The custom fields configured in Console (Build → Listings → Listing
 * fields) for the creator-profile listing type — contentNiche, platforms,
 * usageRights, deliverableCount, turnaroundDays (see util/creatorFields.js).
 * Rendered generically via CustomExtendedDataField, same approach
 * PostProjectForm uses for the project listing type's fields.
 */
const CreatorPackageCustomFields = ({ listingFieldsConfig, formId, intl }) => {
  const fields = listingFieldsConfig.filter(fieldConfig =>
    isFieldForListingType(CREATOR_PROFILE_LISTING_TYPE, fieldConfig)
  );

  return (
    <>
      {fields.map(fieldConfig => (
        <CustomExtendedDataField
          key={fieldConfig.key}
          name={fieldConfig.key}
          fieldConfig={fieldConfig}
          defaultRequiredMessage={intl.formatMessage({
            id: 'CreatorPackageDetailsForm.defaultRequiredMessage',
          })}
          formId={formId}
        />
      ))}
    </>
  );
};

/**
 * @component
 * @param {Object} props
 * @param {Array<Object>} props.listingFieldsConfig - config.listing.listingFields
 * @param {boolean} [props.inProgress]
 * @param {propTypes.error} [props.apiSubmitError]
 * @returns {JSX.Element}
 */
const CreatorPackageDetailsForm = props => (
  <FinalForm
    {...props}
    mutators={{ ...arrayMutators }}
    render={fieldRenderProps => {
      const {
        rootClassName,
        className,
        formId = 'CreatorPackageDetailsForm',
        handleSubmit,
        inProgress = false,
        updated = false,
        saveActionMsg = null,
        apiSubmitError,
        listingFieldsConfig,
        marketplaceCurrency,
        invalid,
        pristine,
      } = fieldRenderProps;

      const intl = useIntl();
      const classes = classNames(rootClassName || css.form, className);
      const submitDisabled = invalid || inProgress;

      const titleRequiredMessage = intl.formatMessage({
        id: 'CreatorPackageDetailsForm.titleRequired',
      });

      const priceRequiredMessage = intl.formatMessage({ id: 'CreatorPackageDetailsForm.priceRequired' });
      const minPrice = marketplaceCurrency
        ? formatMoney(intl, new Money(MIN_PRICE_SUBUNITS, marketplaceCurrency))
        : '';
      const priceTooLowMessage = intl.formatMessage(
        { id: 'CreatorPackageDetailsForm.priceTooLow' },
        { minPrice }
      );

      const submitReady = (updated && pristine) || false;

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          <FieldTextInput
            className={css.field}
            type="text"
            id={formId ? `${formId}.title` : 'title'}
            name="title"
            label={intl.formatMessage({ id: 'CreatorPackageDetailsForm.titleLabel' })}
            placeholder={intl.formatMessage({ id: 'CreatorPackageDetailsForm.titlePlaceholder' })}
            maxLength={TITLE_MAX_LENGTH}
            validate={required(titleRequiredMessage)}
          />
          <FieldTextInput
            className={css.field}
            type="textarea"
            id={formId ? `${formId}.description` : 'description'}
            name="description"
            label={intl.formatMessage({ id: 'CreatorPackageDetailsForm.descriptionLabel' })}
            placeholder={intl.formatMessage({
              id: 'CreatorPackageDetailsForm.descriptionPlaceholder',
            })}
            validate={required(
              intl.formatMessage({ id: 'CreatorPackageDetailsForm.descriptionRequired' })
            )}
          />
          <FieldCurrencyInput
            id={formId ? `${formId}.price` : 'price'}
            name="price"
            className={css.field}
            label={intl.formatMessage({ id: 'CreatorPackageDetailsForm.priceLabel' })}
            placeholder={intl.formatMessage({ id: 'CreatorPackageDetailsForm.pricePlaceholder' })}
            currencyConfig={appSettings.getCurrencyFormatting(marketplaceCurrency)}
            validate={composeValidators(
              required(priceRequiredMessage),
              moneySubUnitAmountAtLeast(priceTooLowMessage, MIN_PRICE_SUBUNITS)
            )}
          />
          <CreatorPackageCustomFields
            listingFieldsConfig={listingFieldsConfig}
            formId={formId}
            intl={intl}
          />
          <div className={css.submitRow}>
            <ErrorMessage error={apiSubmitError} />
            <PrimaryButton
              type="submit"
              inProgress={inProgress}
              disabled={submitDisabled}
              ready={submitReady}
            >
              {saveActionMsg || (
                <FormattedMessage id="CreatorPackageDetailsForm.submitButtonText" />
              )}
            </PrimaryButton>
          </div>
        </Form>
      );
    }}
  />
);

export default CreatorPackageDetailsForm;
