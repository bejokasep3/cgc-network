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

import css from './PostProjectPage.module.css';

const PROJECT_BRIEF_LISTING_TYPE = 'project-brief';
const TITLE_MAX_LENGTH = 60;

/**
 * The custom fields configured in Console (Build → Listings → Listing
 * fields) for the project-brief listing type — contentNiche, platforms,
 * budgetRange, deadline per CGC-SETUP.md §2c. Rendered generically via
 * CustomExtendedDataField so whatever the client actually configures in
 * Console (labels, options, required-ness) is what shows up here, rather
 * than this form guessing at option values.
 */
const ProjectCustomFields = ({ listingFieldsConfig, formId, intl }) => {
  const fields = listingFieldsConfig.filter(fieldConfig =>
    isFieldForListingType(PROJECT_BRIEF_LISTING_TYPE, fieldConfig)
  );

  return (
    <>
      {fields.map(fieldConfig => (
        <CustomExtendedDataField
          key={fieldConfig.key}
          name={fieldConfig.key}
          fieldConfig={fieldConfig}
          defaultRequiredMessage={intl.formatMessage({
            id: 'PostProjectForm.defaultRequiredMessage',
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
const PostProjectForm = props => (
  <FinalForm
    {...props}
    render={fieldRenderProps => {
      const {
        rootClassName,
        className,
        formId = 'PostProjectForm',
        handleSubmit,
        inProgress = false,
        apiSubmitError,
        listingFieldsConfig,
        invalid,
      } = fieldRenderProps;

      const intl = useIntl();
      const classes = classNames(rootClassName || css.form, className);
      const submitDisabled = invalid || inProgress;

      const titleRequiredMessage = intl.formatMessage({ id: 'PostProjectForm.titleRequired' });

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
          <ProjectCustomFields listingFieldsConfig={listingFieldsConfig} formId={formId} intl={intl} />
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

export default PostProjectForm;
