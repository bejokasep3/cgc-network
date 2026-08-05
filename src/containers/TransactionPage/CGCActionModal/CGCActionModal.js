import React from 'react';
import classNames from 'classnames';
import { Form as FinalForm } from 'react-final-form';
import arrayMutators from 'final-form-arrays';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { propTypes } from '../../../util/types';
import { required, composeValidators, maxLength } from '../../../util/validators';

import {
  FieldTextInput,
  FieldCheckboxGroup,
  Form,
  Modal,
  Button,
  IconEdit,
  IconSynchronize,
  IconSuccess,
  IconLocation,
} from '../../../components';

import css from './CGCActionModal.module.css';

const NOTE_MAX_LENGTH = 2000;

/**
 * The cgc-ugc-approval process moves forward through several actions that need
 * structured input rather than a bare confirmation: the creator supplying their
 * delivery address, the brand adding shipping details, the creator handing over
 * the content, and the brand describing what needs to change. They share this
 * modal, differing only in the fields they ask for. Everything collected here is
 * written to the transaction's protected data by the transition's
 * update-protected-data action, which is also what makes it available to the
 * notification templates.
 */
export const CGC_MODAL_VARIANTS = {
  addShippingAddress: {
    icon: IconLocation,
    fields: [
      { name: 'shippingRecipientName', type: 'text', required: true },
      { name: 'shippingAddressLine1', type: 'text', required: true },
      { name: 'shippingAddressLine2', type: 'text', required: false },
      { name: 'shippingCity', type: 'text', required: true },
      { name: 'shippingPostalCode', type: 'text', required: true },
      { name: 'shippingCountry', type: 'text', required: true },
    ],
  },
  shipping: {
    icon: IconSuccess,
    fields: [
      { name: 'shippingCarrier', type: 'text', required: true },
      { name: 'trackingNumber', type: 'text', required: true },
      { name: 'trackingUrl', type: 'text', required: false },
    ],
  },
  // One deliverable at a time (F3.1) — opened from a single row in
  // DeliverableList, rather than the old one-textarea-for-everything
  // `submitContent` variant. Values are staged locally by TransactionPage.js
  // (see cgcDeliverableDrafts) and only reach the server when the creator
  // hits "submit for review", bundled across every deliverable at once —
  // this modal itself never transitions the transaction.
  addDeliverableVersion: {
    icon: IconEdit,
    fields: [
      { name: 'contentLinks', type: 'textarea', required: true },
      { name: 'submissionNote', type: 'textarea', required: false },
    ],
  },
  requestRevision: {
    icon: IconSynchronize,
    fields: [
      { name: 'targetDeliverableIds', type: 'deliverable-checklist', required: false },
      { name: 'revisionNote', type: 'textarea', required: true },
    ],
  },
};

