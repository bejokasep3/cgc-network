import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../util/testHelpers';

import DeliverableList from './DeliverableList';

const { screen, userEvent } = testingLibrary;

const deliverable = (overrides = {}) => ({
  id: 'd0',
  type: 'video',
  platform: 'tiktok',
  spec: '30s vertical video',
  quantity: 1,
  versions: [],
  ...overrides,
});

const noop = () => null;

describe('DeliverableList', () => {
  it('renders nothing when there are no deliverables', () => {
    const { container } = render(
      <DeliverableList
        deliverables={[]}
        canManage={false}
        onAddVersion={noop}
        onSubmitForReview={noop}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "not started" for a deliverable with no versions and no draft', () => {
    render(
      <DeliverableList
        deliverables={[deliverable()]}
        canManage={false}
        onAddVersion={noop}
        onSubmitForReview={noop}
      />
    );
    expect(screen.getByText('DeliverableList.status.pending')).toBeInTheDocument();
  });

  it('shows "ready to submit" for a deliverable with a staged draft', () => {
    render(
      <DeliverableList
        deliverables={[deliverable()]}
        canManage
        drafts={{ d0: { contentLinks: 'https://example.com/v1', submissionNote: '' } }}
        onAddVersion={noop}
        onSubmitForReview={noop}
      />
    );
    expect(screen.getByText('DeliverableList.status.readyToSubmit')).toBeInTheDocument();
  });

  it('shows "submitted" and an openable version history once a version exists', async () => {
    const user = userEvent.setup();
    render(
      <DeliverableList
        deliverables={[
          deliverable({
            versions: [{ contentLinks: 'https://example.com/v1', submissionNote: 'first cut' }],
          }),
        ]}
        canManage={false}
        onAddVersion={noop}
        onSubmitForReview={noop}
      />
    );

    expect(screen.getByText('DeliverableList.status.submitted')).toBeInTheDocument();
    expect(screen.queryByText('first cut')).not.toBeInTheDocument();

    await user.click(screen.getByText(/DeliverableList.versionHistoryToggle/));
    expect(screen.getByText('first cut')).toBeInTheDocument();
  });

  it('flags a deliverable targeted by the latest revision request', () => {
    render(
      <DeliverableList
        deliverables={[deliverable({ versions: [{ contentLinks: 'https://example.com/v1' }] })]}
        canManage
        targetDeliverableIds={['d0']}
        onAddVersion={noop}
        onSubmitForReview={noop}
      />
    );
    expect(screen.getByText('DeliverableList.status.revisionRequested')).toBeInTheDocument();
  });

  it('only shows "add version" and "submit for review" when canManage is true', () => {
    const { rerender } = render(
      <DeliverableList
        deliverables={[deliverable()]}
        canManage={false}
        onAddVersion={noop}
        onSubmitForReview={noop}
      />
    );
    expect(screen.queryByText('DeliverableList.addVersion')).not.toBeInTheDocument();
    expect(screen.queryByText('DeliverableList.submitForReview')).not.toBeInTheDocument();

    rerender(
      <DeliverableList
        deliverables={[deliverable()]}
        canManage
        onAddVersion={noop}
        onSubmitForReview={noop}
      />
    );
    expect(screen.getByText('DeliverableList.addVersion')).toBeInTheDocument();
    expect(screen.getByText('DeliverableList.submitForReview')).toBeInTheDocument();
  });

  it('calls onAddVersion with the deliverable id', async () => {
    const user = userEvent.setup();
    const onAddVersion = jest.fn();
    render(
      <DeliverableList
        deliverables={[deliverable()]}
        canManage
        onAddVersion={onAddVersion}
        onSubmitForReview={noop}
      />
    );

    await user.click(screen.getByText('DeliverableList.addVersion'));
    expect(onAddVersion).toHaveBeenCalledWith('d0');
  });

  it('disables "submit for review" until every deliverable has a version or draft', () => {
    render(
      <DeliverableList
        deliverables={[deliverable({ id: 'd0' }), deliverable({ id: 'd1' })]}
        canManage
        drafts={{ d0: { contentLinks: 'https://example.com/v1', submissionNote: '' } }}
        onAddVersion={noop}
        onSubmitForReview={noop}
      />
    );
    expect(screen.getByText('DeliverableList.submitForReview').closest('button')).toBeDisabled();
    expect(screen.getByText('DeliverableList.submitHint')).toBeInTheDocument();
  });

  it('enables "submit for review" once every deliverable has a version or draft', async () => {
    const user = userEvent.setup();
    const onSubmitForReview = jest.fn();
    render(
      <DeliverableList
        deliverables={[
          deliverable({ id: 'd0', versions: [{ contentLinks: 'https://example.com/v1' }] }),
          deliverable({ id: 'd1' }),
        ]}
        canManage
        drafts={{ d1: { contentLinks: 'https://example.com/v2', submissionNote: '' } }}
        onAddVersion={noop}
        onSubmitForReview={onSubmitForReview}
      />
    );

    const button = screen.getByText('DeliverableList.submitForReview');
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(onSubmitForReview).toHaveBeenCalled();
  });
});
