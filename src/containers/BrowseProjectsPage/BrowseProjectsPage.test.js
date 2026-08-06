import React from 'react';
import '@testing-library/jest-dom';

import {
  renderWithProviders as render,
  testingLibrary,
  getHostedConfiguration,
} from '../../util/testHelpers';
import { types as sdkTypes } from '../../util/sdkLoader';

import { BrowseProjectsPageComponent } from './BrowseProjectsPage';

const { screen, userEvent } = testingLibrary;
const { Money, UUID } = sdkTypes;

const noop = () => null;

// renderWithProviders' `config` option is the raw hosted-assets shape (see
// mergeListingConfig/mergeUserConfig in configHelpers.js), not the merged
// app-config shape — listing fields and user types live at the top level
// (`listingFields.listingFields`, `userTypes.userTypes`), not nested under
// `listing`/`user`. Without a 'creator' userType entry here,
// getCurrentUserTypeRoles falls back to { customer: true, provider: true },
// which makes isBrandUserType true for everyone and silently redirects the
// whole page away (see userHelpers.js) — so this is required, not decorative.
const config = {
  ...getHostedConfiguration(),
  userTypes: {
    userTypes: [
      { id: 'creator', label: 'Creator', roles: { customer: false, provider: true } },
      { id: 'brand', label: 'Brand', roles: { customer: true, provider: false } },
    ],
  },
  listingFields: {
    listingFields: [
      {
        key: 'contentNiche',
        scope: 'public',
        schemaType: 'multi-enum',
        enumOptions: [{ option: 'beauty', label: 'Beauty' }, { option: 'fashion', label: 'Fashion' }],
        filterConfig: { showFilter: true },
        saveConfig: {},
      },
      {
        key: 'platforms',
        scope: 'public',
        schemaType: 'multi-enum',
        enumOptions: [{ option: 'tiktok', label: 'TikTok' }, { option: 'ig-reels', label: 'IG Reels' }],
        filterConfig: { showFilter: true },
        saveConfig: {},
      },
    ],
  },
};

const author = {
  id: new UUID('brand-1'),
  attributes: { profile: { displayName: 'Acme Skincare' } },
};

const makeProject = ({
  id,
  title,
  amountInSubunits,
  contentNiche = ['beauty'],
  platforms = ['tiktok'],
  requiresProduct = false,
  deliverables = [{ id: 'd1' }],
}) => ({
  id: new UUID(id),
  attributes: {
    title,
    description: 'A great project',
    price: new Money(amountInSubunits, 'USD'),
    createdAt: new Date('2026-08-01T00:00:00Z'),
    publicData: {
      contentNiche,
      platforms,
      requiresProduct,
      contentDueDate: '2026-09-15',
      deliverables,
    },
  },
  author,
});

const cheapProject = makeProject({ id: 'p-cheap', title: 'Cheap project', amountInSubunits: 20000 });
const pricyProject = makeProject({
  id: 'p-pricy',
  title: 'Pricy project',
  amountInSubunits: 90000,
  requiresProduct: true,
  deliverables: [{ id: 'd1' }, { id: 'd2' }],
});

const baseProps = {
  scrollingDisabled: false,
  projects: [cheapProject, pricyProject],
  fetchInProgress: false,
  fetchError: null,
  invitedProjectIds: [],
  onFetchProjects: noop,
  onFetchInvitations: noop,
  onFetchOwnCreatorProfile: noop,
  currentUser: {
    id: new UUID('creator-1'),
    attributes: {
      profile: { displayName: 'Creator', publicData: { userType: 'creator' } },
      state: 'active',
    },
  },
  creatorProfile: {},
  onLogout: noop,
};

const renderPage = (props = {}) =>
  render(<BrowseProjectsPageComponent {...baseProps} {...props} />, { config });

// renderWithProviders echoes translation ids back as their own message (see
// testMessages in testHelpers.js), so any text that goes through
// FormattedMessage/intl.formatMessage is asserted by its id, not its English
// copy — same convention as PostProjectForm.test.js. Real, non-translated
// values (listing title, formatMoney output) are asserted by their actual text.
describe('BrowseProjectsPage', () => {
  it('shows price, deliverable count, and the requires-product badge on cards', () => {
    renderPage();

    expect(screen.getByText('$200.00')).toBeInTheDocument();
    expect(screen.getByText('$900.00')).toBeInTheDocument();
    // Both cards have >=1 deliverable, so this renders twice; the
    // requires-product badge only on the pricy (requiresProduct: true) card.
    expect(screen.getAllByText('BrowseProjectsPage.deliverableCount')).toHaveLength(2);
    expect(screen.getByText('BrowseProjectsPage.requiresProductBadge')).toBeInTheDocument();
  });

  it('shows the invited badge only for invited projects, sorted first', () => {
    renderPage({ invitedProjectIds: [pricyProject.id.uuid] });

    // Every card renders the badge so each one reserves the same badge-height
    // slot (visibility toggles, not presence), so the assertion is about which
    // badge is exposed rather than how many exist. parentElement because
    // getAllByText returns FormattedMessage's own inner span; aria-hidden and
    // the class live on the badge span wrapping it.
    const badges = screen
      .getAllByText('BrowseProjectsPage.invitedBadge')
      .map(el => el.parentElement);
    expect(badges).toHaveLength(2);
    const shown = badges.filter(el => el.getAttribute('aria-hidden') === 'false');
    expect(shown).toHaveLength(1);

    const titles = screen.getAllByRole('heading', { level: 3 }).map(el => el.textContent);
    expect(titles).toEqual(['Pricy project', 'Cheap project']);
  });

  it('filters by price range through the advanced filters panel', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('BrowseProjectsPage.filtersButton'));
    await user.type(screen.getByLabelText('BrowseProjectsPage.priceMinLabel'), '500');

    expect(screen.queryByText('Cheap project')).not.toBeInTheDocument();
    expect(screen.getByText('Pricy project')).toBeInTheDocument();
  });

  it('filters by "ships a product" through the advanced filters panel', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('BrowseProjectsPage.filtersButton'));
    await user.selectOptions(
      screen.getByDisplayValue('BrowseProjectsPage.requiresProductAny'),
      'yes'
    );

    expect(screen.queryByText('Cheap project')).not.toBeInTheDocument();
    expect(screen.getByText('Pricy project')).toBeInTheDocument();
  });

  it('does not throw a hooks-order error when currentUser goes null after logout', () => {
    // Regression test: nicheOptions/platformOptions used to be computed with
    // useMemo AFTER the isBrandUserType early-return redirect. A null
    // currentUser makes isBrandUserType fall back to "brand" (see
    // userHelpers.js's permissive default), which flips the redirect on and
    // used to skip those two hooks — "Rendered fewer hooks than expected".
    const { rerender } = renderPage();

    expect(() =>
      rerender(<BrowseProjectsPageComponent {...baseProps} currentUser={null} />)
    ).not.toThrow();
  });

  it('the invited tab shows only invited projects', async () => {
    const user = userEvent.setup();
    renderPage({ invitedProjectIds: [cheapProject.id.uuid] });

    await user.click(screen.getByText('BrowseProjectsPage.filterInvited'));

    expect(screen.getByText('Cheap project')).toBeInTheDocument();
    expect(screen.queryByText('Pricy project')).not.toBeInTheDocument();
  });
});
