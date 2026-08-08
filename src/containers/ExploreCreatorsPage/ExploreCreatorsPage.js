import React, { useEffect, useMemo, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { toggleSavedCreator } from '../../ducks/brandRoster.duck';
import { logout } from '../../ducks/auth.duck';
import { parse } from '../../util/urlHelpers';
import { isUserAuthorized } from '../../util/userHelpers';
import { isFieldForListingType } from '../../util/fieldHelpers';
import { fetchCreatorsThunk } from './ExploreCreatorsPage.duck';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  IconSpinner,
  IconClose,
  AspectRatioWrapper,
  ResponsiveImage,
  NamedLink,
  NamedRedirect,
} from '../../components';

import DashboardTopbar from './DashboardTopbar/DashboardTopbar';
import BrandSetupBanner from '../BrandOnboardingPage/BrandSetupBanner';

import css from './ExploreCreatorsPage.module.css';

// Filter tabs mirroring Billo's "Explore creators" composition. Only
// "discover" (everyone) and "favorites" (the brand's saved creators) can
// actually filter anything with the data available today — the rest need
// data this app doesn't model yet (signup date, hire history, ad
// performance, industry ranking), so they're shown but disabled rather than
// faked.
const FILTER_TABS = [
  { id: 'discover', labelId: 'ExploreCreatorsPage.filterDiscover', enabled: true },
  { id: 'new', labelId: 'ExploreCreatorsPage.filterNew', enabled: false },
  { id: 'previous-hires', labelId: 'ExploreCreatorsPage.filterPreviousHires', enabled: false },
  { id: 'favorites', labelId: 'ExploreCreatorsPage.filterFavorites', enabled: true },
  { id: 'ad-performers', labelId: 'ExploreCreatorsPage.filterAdPerformers', enabled: false },
  { id: 'industry-top', labelId: 'ExploreCreatorsPage.filterIndustryTop', enabled: false },
];

const CREATOR_PROFILE_LISTING_TYPE = 'creator-profile';

const DEFAULT_ADVANCED_FILTERS = {
  niches: [],
  platforms: [],
};

const hasActiveAdvancedFilters = filters =>
  filters.niches.length > 0 || filters.platforms.length > 0;

const toggleInArray = (array, value) =>
  array.includes(value) ? array.filter(v => v !== value) : [...array, value];

