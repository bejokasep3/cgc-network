import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import PostProjectForm from './PostProjectForm';

const { screen, userEvent, waitFor } = testingLibrary;

const noop = () => null;

const listingFieldsConfig = [
  {
    key: 'usageRights',
    schemaType: 'enum',
    enumOptions: [
      { option: 'organic-only', label: 'Organic only' },
      { option: 'paid-ads-6m', label: 'Paid ads (6 months)' },
    ],
    saveConfig: { label: 'Usage rights', isRequired: false },
  },
  {
    key: 'requiresProduct',
    schemaType: 'boolean',
    saveConfig: { label: 'Requires shipping a product', isRequired: false },
  },
  {
    key: 'contentNiche',
    schemaType: 'multi-enum',
    enumOptions: [{ option: 'beauty', label: 'Beauty' }, { option: 'fashion', label: 'Fashion' }],
    saveConfig: { label: 'Content niche', isRequired: false },
  },
  {
    key: 'platforms',
    schemaType: 'multi-enum',
    enumOptions: [{ option: 'tiktok', label: 'TikTok' }, { option: 'ig-reels', label: 'IG Reels' }],
    saveConfig: { label: 'Platforms', isRequired: false },
  },
];

const renderForm = (props = {}) =>
  render(
    <PostProjectForm
      onSubmit={noop}
      listingFieldsConfig={listingFieldsConfig}
      marketplaceCurrency="USD"
      {...props}
    />
  );

describe('PostProjectForm', () => {
  it('renders the core fields in the required order', () => {
    renderForm();

    expect(screen.getByLabelText('PostProjectForm.titleLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('PostProjectForm.descriptionLabel')).toBeInTheDocument();
    expect(screen.getByText('PostProjectForm.deliverablesLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('PostProjectForm.contentDueDateLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('PostProjectForm.priceLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('PostProjectForm.priceNegotiableLabel')).toBeInTheDocument();
  });

  it('renders Console-configured fields at their designated positions', () => {
    renderForm();

    expect(screen.getByLabelText('Usage rights')).toBeInTheDocument();
    expect(screen.getByLabelText('Requires shipping a product')).toBeInTheDocument();
    expect(screen.getByText('Content niche')).toBeInTheDocument();
    expect(screen.getByText('Platforms')).toBeInTheDocument();
  });

  it('warns instead of silently blocking submission when Console has no platform options', () => {
    const platformlessConfig = listingFieldsConfig.filter(f => f.key !== 'platforms');
    renderForm({ listingFieldsConfig: platformlessConfig });

    expect(screen.getByText('PostProjectForm.noPlatformsConfigured')).toBeInTheDocument();
  });

  it('does not warn when platform options are configured', () => {
    renderForm();

    expect(screen.queryByText('PostProjectForm.noPlatformsConfigured')).not.toBeInTheDocument();
  });

  it('starts with exactly one deliverable row, with no remove button', () => {
    renderForm();

    expect(screen.getAllByLabelText('PostProjectForm.deliverableTypeLabel')).toHaveLength(1);
    expect(screen.queryByText('PostProjectForm.removeDeliverable')).not.toBeInTheDocument();
  });

  it('adds a deliverable row, which can then be removed', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText('PostProjectForm.addDeliverable'));

    expect(screen.getAllByLabelText('PostProjectForm.deliverableTypeLabel')).toHaveLength(2);
    const removeButtons = screen.getAllByText('PostProjectForm.removeDeliverable');
    expect(removeButtons).toHaveLength(2);

    await user.click(removeButtons[0]);

    expect(screen.getAllByLabelText('PostProjectForm.deliverableTypeLabel')).toHaveLength(1);
    expect(screen.queryByText('PostProjectForm.removeDeliverable')).not.toBeInTheDocument();
  });

  it('keeps the submit button disabled until the required fields are filled', async () => {
    const user = userEvent.setup();
    renderForm();

    const submitButton = screen.getByRole('button', { name: 'PostProjectForm.submitButtonText' });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText('PostProjectForm.titleLabel'), 'A great project');
    await user.type(
      screen.getByLabelText('PostProjectForm.descriptionLabel'),
      'Please make a great video for us.'
    );
    await user.selectOptions(
      screen.getByLabelText('PostProjectForm.deliverableTypeLabel'),
      'video'
    );
    await user.selectOptions(
      screen.getByLabelText('PostProjectForm.deliverablePlatformLabel'),
      'tiktok'
    );
    await user.type(screen.getByLabelText('PostProjectForm.deliverableSpecLabel'), '30s vertical');
    await user.type(screen.getByLabelText('PostProjectForm.deliverableQuantityLabel'), '2');

    const dueDateInput = screen.getByLabelText('PostProjectForm.contentDueDateLabel');
    await user.type(dueDateInput, '2099-01-01');

    await user.type(screen.getByLabelText('PostProjectForm.priceLabel'), '100');

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });
  });
});
