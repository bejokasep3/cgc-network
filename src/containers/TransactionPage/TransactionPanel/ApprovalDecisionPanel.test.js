import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';

import ApprovalDecisionPanel from './ApprovalDecisionPanel';

const { screen, userEvent } = testingLibrary;

const primaryButtonProps = (overrides = {}) => ({
  inProgress: false,
  error: null,
  onAction: jest.fn(),
  buttonText: 'Approve',
  errorText: '',
  ...overrides,
});

describe('ApprovalDecisionPanel', () => {
  it('renders nothing without primaryButtonProps', () => {
    const { container } = render(
      <ApprovalDecisionPanel onOpenDisputeModal={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows how many of the two revisions have been used', () => {
    render(
      <ApprovalDecisionPanel
        primaryButtonProps={primaryButtonProps()}
        secondaryButtonProps={{ onAction: () => {}, buttonText: 'Request revision' }}
        revisionsUsed={1}
        onOpenDisputeModal={() => {}}
      />
    );
    expect(screen.getByText('ApprovalDecisionPanel.revisionQuota')).toBeInTheDocument();
  });

  it('omits the revision quota line when revisionsUsed is not provided', () => {
    render(
      <ApprovalDecisionPanel
        primaryButtonProps={primaryButtonProps()}
        secondaryButtonProps={{ onAction: () => {}, buttonText: 'Request revision' }}
        onOpenDisputeModal={() => {}}
      />
    );
    expect(screen.queryByText('ApprovalDecisionPanel.revisionQuota')).not.toBeInTheDocument();
  });

  it('requires an inline confirmation before approving (releasing payment)', async () => {
    const user = userEvent.setup();
    const onAction = jest.fn();
    render(
      <ApprovalDecisionPanel
        primaryButtonProps={primaryButtonProps({ onAction })}
        secondaryButtonProps={{ onAction: () => {}, buttonText: 'Request revision' }}
        revisionsUsed={0}
        onOpenDisputeModal={() => {}}
      />
    );

    await user.click(screen.getByText('Approve'));
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByText('ApprovalDecisionPanel.confirmText')).toBeInTheDocument();

    await user.click(screen.getByText('ApprovalDecisionPanel.confirmApprove'));
    expect(onAction).toHaveBeenCalled();
  });

  it('calls onAction for the secondary (request revision) button directly, with no confirmation', async () => {
    const user = userEvent.setup();
    const onRevisionAction = jest.fn();
    render(
      <ApprovalDecisionPanel
        primaryButtonProps={primaryButtonProps()}
        secondaryButtonProps={{ onAction: onRevisionAction, buttonText: 'Request revision' }}
        revisionsUsed={0}
        onOpenDisputeModal={() => {}}
      />
    );

    await user.click(screen.getByText('Request revision'));
    expect(onRevisionAction).toHaveBeenCalled();
  });

  it('shows the exhausted-revisions explanation instead of a revision button on the final round', () => {
    render(
      <ApprovalDecisionPanel
        primaryButtonProps={primaryButtonProps()}
        secondaryButtonProps={undefined}
        revisionsUsed={2}
        onOpenDisputeModal={() => {}}
      />
    );
    expect(screen.getByText('ApprovalDecisionPanel.revisionExhausted')).toBeInTheDocument();
    expect(screen.queryByText('Request revision')).not.toBeInTheDocument();
  });

  it('always offers escalation to the CGC team', async () => {
    const user = userEvent.setup();
    const onOpenDisputeModal = jest.fn();
    render(
      <ApprovalDecisionPanel
        primaryButtonProps={primaryButtonProps()}
        onOpenDisputeModal={onOpenDisputeModal}
      />
    );

    await user.click(screen.getByText('TransactionPanel.cgc-ugc-approval.disputeOrder'));
    expect(onOpenDisputeModal).toHaveBeenCalled();
  });
});