const CGCActionForm = props => {
  // `error` is a reserved key in react-final-form's own FormState (the
  // form-level submission error, exposed via a getter-only accessor), so it
  // can't be spread through as a plain prop — doing so makes the library's
  // internal Object.assign try to write over that getter and throw. Pull it
  // out and thread it through the closure instead.
  const { error: actionError, ...restProps } = props;

  return (
    <FinalForm
      {...restProps}
      mutators={{ ...arrayMutators }}
      render={fieldRenderProps => {
        const {
          className,
          rootClassName,
          disabled,
          handleSubmit,
          intl,
          formId,
          invalid,
          variant,
          submitted,
          inProgress,
          deliverables = [],
        } = fieldRenderProps;

        const { fields } = CGC_MODAL_VARIANTS[variant];
        const tr = key => intl.formatMessage({ id: `CGCActionModal.${variant}.${key}` });

        const errorMessageMaybe = actionError ? (
          <p className={css.error}>
            <FormattedMessage id="CGCActionModal.submitFailed" />
          </p>
        ) : null;

        const classes = classNames(rootClassName || css.formRoot, className);
        const submitDisabled = invalid || disabled || inProgress;

        return (
          <Form className={classes} onSubmit={handleSubmit}>
            {fields.map(field => {
              if (field.type === 'deliverable-checklist') {
                // Lets the brand point a revision request at specific
                // deliverables (IMPLEMENTATION-PLAN.md F3.1) instead of it
                // always reading as "everything needs work". Raw type/platform
                // values, not Console-configured labels — this modal has no
                // listingFields config in reach, and the creator already sees
                // the fully-labeled row in DeliverableList right behind it.
                if (deliverables.length === 0) {
                  return null;
                }
                return (
                  <FieldCheckboxGroup
                    key={field.name}
                    className={css.field}
                    id={formId ? `${formId}.${field.name}` : field.name}
                    name={field.name}
                    label={tr(`${field.name}Label`)}
                    options={deliverables.map((d, index) => ({
                      key: d.id,
                      label: d.spec || `${d.type} · ${d.platform} (#${index + 1})`,
                    }))}
                  />
                );
              }

              const validators = [
                maxLength(
                  intl.formatMessage(
                    { id: 'CGCActionModal.tooLong' },
                    { maxLength: NOTE_MAX_LENGTH }
                  ),
                  NOTE_MAX_LENGTH
                ),
              ];
              if (field.required) {
                validators.unshift(required(tr(`${field.name}Required`)));
              }

              return (
                <FieldTextInput
                  key={field.name}
                  className={css.field}
                  type={field.type}
                  id={formId ? `${formId}.${field.name}` : field.name}
                  name={field.name}
                  label={tr(`${field.name}Label`)}
                  placeholder={tr(`${field.name}Placeholder`)}
                  validate={composeValidators(...validators)}
                />
              );
            })}
            {errorMessageMaybe}
            <Button
              className={css.submitButton}
              type="submit"
              inProgress={inProgress}
              disabled={submitDisabled}
              ready={submitted}
            >
              {tr('submit')}
            </Button>
          </Form>
        );
      }}
    />
  );
};

/**
 * Modal that collects the data a cgc-ugc-approval transition needs.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className]
 * @param {string} [props.rootClassName]
 * @param {string} props.id
 * @param {'addShippingAddress'|'shipping'|'addDeliverableVersion'|'requestRevision'} props.variant - Which set of fields to ask for
 * @param {boolean} props.isOpen
 * @param {string} [props.focusElementId]
 * @param {Function} props.onCloseModal
 * @param {Function} props.onManageDisableScrolling
 * @param {Function} props.onSubmitAction - Receives the form values
 * @param {boolean} [props.submitted]
 * @param {boolean} [props.inProgress]
 * @param {propTypes.error} [props.error]
 * @param {Array} [props.deliverables] - Only read by the `requestRevision`
 *   variant's deliverable-checklist field
 * @param {Object} [props.initialValues] - Prefills the form, e.g. the
 *   creator's saved shippingAddress (privateData) for `addShippingAddress`
 * @returns {JSX.Element}
 */
const CGCActionModal = props => {
  const intl = useIntl();
  const {
    className,
    rootClassName,
    id,
    variant,
    isOpen = false,
    onCloseModal,
    focusElementId,
    onManageDisableScrolling,
    onSubmitAction,
    submitted = false,
    inProgress = false,
    error,
    deliverables,
    initialValues,
  } = props;

  const variantConfig = CGC_MODAL_VARIANTS[variant];
  if (!variantConfig) {
    return null;
  }

  const Icon = variantConfig.icon;
  const classes = classNames(rootClassName || css.root, className);

  return (
    <Modal
      id={id}
      containerClassName={classes}
      contentClassName={css.modalContent}
      isOpen={isOpen}
      onClose={onCloseModal}
      onManageDisableScrolling={onManageDisableScrolling}
      focusElementId={focusElementId}
      usePortal
      closeButtonMessage={intl.formatMessage({ id: 'CGCActionModal.close' })}
    >
      <Icon className={css.modalIcon} />
      <p className={css.modalTitle}>
        <FormattedMessage id={`CGCActionModal.${variant}.title`} />
      </p>
      <p className={css.modalMessage}>
        <FormattedMessage id={`CGCActionModal.${variant}.description`} />
      </p>
      <CGCActionForm
        formId={`CGCActionModal.${variant}`}
        variant={variant}
        onSubmit={onSubmitAction}
        submitted={submitted}
        inProgress={inProgress}
        error={error}
        deliverables={deliverables}
        initialValues={initialValues}
        intl={intl}
      />
    </Modal>
  );
};

export default CGCActionModal;
