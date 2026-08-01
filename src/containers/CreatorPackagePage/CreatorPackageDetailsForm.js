import React from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { required } from '../../util/validators';
import { isFieldForListingType } from '../../util/fieldHelpers';

import {
  Form,
  FieldTextInput,
  CustomExtendedDataField,
  ErrorMessage,
  PrimaryButton,
} from '../../components';

import css from './CreatorPackagePage.module.css';

const CREATOR_PROFILE_LISTING_TYPE = 'creator-profile';
const TITLE_MAX_LENGTH = 60;

/**
 * The custom fields configured in Console (Build → Listings → Listing
 * fields) for the creator-profile listing type — contentNiche, platforms,
 * usageRights, deliverableCount, turnaroundDays (see util/creatorFields.js).
 * Rendered generically via CustomExtendedDataField, same approach
 * PostProjectForm uses for the project-brief listing type's fields.
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
    render={fieldRenderProps => {
      const {
        rootClassName,
        className,
        formId = 'CreatorPackageDetailsForm',
        handleSubmit,
        inProgress = false,
        apiSubmitError,
        listingFieldsConfig,
        invalid,
      } = fieldRenderProps;

      const intl = useIntl();
      const classes = classNames(rootClassName || css.form, className);
      const submitDisabled = invalid || inProgress;

      const titleRequiredMessage = intl.formatMessage({
        id: 'CreatorPackageDetailsForm.titleRequired',
      });

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
          <CreatorPackageCustomFields
            listingFieldsConfig={listingFieldsConfig}
            formId={formId}
            intl={intl}
          />
          <div className={css.submitRow}>
            <ErrorMessage error={apiSubmitError} />
            <PrimaryButton type="submit" inProgress={inProgress} disabled={submitDisabled}>
              <FormattedMessage id="CreatorPackageDetailsForm.submitButtonText" />
            </PrimaryButton>
          </div>
        </Form>
      );
    }}
  />
);

export default CreatorPackageDetailsForm;
