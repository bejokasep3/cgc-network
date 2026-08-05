import React from 'react';
import '@testing-library/jest-dom';

import { createCurrentUser } from '../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';

import { LandingPageComponent } from './LandingPage';

const { screen } = testingLibrary;

describe('LandingPage', () => {
  it('shows separate entry points for brands and creators (F9.1)', () => {
    render(<LandingPageComponent scrollingDisabled={false} isAuthenticated={false} currentUser={null} />);

    expect(screen.getByText('LandingPage.heroHeadline')).toBeInTheDocument();

    // Logged-out visitors don't have an account yet, so these must point to
    // signup (with the role preselected), not the auth-gated
    // RequestAccessPage/ApplyPage routes, which would just bounce to /login.
    const brandLink = screen.getByText('LandingPage.heroCtaBrand').closest('a');
    expect(brandLink).toHaveAttribute('href', expect.stringContaining('/signup/brand'));

    const creatorLink = screen.getByText('LandingPage.heroCtaCreator').closest('a');
    expect(creatorLink).toHaveAttribute('href', expect.stringContaining('/signup/creator'));
  });

  it('shows a work showcase teaser', () => {
    render(<LandingPageComponent scrollingDisabled={false} isAuthenticated={false} currentUser={null} />);

    expect(screen.getByText('LandingPage.showcaseHeading')).toBeInTheDocument();
    expect(screen.getByText('LandingPage.showcaseItem1Niche')).toBeInTheDocument();
  });

  it('redirects an already-authenticated user to their role home instead of showing the marketing page', () => {
    const currentUser = createCurrentUser('creator-1', {
      profile: { publicData: { userType: 'creator' } },
    });

    render(<LandingPageComponent scrollingDisabled={false} isAuthenticated currentUser={currentUser} />);

    expect(screen.queryByText('LandingPage.heroHeadline')).not.toBeInTheDocument();
  });
});
