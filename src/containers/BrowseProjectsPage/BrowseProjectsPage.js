import React, { useEffect, useMemo, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { fetchOwnCreatorProfileThunk } from '../../ducks/creatorProfile.duck';
import { isBrandUserType, isUserAuthorized } from '../../util/userHelpers';
import { isFieldForListingType } from '../../util/fieldHelpers';
import { getProjectFieldLabels } from '../../util/creatorFields';
import { formatDateIntoPartials } from '../../util/dates';
import { formatMoney, convertUnitToSubUnit, unitDivisor } from '../../util/currency';
import { fetchProjectsThunk, fetchInvitationsThunk } from './BrowseProjectsPage.duck';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  IconSpinner,
  IconClose,
  Avatar,
  NamedLink,
  NamedRedirect,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import CreatorSetupBanner from '../CreatorOnboardingPage/CreatorSetupBanner';

import css from './BrowseProjectsPage.module.css';

const PROJECT_LISTING_TYPE = 'project';

// How many niche tags to show before collapsing the rest into "+N". Capped
// low (rather than CreatorCard.js's 3) because chipRow is now a strict
// single fixed-height line (see .chipRow) — tags beyond what fits on one
// line are clipped, so this stays conservative to avoid clipping in the
// common case.
const MAX_VISIBLE_NICHE_TAGS = 2;

// Filter tabs mirroring ExploreCreatorsPage's composition on the brand side.
// "all" always works; "my-niche"/"my-platforms" need the creator's own
// package listing to filter against (see fetchOwnCreatorProfileThunk) and
// are disabled with a tooltip until that exists. "invited" needs the
// invitation query below (F2.5's transition/inquire). "top-brands" needs
// data this app doesn't model yet (brand reputation), so it stays disabled
// rather than faked.
const FILTER_TABS = [
  { id: 'all', labelId: 'BrowseProjectsPage.filterAll', enabled: true },
  { id: 'my-niche', labelId: 'BrowseProjectsPage.filterMyNiche', enabled: true, needsProfile: true },
  {
    id: 'my-platforms',
    labelId: 'BrowseProjectsPage.filterMyPlatforms',
    enabled: true,
    needsProfile: true,
  },
  { id: 'top-brands', labelId: 'BrowseProjectsPage.filterTopBrands', enabled: false },
  { id: 'invited', labelId: 'BrowseProjectsPage.filterInvited', enabled: true },
];

const DEFAULT_ADVANCED_FILTERS = {
  niches: [],
  platforms: [],
  minPrice: '',
  maxPrice: '',
  requiresProduct: 'any',
};

const hasActiveAdvancedFilters = filters =>
  filters.niches.length > 0 ||
  filters.platforms.length > 0 ||
  !!filters.minPrice ||
  !!filters.maxPrice ||
  filters.requiresProduct !== 'any';

const toggleInArray = (array, value) =>
  array.includes(value) ? array.filter(v => v !== value) : [...array, value];

// Advanced filters (niche/platforms/price range/requires-product) are
// applied client-side against the already-fetched project list, the same
// way the "my niche"/"my platforms" tabs already work — F0.2's search index
// only covers contentNiche/platforms/usageRights, and price/requiresProduct
// aren't indexed for `pub_` server-side queries, so there is no server-side
// equivalent to fall back to yet.
const matchesAdvancedFilters = (project, filters, currency) => {
  const publicData = project.attributes.publicData || {};
  const price = project.attributes.price;

  if (filters.niches.length > 0) {
    const niche = publicData.contentNiche || [];
    if (!filters.niches.some(n => niche.includes(n))) return false;
  }
  if (filters.platforms.length > 0) {
    const platforms = publicData.platforms || [];
    if (!filters.platforms.some(p => platforms.includes(p))) return false;
  }
  if (filters.requiresProduct !== 'any') {
    const wantsTrue = filters.requiresProduct === 'yes';
    if (!!publicData.requiresProduct !== wantsTrue) return false;
  }
  if (filters.minPrice) {
    if (!price) return false;
    const minSubunits = convertUnitToSubUnit(filters.minPrice, unitDivisor(currency));
    if (price.amount < minSubunits) return false;
  }
  if (filters.maxPrice) {
    if (!price) return false;
    const maxSubunits = convertUnitToSubUnit(filters.maxPrice, unitDivisor(currency));
    if (price.amount > maxSubunits) return false;
  }
  return true;
};

const FilterCheckboxGroup = ({ labelId, options, selected, onToggle }) =>
  options.length > 0 ? (
    <div className={css.filterGroup}>
      <span className={css.filterGroupLabel}>
        <FormattedMessage id={labelId} />
      </span>
      <div className={css.filterCheckboxRow}>
        {options.map(option => (
          <label key={`${option.option}`} className={css.filterCheckboxLabel}>
            <input
              type="checkbox"
              checked={selected.includes(`${option.option}`)}
              onChange={() => onToggle(`${option.option}`)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  ) : null;

const AdvancedFilters = ({
  filters,
  onChange,
  nicheOptions,
  platformOptions,
  currency,
  intl,
  onClose,
}) => {
  const currencySymbolPlaceholder = currency || '';

  return (
    <div className={css.sidebar}>
      <div className={css.sidebarHeader}>
        <Heading as="h2" rootClassName={css.sidebarTitle}>
          <FormattedMessage id="BrowseProjectsPage.filtersButton" />
        </Heading>
        <button
          type="button"
          className={css.sidebarClose}
          onClick={onClose}
          aria-label={intl.formatMessage({ id: 'BrowseProjectsPage.closeFilters' })}
        >
          <IconClose size="small" />
        </button>
      </div>
      <FilterCheckboxGroup
        labelId="BrowseProjectsPage.nicheFilterLabel"
        options={nicheOptions}
        selected={filters.niches}
        onToggle={value => onChange({ ...filters, niches: toggleInArray(filters.niches, value) })}
      />
      <FilterCheckboxGroup
        labelId="BrowseProjectsPage.platformFilterLabel"
        options={platformOptions}
        selected={filters.platforms}
        onToggle={value =>
          onChange({ ...filters, platforms: toggleInArray(filters.platforms, value) })
        }
      />

      <div className={css.filterGroup}>
        <span className={css.filterGroupLabel}>
          <FormattedMessage id="BrowseProjectsPage.priceFilterLabel" />
        </span>
        <div className={css.priceRangeRow}>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            className={css.priceInput}
            placeholder={intl.formatMessage(
              { id: 'BrowseProjectsPage.priceMinPlaceholder' },
              { currency: currencySymbolPlaceholder }
            )}
            value={filters.minPrice}
            onChange={e => onChange({ ...filters, minPrice: e.target.value })}
            aria-label={intl.formatMessage({ id: 'BrowseProjectsPage.priceMinLabel' })}
          />
          <span className={css.priceRangeSeparator}>–</span>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            className={css.priceInput}
            placeholder={intl.formatMessage(
              { id: 'BrowseProjectsPage.priceMaxPlaceholder' },
              { currency: currencySymbolPlaceholder }
            )}
            value={filters.maxPrice}
            onChange={e => onChange({ ...filters, maxPrice: e.target.value })}
            aria-label={intl.formatMessage({ id: 'BrowseProjectsPage.priceMaxLabel' })}
          />
        </div>
      </div>

      <div className={css.filterGroup}>
        <span className={css.filterGroupLabel}>
          <FormattedMessage id="BrowseProjectsPage.requiresProductFilterLabel" />
        </span>
        <select
          className={css.filterSelect}
          value={filters.requiresProduct}
          onChange={e => onChange({ ...filters, requiresProduct: e.target.value })}
        >
          <option value="any">
            {intl.formatMessage({ id: 'BrowseProjectsPage.requiresProductAny' })}
          </option>
          <option value="yes">
            {intl.formatMessage({ id: 'BrowseProjectsPage.requiresProductYes' })}
          </option>
          <option value="no">
            {intl.formatMessage({ id: 'BrowseProjectsPage.requiresProductNo' })}
          </option>
        </select>
      </div>

      {hasActiveAdvancedFilters(filters) ? (
        <button
          type="button"
          className={css.clearFiltersButton}
          onClick={() => onChange(DEFAULT_ADVANCED_FILTERS)}
        >
          <FormattedMessage id="BrowseProjectsPage.clearFilters" />
        </button>
      ) : null}
    </div>
  );
};

const ProjectCard = ({ project, listingFieldsConfig, isInvited, intl }) => {
  const { title, description, publicData, createdAt, price } = project.attributes;
  const { nicheLabels, platformLabels, requiresProduct, contentDueDate, deliverableCount } =
    getProjectFieldLabels(publicData, listingFieldsConfig);
  const author = project.author;
  const brandName = author?.attributes?.profile?.displayName;
  const postedOn = createdAt ? formatDateIntoPartials(createdAt, intl).date : null;
  const priceLabel = price ? formatMoney(intl, price) : null;

  // Cap niche tags so a project with many of them doesn't wrap into a tall
  // column of pills — the rest collapse into one "+N" chip instead. Platforms
  // are listed as plain text (below), not pills, for the same reason.
  const visibleNicheTags = nicheLabels.slice(0, MAX_VISIBLE_NICHE_TAGS);
  const hiddenNicheTagCount = nicheLabels.length - visibleNicheTags.length;

  return (
    <li className={classNames(css.card, { [css.cardInvited]: isInvited })}>
      {/* Always rendered (visibility, not presence, toggles) so every card
          reserves the same badge-height slot — otherwise a non-invited
          card's avatar row sits higher than an invited one's. */}
      <span
        className={classNames(css.invitedBadge, { [css.invitedBadgeHidden]: !isInvited })}
        aria-hidden={!isInvited}
      >
        <FormattedMessage id="BrowseProjectsPage.invitedBadge" />
      </span>

      <div className={css.cardHeader}>
        <Avatar user={author} className={css.avatar} disableProfileLink />
        <span className={css.brandName}>{brandName}</span>
      </div>

      <h3 className={css.projectTitle}>{title}</h3>
      {/* Always rendered with a reserved 2-line height, same reasoning as
          the badge above — a missing description shouldn't pull the chips/
          meta rows below it upward. */}
      <p className={css.description}>{description || ' '}</p>

      {/* Always rendered, even with nothing to show — a fixed-height slot so
          the meta row (price/deadline/etc.) below starts at the same Y in
          every card of the grid, instead of jumping up for projects that
          skip niche tags or requiresProduct. */}
      <div className={css.chipRow}>
        {visibleNicheTags.map(label => (
          <span key={label} className={css.chip}>
            {label}
          </span>
        ))}
        {hiddenNicheTagCount > 0 ? (
          <span className={css.chip}>
            <FormattedMessage id="BrowseProjectsPage.moreTags" values={{ count: hiddenNicheTagCount }} />
          </span>
        ) : null}
        {requiresProduct ? (
          <span className={classNames(css.chip, css.chipProduct)}>
            <FormattedMessage id="BrowseProjectsPage.requiresProductBadge" />
          </span>
        ) : null}
      </div>

      {/* Same reasoning as chipRow above — always rendered so the meta row
          doesn't drift up for projects with no platforms listed. */}
      <p className={css.platformsLine}>{platformLabels.length > 0 ? platformLabels.join(' · ') : ' '}</p>

      <div className={css.metaRow}>
        {priceLabel ? <span className={css.priceBadge}>{priceLabel}</span> : null}
        {contentDueDate ? (
          <span className={css.metaItem}>
            <FormattedMessage id="BrowseProjectsPage.deadlineLabel" values={{ deadline: contentDueDate }} />
          </span>
        ) : null}
        {deliverableCount > 0 ? (
          <span className={css.metaItem}>
            <FormattedMessage
              id="BrowseProjectsPage.deliverableCount"
              values={{ count: deliverableCount }}
            />
          </span>
        ) : null}
        {postedOn ? (
          <span className={css.metaItem}>
            <FormattedMessage id="BrowseProjectsPage.postedOn" values={{ date: postedOn }} />
          </span>
        ) : null}
      </div>

      <NamedLink className={css.viewButton} name="ProjectDetailPage" params={{ id: project.id.uuid }}>
        <FormattedMessage id="BrowseProjectsPage.viewProject" />
      </NamedLink>
    </li>
  );
};

/**
 * Creator's "browse projects" dashboard — the home base a creator lands on
 * after login (see AuthenticationPage.js redirect / getRoleHomeRouteName).
 * Composition mirrors ExploreCreatorsPage on the brand side (heading, filter
 * tabs, card grid), just listing project listings posted by brands
 * instead of creator accounts.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled
 * @param {Array<Object>} props.projects
 * @param {boolean} props.fetchInProgress
 * @param {propTypes.error} props.fetchError
 * @param {Array<string>} props.invitedProjectIds
 * @param {Function} props.onFetchProjects
 * @param {Function} props.onFetchInvitations
 * @param {propTypes.currentUser} props.currentUser
 * @param {Object} props.creatorProfile - state.creatorProfile
 * @param {Function} props.onFetchOwnCreatorProfile
 * @param {Function} props.onLogout
 * @returns {JSX.Element}
 */
export const BrowseProjectsPageComponent = props => {
  const intl = useIntl();
  const config = useConfiguration();
  const {
    scrollingDisabled,
    projects,
    fetchInProgress,
    fetchError,
    invitedProjectIds,
    onFetchProjects,
    onFetchInvitations,
    currentUser,
    creatorProfile,
    onFetchOwnCreatorProfile,
    onLogout,
  } = props;

  const [activeFilter, setActiveFilter] = useState('all');
  const [advancedFilters, setAdvancedFilters] = useState(DEFAULT_ADVANCED_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    onFetchProjects();
    onFetchOwnCreatorProfile();
    onFetchInvitations();
  }, [onFetchProjects, onFetchOwnCreatorProfile, onFetchInvitations]);

  // These must run on every render, before the brand-redirect early return
  // below — otherwise a logged-out user (currentUser === null, which
  // isBrandUserType treats as "brand" via its permissive fallback) calls
  // fewer hooks than a signed-in creator did, and React throws "Rendered
  // fewer hooks than expected".
  const listingFieldsConfig = config.listing.listingFields;
  const nicheOptions = useMemo(
    () =>
      (listingFieldsConfig || []).find(
        f => f.key === 'contentNiche' && isFieldForListingType(PROJECT_LISTING_TYPE, f)
      )?.enumOptions || [],
    [listingFieldsConfig]
  );
  const platformOptions = useMemo(
    () =>
      (listingFieldsConfig || []).find(
        f => f.key === 'platforms' && isFieldForListingType(PROJECT_LISTING_TYPE, f)
      )?.enumOptions || [],
    [listingFieldsConfig]
  );

  if (isBrandUserType(config, currentUser)) {
    return <NamedRedirect name="ExploreCreatorsPage" />;
  }
  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const title = intl.formatMessage(
    { id: 'BrowseProjectsPage.schemaTitle' },
    { marketplaceName: config.marketplaceName }
  );

  const displayName = currentUser?.attributes?.profile?.displayName;
  const ownProfileListing = creatorProfile?.ownProfileListing;
  const ownPublicData = ownProfileListing?.attributes?.publicData || {};

  const matchesOwnValues = (projectValues = [], ownValues = []) =>
    projectValues.some(v => ownValues.includes(v));

  const visibleProjects = projects
    .filter(project => {
      const publicData = project.attributes.publicData || {};
      if (activeFilter === 'my-niche') {
        return matchesOwnValues(publicData.contentNiche, ownPublicData.contentNiche);
      }
      if (activeFilter === 'my-platforms') {
        return matchesOwnValues(publicData.platforms, ownPublicData.platforms);
      }
      if (activeFilter === 'invited') {
        return invitedProjectIds.includes(project.id.uuid);
      }
      return true;
    })
    .filter(project => matchesAdvancedFilters(project, advancedFilters, config.currency))
    // Invitations always sort first, regardless of the active tab/filters
    // (BLUEPRINT.md — a direct invitation is the strongest signal a creator
    // has of a project worth their time). Array.prototype.sort is stable in
    // modern JS engines, so ties keep their original (newest-first) order.
    .sort((a, b) => {
      const aInvited = invitedProjectIds.includes(a.id.uuid) ? 1 : 0;
      const bInvited = invitedProjectIds.includes(b.id.uuid) ? 1 : 0;
      return bInvited - aInvited;
    });

  const hasResults = visibleProjects.length > 0;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage="BrowseProjectsPage"
            role="creator"
            onLogout={onLogout}
          />
        }
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="BrowseProjectsPage.heading" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="BrowseProjectsPage.subtitle" />
          </p>

          <CreatorSetupBanner
            currentUser={currentUser}
            ownProfileListing={ownProfileListing}
            className={css.setupBanner}
          />

          <div className={css.filterRow}>
            <button
              type="button"
              className={classNames(css.filtersButton, {
                [css.filtersButtonActive]: hasActiveAdvancedFilters(advancedFilters),
              })}
              onClick={() => setFiltersOpen(open => !open)}
              aria-expanded={filtersOpen}
            >
              <FormattedMessage id="BrowseProjectsPage.filtersButton" />
            </button>
            {FILTER_TABS.map(tab => {
              const disabled = !tab.enabled || (tab.needsProfile && !ownProfileListing);
              const tooltipId = !tab.enabled
                ? 'BrowseProjectsPage.filterComingSoon'
                : tab.needsProfile && !ownProfileListing
                ? 'BrowseProjectsPage.filterNeedsProfile'
                : null;
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={disabled}
                  title={tooltipId ? intl.formatMessage({ id: tooltipId }) : undefined}
                  className={classNames(css.filterTab, {
                    [css.filterTabActive]: activeFilter === tab.id,
                    [css.filterTabDisabled]: disabled,
                  })}
                  onClick={() => !disabled && setActiveFilter(tab.id)}
                >
                  <FormattedMessage id={tab.labelId} />
                  {tab.id === 'invited' && invitedProjectIds.length > 0 ? (
                    <span className={css.filterTabCount}>{invitedProjectIds.length}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className={css.layout}>
            {filtersOpen ? (
              <AdvancedFilters
                filters={advancedFilters}
                onChange={setAdvancedFilters}
                nicheOptions={nicheOptions}
                platformOptions={platformOptions}
                currency={config.currency}
                intl={intl}
                onClose={() => setFiltersOpen(false)}
              />
            ) : null}

            <div className={css.content}>
              {fetchError ? (
                <p className={css.error}>
                  <FormattedMessage id="BrowseProjectsPage.fetchFailed" />
                </p>
              ) : null}

              {fetchInProgress ? (
                <div className={css.loading}>
                  <IconSpinner />
                </div>
              ) : hasResults ? (
                <ul className={css.grid}>
                  {visibleProjects.map(project => (
                    <ProjectCard
                      key={project.id.uuid}
                      project={project}
                      listingFieldsConfig={listingFieldsConfig}
                      isInvited={invitedProjectIds.includes(project.id.uuid)}
                      intl={intl}
                    />
                  ))}
                </ul>
              ) : (
                (() => {
                  const isFiltered =
                    activeFilter !== 'all' || hasActiveAdvancedFilters(advancedFilters);
                  return (
                    <div className={css.emptyState}>
                      <Heading as="h2" rootClassName={css.emptyStateTitle}>
                        <FormattedMessage
                          id={isFiltered ? 'BrowseProjectsPage.noMatchesTitle' : 'BrowseProjectsPage.noResultsTitle'}
                        />
                      </Heading>
                      <p className={css.emptyStateBody}>
                        <FormattedMessage
                          id={isFiltered ? 'BrowseProjectsPage.noMatchesBody' : 'BrowseProjectsPage.noResultsBody'}
                        />
                      </p>
                      {isFiltered ? (
                        <button
                          type="button"
                          className={css.emptyStateCta}
                          onClick={() => {
                            setActiveFilter('all');
                            setAdvancedFilters(DEFAULT_ADVANCED_FILTERS);
                          }}
                        >
                          <FormattedMessage id="BrowseProjectsPage.resetFilters" />
                        </button>
                      ) : !ownProfileListing ? (
                        <NamedLink name="CreatorPackagePage" className={css.emptyStateCta}>
                          <FormattedMessage id="BrowseProjectsPage.emptyStateCta" />
                        </NamedLink>
                      ) : null}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { projectRefs, fetchInProgress, fetchError, invitedProjectIds } = state.BrowseProjectsPage;
  const { currentUser } = state.user;
  return {
    scrollingDisabled: isScrollingDisabled(state),
    projects: getMarketplaceEntities(state, projectRefs),
    fetchInProgress,
    fetchError,
    invitedProjectIds,
    currentUser,
    creatorProfile: state.creatorProfile,
  };
};

const mapDispatchToProps = dispatch => ({
  onFetchProjects: () => dispatch(fetchProjectsThunk()),
  onFetchInvitations: () => dispatch(fetchInvitationsThunk()),
  onFetchOwnCreatorProfile: () => dispatch(fetchOwnCreatorProfileThunk()),
  onLogout: () => dispatch(logout()),
});

const BrowseProjectsPage = compose(connect(mapStateToProps, mapDispatchToProps))(
  BrowseProjectsPageComponent
);

export default BrowseProjectsPage;
