import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { types as sdkTypes } from '../../util/sdkLoader';

import ApplyForm from './ApplyForm';

const { screen, userEvent, waitFor } = testingLibrary;
const { Money } = sdkTypes;

const noop = () => null;

const renderForm = (props = {}) =>
  render(
    <ApplyForm
      onSubmit={noop}
      price={new Money(40000, 'USD')}
      priceNegotiable
      defaultReadyByDate="2026-09-15"
      marketplaceCurrency="USD"
      {...props}
    />
  );

const fillRequiredBaseFields = async user => {
  const dateInput = screen.getByLabelText('ApplyForm.readyByDateLabel');
  await user.clear(dateInput);
  await user.type(dateInput, '2099-01-01');
};

describe('ApplyForm', () => {
  it('renders the base fields, pre-filled with the project due date', () => {
    renderForm();

    expect(screen.getByLabelText('ApplyForm.readyByDateLabel')).toHaveValue('2026-09-15');
    expect(screen.getByLabelText('ApplyForm.applicantNoteLabel')).toBeInTheDocument();
  });

  it('shows the big "apply at listed price" button by default, and the propose-a-different-price link', () => {
    renderForm();

    expect(
      screen.getByRole('button', { name: 'ApplyForm.submitAtPrice' })
    ).toBeInTheDocument();
    expect(screen.getByText('ApplyForm.proposeDifferentPrice')).toBeInTheDocument();
    // Counter fields are collapsed until the link is clicked.
    expect(screen.queryByLabelText('ApplyForm.proposedPriceLabel')).not.toBeInTheDocument();
  });

  it('hides the propose-a-different-price link entirely when the price is locked', () => {
    renderForm({ priceNegotiable: false });

    expect(screen.queryByText('ApplyForm.proposeDifferentPrice')).not.toBeInTheDocument();
  });

  it('reveals the counter-offer fields and switches the submit label when proposing a different price', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText('ApplyForm.proposeDifferentPrice'));

    expect(screen.getByLabelText('ApplyForm.proposedPriceLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('ApplyForm.offerReasonLabel')).toBeInTheDocument();

    await user.type(screen.getByLabelText('ApplyForm.proposedPriceLabel'), '350');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'ApplyForm.submitCounter' })
      ).toBeInTheDocument();
    });
  });

  it('can cancel out of counter mode back to the listed-price button', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText('ApplyForm.proposeDifferentPrice'));
    await user.click(screen.getByText('ApplyForm.cancelCounter'));

    expect(screen.queryByLabelText('ApplyForm.proposedPriceLabel')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'ApplyForm.submitAtPrice' })
    ).toBeInTheDocument();
  });

  it('submits with just the base fields when applying at the listed price', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    renderForm({ onSubmit });

    await fillRequiredBaseFields(user);
    await user.click(screen.getByRole('button', { name: 'ApplyForm.submitAtPrice' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const values = onSubmit.mock.calls[0][0];
    expect(values.readyByDate).toBe('2099-01-01');
    expect(values.proposedPrice).toBeUndefined();
  });

  it('submits with a proposedPrice and offerReason when countering', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    renderForm({ onSubmit });

    await fillRequiredBaseFields(user);
    await user.click(screen.getByText('ApplyForm.proposeDifferentPrice'));
    await user.type(screen.getByLabelText('ApplyForm.proposedPriceLabel'), '350');
    await user.type(screen.getByLabelText('ApplyForm.offerReasonLabel'), 'Extra revision round');

    await user.click(screen.getByRole('button', { name: 'ApplyForm.submitCounter' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const values = onSubmit.mock.calls[0][0];
    expect(values.proposedPrice).toEqual(new Money(35000, 'USD'));
    expect(values.offerReason).toBe('Extra revision round');
  });

  it('keeps the counter submit button disabled until the reason is filled in', async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequiredBaseFields(user);
    await user.click(screen.getByText('ApplyForm.proposeDifferentPrice'));
    await user.type(screen.getByLabelText('ApplyForm.proposedPriceLabel'), '350');

    expect(screen.getByRole('button', { name: 'ApplyForm.submitCounter' })).toBeDisabled();
  });
});
