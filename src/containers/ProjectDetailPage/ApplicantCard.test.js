import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { types as sdkTypes } from '../../util/sdkLoader';

import ApplicantCard from './ApplicantCard';

const { screen, userEvent, waitFor } = testingLibrary;
const { UUID } = sdkTypes;

const noop = () => null;

const customer = {
  id: new UUID('creator-1'),
  attributes: { profile: { displayName: 'Creator One' } },
};

const buildTx = ({
  id = 'app-1',
  lastTransition = 'transition/apply',
  protectedData = {},
  metadata = {},
  createdAt = '2026-08-01T00:00:00.000Z',
} = {}) => ({
  id: new UUID(id),
  attributes: {
    lastTransition,
    protectedData,
    metadata,
    createdAt,
  },
  customer,
});

const baseProtectedData = {
  creatorListingId: 'creator-listing-1',
  readyByDate: '2026-09-10',
  applicantNote: 'I would love to work on this!',
};

const appliedTx = buildTx({
  protectedData: baseProtectedData,
  metadata: {
    offers: [
      { by: 'customer', amountInSubunits: 45000, transition: 'transition/apply', at: 't1' },
    ],
  },
});

const renderCard = (props = {}) =>
  render(
    <ApplicantCard
      tx={appliedTx}
      listedPriceInSubunits={40000}
      currency="USD"
      marketplaceCurrency="USD"
      isResponding={false}
      respondError={null}
      onAccept={noop}
      onDecline={noop}
      onCounter={noop}
      {...props}
    />
  );

describe('ApplicantCard', () => {
  it('renders the applicant name, price, ready-by date, and note', () => {
    renderCard();

    expect(screen.getByText('Creator One')).toBeInTheDocument();
    expect(screen.getByText('$450.00')).toBeInTheDocument();
    expect(screen.getByText('2026-09-10')).toBeInTheDocument();
    expect(screen.getByText('I would love to work on this!')).toBeInTheDocument();
  });

  it('shows a price-over indicator when the applicant asked for more than the listed price', () => {
    renderCard();

    expect(screen.getByText('ApplicantCard.priceOver')).toBeInTheDocument();
  });

  it('shows "matches your price" when the applicant applied at the listed price', () => {
    const tx = buildTx({
      protectedData: baseProtectedData,
      metadata: {
        offers: [
          { by: 'customer', amountInSubunits: 40000, transition: 'transition/apply', at: 't1' },
        ],
      },
    });
    renderCard({ tx });

    expect(screen.getByText('ApplicantCard.priceMatches')).toBeInTheDocument();
  });

  it('shows Accept, Decline, and the counter link for a fresh application', () => {
    renderCard();

    expect(screen.getByRole('button', { name: 'ApplicantCard.accept' })).toBeInTheDocument();
    expect(screen.getByText('ApplicantCard.decline')).toBeInTheDocument();
    expect(screen.getByText('ApplicantCard.proposeCounter')).toBeInTheDocument();
  });

  it('calls onAccept with the transaction id', async () => {
    const user = userEvent.setup();
    const onAccept = jest.fn();
    renderCard({ onAccept });

    await user.click(screen.getByRole('button', { name: 'ApplicantCard.accept' }));

    expect(onAccept).toHaveBeenCalledWith({ transactionId: appliedTx.id });
  });

  it('calls onDecline with the transaction id', async () => {
    const user = userEvent.setup();
    const onDecline = jest.fn();
    renderCard({ onDecline });

    await user.click(screen.getByText('ApplicantCard.decline'));

    expect(onDecline).toHaveBeenCalledWith({ transactionId: appliedTx.id });
  });

  it('reveals a counter form and submits proposedPriceInSubunits + reason', async () => {
    const user = userEvent.setup();
    const onCounter = jest.fn();
    renderCard({ onCounter });

    await user.click(screen.getByText('ApplicantCard.proposeCounter'));

    expect(screen.getByLabelText('ApplicantCard.counterPriceLabel')).toBeInTheDocument();
    await user.type(screen.getByLabelText('ApplicantCard.counterPriceLabel'), '375');
    await user.type(
      screen.getByLabelText('ApplicantCard.counterReasonLabel'),
      'This is our max budget'
    );
    await user.click(screen.getByRole('button', { name: 'ApplicantCard.sendCounter' }));

    await waitFor(() => expect(onCounter).toHaveBeenCalled());
    expect(onCounter).toHaveBeenCalledWith({
      transactionId: appliedTx.id,
      proposedPriceInSubunits: 37500,
      reason: 'This is our max budget',
    });
  });

  it('does not show Accept/Decline/Counter once countered — only a waiting message', () => {
    const tx = buildTx({
      lastTransition: 'transition/brand-counter',
      protectedData: baseProtectedData,
      metadata: {
        offers: [
          { by: 'customer', amountInSubunits: 45000, transition: 'transition/apply', at: 't1' },
          { by: 'provider', amountInSubunits: 42000, transition: 'transition/brand-counter', at: 't2' },
        ],
      },
    });
    renderCard({ tx });

    expect(screen.queryByRole('button', { name: 'ApplicantCard.accept' })).not.toBeInTheDocument();
    expect(screen.queryByText('ApplicantCard.decline')).not.toBeInTheDocument();
    expect(screen.getByText('ApplicantCard.waitingOnCreator')).toBeInTheDocument();
  });

  it('shows only a status badge for a declined application, with no actions', () => {
    const tx = buildTx({ lastTransition: 'transition/brand-decline', protectedData: baseProtectedData });
    renderCard({ tx });

    expect(screen.getByText('ApplicantCard.status.declined')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ApplicantCard.accept' })).not.toBeInTheDocument();
    expect(screen.queryByText('ApplicantCard.waitingOnCreator')).not.toBeInTheDocument();
  });

  it('shows a "proceed to payment" link for an accepted application not yet paid', () => {
    const tx = buildTx({ lastTransition: 'transition/brand-accept', protectedData: baseProtectedData });
    renderCard({ tx, projectId: 'project-1' });

    const link = screen.getByText('ApplicantCard.proceedToPayment');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', expect.stringContaining('app-1'));
    expect(screen.queryByText('ApplicantCard.paid')).not.toBeInTheDocument();
  });

  it('shows a "paid" message instead of a payment link once linked to a collaboration', () => {
    const tx = buildTx({
      lastTransition: 'transition/brand-accept',
      protectedData: { ...baseProtectedData, collaborationTxId: 'collab-1' },
    });
    renderCard({ tx, projectId: 'project-1' });

    expect(screen.getByText('ApplicantCard.paid')).toBeInTheDocument();
    expect(screen.queryByText('ApplicantCard.proceedToPayment')).not.toBeInTheDocument();
  });
});