// Client-side only, same as BrowseProjectsPage's advanced filters — list-creators.js
// already returns each creator's contentNiche/platforms (from their published
// creator-profile listing), so this needs no new server-side query.
const matchesAdvancedFilters = (creator, filters) => {
  if (filters.niches.length > 0) {
    const niche = creator.contentNiche || [];
    if (!filters.niches.some(n => niche.includes(n))) return false;
  }
  if (filters.platforms.length > 0) {
    const platforms = creator.platforms || [];
    if (!filters.platforms.some(p => platforms.includes(p))) return false;
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

const AdvancedFilters = ({ filters, onChange, nicheOptions, platformOptions, intl, onClose }) => (
  <div className={css.sidebar}>
    <div className={css.sidebarHeader}>
      <Heading as="h2" rootClassName={css.sidebarTitle}>
        <FormattedMessage id="ExploreCreatorsPage.filtersButton" />
      </Heading>
      <button
        type="button"
        className={css.sidebarClose}
        onClick={onClose}
        aria-label={intl.formatMessage({ id: 'ExploreCreatorsPage.closeFilters' })}
      >
        <IconClose size="small" />
      </button>
    </div>
    <FilterCheckboxGroup
      labelId="ExploreCreatorsPage.nicheFilterLabel"
      options={nicheOptions}
      selected={filters.niches}
      onToggle={value => onChange({ ...filters, niches: toggleInArray(filters.niches, value) })}
    />
    <FilterCheckboxGroup
      labelId="ExploreCreatorsPage.platformFilterLabel"
      options={platformOptions}
      selected={filters.platforms}
      onToggle={value =>
        onChange({ ...filters, platforms: toggleInArray(filters.platforms, value) })
      }
    />
    {hasActiveAdvancedFilters(filters) ? (
      <button
        type="button"
        className={css.clearFiltersButton}
        onClick={() => onChange(DEFAULT_ADVANCED_FILTERS)}
      >
        <FormattedMessage id="ExploreCreatorsPage.clearFilters" />
      </button>
    ) : null}
  </div>
);

// Users' profile images only ever carry these two variants (see e.g.
// user.duck.js) — unlike listing images, they're never generated with the
// "listing-card" style prefixes, so filtering by that prefix always came up
// empty and silently fell back to the "no image" placeholder.
const PROFILE_IMAGE_VARIANTS = ['square-small', 'square-small2x'];

// Thumbnail placeholder: shows a dummy "play video" overlay instead of the
// profile photo. The area will eventually hold creator intro-video content.
const CreatorThumbnail = () => {
  return (
    <AspectRatioWrapper className={css.thumbnail} width={4} height={5}>
      <div className={css.videoPlaceholder}>
        <div className={css.playButtonCircle}>
          <svg
            className={css.playIcon}
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </AspectRatioWrapper>
  );
};

const CreatorCardReal = ({ creator, isSaved, onToggleSaved, projectId, intl, config }) => {
  const name = creator.displayName || '';
  const initial = name.charAt(0) || '?';
  // F2.5: arriving here with ?project=<id> (from ProjectInvitePage's "browse
  // all creators" link) threads that project through to CreatorProfilePage,
  // which preselects it in the invite form's project picker — same
  // destination either way, just pre-filled instead of a bare "Collab".
  const buttonLabelId = projectId
    ? 'ExploreCreatorsPage.inviteToProjectButton'
    : 'ExploreCreatorsPage.collabButton';

  const avatarVariants = creator.profileImage
    ? Object.keys(creator.profileImage?.attributes?.variants || {}).filter(k =>
        PROFILE_IMAGE_VARIANTS.includes(k)
      )
    : [];

  const listingFields = config?.listing?.listingFields || [];
  
  const getFieldLabel = (key, value) => {
    const field = listingFields.find(f => f.key === key);
    if (!field || !field.enumOptions) return value;
    const option = field.enumOptions.find(o => o.option === value);
    return option ? option.label : value;
  };

  const niches = creator.contentNiche || [];
  const platforms = creator.platforms || [];
  
  const firstNicheLabel = niches.length > 0 ? getFieldLabel('contentNiche', niches[0]) : null;
  const firstPlatformLabel = platforms.length > 0 ? getFieldLabel('platforms', platforms[0]) : null;

  const subtitleParts = [
    ...(firstNicheLabel ? [firstNicheLabel] : []),
    ...(firstPlatformLabel ? [firstPlatformLabel] : []),
  ];
  const subtitleText = subtitleParts.join(' · ');

  return (
    <li className={css.card}>
      <div className={css.cardHeader}>
        {avatarVariants.length > 0 ? (
          <span className={css.avatarImageWrapper}>
            <ResponsiveImage
              rootClassName={css.avatarImage}
              alt={name}
              image={creator.profileImage}
              variants={avatarVariants}
              sizes="44px"
            />
          </span>
        ) : (
          <span className={css.avatar} aria-hidden="true">
            {initial}
          </span>
        )}
        <div className={css.nameCol}>
          <span className={css.name}>{name}</span>
          {subtitleText ? (
            <span className={css.cardSubtitle}>{subtitleText}</span>
          ) : null}
        </div>
        <button
          type="button"
          className={classNames(css.likeButton, { [css.likeButtonActive]: isSaved })}
          aria-label="Save creator"
          aria-pressed={isSaved}
          onClick={() => onToggleSaved(creator.id.uuid)}
        >
          {isSaved ? '♥' : '♡'}
        </button>
      </div>

      <CreatorThumbnail />

      {creator.listingId ? (
        <NamedLink
          className={css.inviteButton}
          name="CreatorProfilePage"
          params={{ id: creator.listingId.uuid }}
          to={projectId ? { search: `project=${projectId}` } : undefined}
        >
          <FormattedMessage id={buttonLabelId} />
        </NamedLink>
      ) : (
        <button
          type="button"
          className={classNames(css.inviteButton, css.inviteButtonDisabled)}
          disabled
          title={intl.formatMessage({ id: 'ExploreCreatorsPage.collabNotReady' })}
        >
          <FormattedMessage id={buttonLabelId} />
        </button>
      )}
    </li>
  );
};

/**
 * Brand's "explore creators" dashboard — the home base a brand lands on after
 * login (see AuthenticationPage.js redirect). Composition mirrors Billo's
 * creator-browsing screen (heading, filter tabs, creator grid), styled with
 * this app's rounded/soft card look from the landing page rather than Billo's
 * sharp-cornered cards.
 *
 * Cards list creator (provider) accounts directly via the Integration API
 * (server/api/list-creators.js) rather than a published listing search — see
 * that file and ExploreCreatorsPage.duck.js for why. Only the display name is
 * shown for now.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled - Whether scrolling is disabled
 * @param {Array<Object>} props.creators
 * @param {boolean} props.fetchInProgress
 * @param {propTypes.error} props.fetchError
 * @param {Function} props.onFetchCreators
 * @param {Array<string>} props.savedCreatorIds
 * @param {Function} props.onToggleSavedCreator
 * @param {propTypes.currentUser} props.currentUser
 * @param {Function} props.onLogout
 * @returns {JSX.Element}
 */
export const ExploreCreatorsPageComponent = props => {
  const intl = useIntl();
  const config = useConfiguration();
  const {
    scrollingDisabled,
    creators,
    fetchInProgress,
    fetchError,
    onFetchCreators,
    savedCreatorIds,
    onToggleSavedCreator,
    currentUser,
    onLogout,
    location,
  } = props;

  // F2.5: ?project=<id> arrives from ProjectInvitePage's "browse all
  // creators" link, making this whole page project-aware for the visit.
  const projectId = parse(location?.search || '')?.project || null;

  const [activeFilter, setActiveFilter] = useState('discover');
  const [advancedFilters, setAdvancedFilters] = useState(DEFAULT_ADVANCED_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    onFetchCreators();
  }, [onFetchCreators]);

  // Must run on every render, before the auth early-return below — otherwise
  // a not-yet-authorized user calls fewer hooks than an authorized one did,
  // and React throws "Rendered fewer hooks than expected" (same reasoning as
  // BrowseProjectsPage's identical comment).
  const listingFieldsConfig = config.listing.listingFields;
  const nicheOptions = useMemo(
    () =>
      (listingFieldsConfig || []).find(
        f => f.key === 'contentNiche' && isFieldForListingType(CREATOR_PROFILE_LISTING_TYPE, f)
      )?.enumOptions || [],
    [listingFieldsConfig]
  );
  const platformOptions = useMemo(
    () =>
      (listingFieldsConfig || []).find(
        f => f.key === 'platforms' && isFieldForListingType(CREATOR_PROFILE_LISTING_TYPE, f)
      )?.enumOptions || [],
    [listingFieldsConfig]
  );

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const title = intl.formatMessage(
    { id: 'ExploreCreatorsPage.schemaTitle' },
    { marketplaceName: config.marketplaceName }
  );

  const visibleCreators = creators
    .filter(creator =>
      activeFilter === 'favorites' ? savedCreatorIds.includes(creator.id.uuid) : true
    )
    .filter(creator => matchesAdvancedFilters(creator, advancedFilters));

  const hasResults = visibleCreators.length > 0;

  const displayName = currentUser?.attributes?.profile?.displayName;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage="ExploreCreatorsPage"
            onLogout={onLogout}
          />
        }
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="ExploreCreatorsPage.heading" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="ExploreCreatorsPage.subtitle" />
          </p>

          <BrandSetupBanner currentUser={currentUser} className={css.setupBanner} />

          {projectId ? (
            <div className={css.projectContextBanner}>
              <FormattedMessage id="ExploreCreatorsPage.projectContextBanner" />
            </div>
          ) : null}

          <div className={css.filterRow}>
            <button
              type="button"
              className={classNames(css.filtersButton, {
                [css.filtersButtonActive]: hasActiveAdvancedFilters(advancedFilters),
              })}
              onClick={() => setFiltersOpen(open => !open)}
              aria-expanded={filtersOpen}
            >
              <FormattedMessage id="ExploreCreatorsPage.filtersButton" />
            </button>
            {FILTER_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                disabled={!tab.enabled}
                title={tab.enabled ? undefined : intl.formatMessage({ id: 'ExploreCreatorsPage.filterComingSoon' })}
                className={classNames(css.filterTab, {
                  [css.filterTabActive]: activeFilter === tab.id,
                  [css.filterTabDisabled]: !tab.enabled,
                })}
                onClick={() => tab.enabled && setActiveFilter(tab.id)}
              >
                <FormattedMessage id={tab.labelId} />
              </button>
            ))}
          </div>

          <div className={css.layout}>
            {filtersOpen ? (
              <AdvancedFilters
                filters={advancedFilters}
                onChange={setAdvancedFilters}
                nicheOptions={nicheOptions}
                platformOptions={platformOptions}
                intl={intl}
                onClose={() => setFiltersOpen(false)}
              />
            ) : null}

            <div className={css.content}>
              {fetchError ? (
                <p className={css.error}>
                  <FormattedMessage id="ExploreCreatorsPage.fetchFailed" />
                </p>
              ) : null}

              {fetchInProgress ? (
                <div className={css.loading}>
                  <IconSpinner />
                </div>
              ) : hasResults ? (
                <ul className={css.grid}>
                  {visibleCreators.map(creator => (
                    <CreatorCardReal
                      key={creator.id.uuid}
                      creator={creator}
                      isSaved={savedCreatorIds.includes(creator.id.uuid)}
                      onToggleSaved={onToggleSavedCreator}
                      projectId={projectId}
                      intl={intl}
                      config={config}
                    />
                  ))}
                </ul>
              ) : (
                <p className={css.noResults}>
                  <FormattedMessage
                    id={
                      activeFilter === 'favorites'
                        ? 'ExploreCreatorsPage.noFavorites'
                        : 'ExploreCreatorsPage.noResults'
                    }
                  />
                </p>
              )}
            </div>
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { creators, fetchInProgress, fetchError } = state.ExploreCreatorsPage;
  const { currentUser } = state.user;
  const savedCreatorIds = currentUser?.attributes?.profile?.privateData?.savedCreatorIds || [];

  return {
    scrollingDisabled: isScrollingDisabled(state),
    creators,
    fetchInProgress,
    fetchError,
    savedCreatorIds,
    currentUser,
  };
};

const mapDispatchToProps = dispatch => ({
  onFetchCreators: () => dispatch(fetchCreatorsThunk()),
  onToggleSavedCreator: creatorId => dispatch(toggleSavedCreator(creatorId)),
  onLogout: () => dispatch(logout()),
});

const ExploreCreatorsPage = compose(connect(mapStateToProps, mapDispatchToProps))(
  ExploreCreatorsPageComponent
);

export default ExploreCreatorsPage;
