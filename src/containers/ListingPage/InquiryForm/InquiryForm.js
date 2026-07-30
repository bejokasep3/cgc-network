import React from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import * as validators from '../../../util/validators';
import { propTypes } from '../../../util/types';

import {
  ErrorMessage,
  FieldSelect,
  FieldTextInput,
  Form,
  Heading,
  IconInquiry,
  PrimaryButton,
} from '../../../components';

import css from './InquiryForm.module.css';

/**
 * The InquiryForm component.
 * NOTE: this InquiryForm is only for booking & purchase processes
 * The default-inquiry process is handled differently
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {string} [props.rootClassName] - Custom class that overrides the default class for the root element
 * @param {string} [props.submitButtonWrapperClassName] - Custom class to be passed for the submit button wrapper
 * @param {boolean} [props.inProgress] - Whether the inquiry is in progress
 * @param {string} props.listingTitle - The listing title
 * @param {string} props.authorDisplayName - The author display name
 * @param {propTypes.error} props.sendInquiryError - The send inquiry error
 * @param {boolean} [props.isInviteFlow] - CGC only: true when contacting a creator-profile
 *   listing, so the brand can attach one of its own project-brief listings to the inquiry
 *   (CGC-FRONTEND-PLAN.md §3.3) instead of sending a bare message.
 * @param {Array<{id: string, title: string}>} [props.briefOptions] - The brand's own open
 *   project-brief listings, offered as the "attach a brief" choices.
 * @returns {JSX.Element} inquiry form component
 */
const InquiryForm = props => (
  <FinalForm
    {...props}
    render={fieldRenderProps => {
      const {
        rootClassName,
        className,
        submitButtonWrapperClassName,
        formId,
        handleSubmit,
        inProgress = false,
        listingTitle,
        authorDisplayName,
        sendInquiryError,
        isInviteFlow = false,
        briefOptions = [],
      } = fieldRenderProps;

      const intl = useIntl();
      const messageLabel = intl.formatMessage(
        {
          id: 'InquiryForm.messageLabel',
        },
        { authorDisplayName }
      );
      const messagePlaceholder = intl.formatMessage(
        {
          id: 'InquiryForm.messagePlaceholder',
        },
        { authorDisplayName }
      );
      const messageRequiredMessage = intl.formatMessage({
        id: 'InquiryForm.messageRequired',
      });
      const messageRequired = validators.requiredAndNonEmptyString(messageRequiredMessage);

      const classes = classNames(rootClassName || css.root, className);
      const submitInProgress = inProgress;
      const submitDisabled = submitInProgress;

      const headingId = isInviteFlow ? 'InquiryForm.inviteHeading' : 'InquiryForm.heading';
      const hasBriefOptions = isInviteFlow && briefOptions.length > 0;

      return (
        <Form className={classes} onSubmit={handleSubmit} enforcePagePreloadFor="OrderDetailsPage">
          <IconInquiry className={css.icon} />
          <Heading as="h2" rootClassName={css.heading}>
            <FormattedMessage id={headingId} values={{ listingTitle, authorDisplayName }} />
          </Heading>
          {hasBriefOptions ? (
            <FieldSelect
              className={css.field}
              name="inviteBriefId"
              id={formId ? `${formId}.inviteBriefId` : 'inviteBriefId'}
              label={intl.formatMessage({ id: 'InquiryForm.briefLabel' })}
            >
              <option value="">{intl.formatMessage({ id: 'InquiryForm.briefNoneOption' })}</option>
              {briefOptions.map(brief => (
                <option key={brief.id} value={brief.id}>
                  {brief.title}
                </option>
              ))}
            </FieldSelect>
          ) : null}
          <FieldTextInput
            className={css.field}
            type="textarea"
            name="message"
            id={formId ? `${formId}.message` : 'message'}
            label={messageLabel}
            placeholder={messagePlaceholder}
            validate={messageRequired}
          />
          <div className={submitButtonWrapperClassName}>
            <ErrorMessage error={sendInquiryError} />
            <PrimaryButton type="submit" inProgress={submitInProgress} disabled={submitDisabled}>
              <FormattedMessage id="InquiryForm.submitButtonText" />
            </PrimaryButton>
          </div>
        </Form>
      );
    }}
  />
);

export default InquiryForm;
