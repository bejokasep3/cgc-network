import React, { useEffect, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { toggleSavedCreator } from '../../ducks/brandRoster.duck';
import { logout } from '../../ducks/auth.duck';
import { fetchCreatorsThunk } from './ExploreCreatorsPage.duck';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  IconSpinner,
  AspectRatioWrapper,
  ResponsiveImage,
  NamedLink,
} from '../../components';

import DashboardTopbar from './DashboardTopbar/DashboardTopbar';

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

// Thumbnail shows the creator's real profile photo when they have one, or a
// plain gradient placeholder box (no play icon — this isn't a video preview,
// just reserved space for the photo) when they don't.
const CreatorThumbnail = ({ profileImage, variantPrefix, name }) => {
  const variants = profileImage
    ? Object.keys(profileImage?.attributes?.variants || {}).filter(k => k.startsWith(variantPrefix))
    : [];

  return (
    <AspectRatioWrapper className={css.thumbnail} width={4} height={5}>
      {profileImage ? (
        <ResponsiveImage
          rootClassName={css.thumbnailImage}
          alt={name}
          image={profileImage}
          variants={variants}
          sizes="(max-width: 767px) 100vw, (max-width: 1400px) 33vw, 25vw"
        />
      ) : null}
    </AspectRatioWrapper>
  );
};

const CreatorCardReal = ({ creator, variantPrefix, isSaved, onToggleSaved, intl }) => {
  const name = creator.displayName || '';
  const initial = name.charAt(0) || '?';

  return (
    <li className={css.card}>
      <div className={css.cardHeader}>
        <span className={css.avatar} aria-hidden="true">
          {initial}
        </span>
        <span className={css.name}>{name}</span>
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

      <CreatorThumbnail profileImage={creator.profileImage} variantPrefix={variantPrefix} name={name} />

      {creator.listingId ? (
        <NamedLink
          className={css.inviteButton}
          name="CreatorProfilePage"
          params={{ id: creator.listingId.uuid }}
        >
          <FormattedMessage id="ExploreCreatorsPage.collabButton" />
        </NamedLink>
      ) : (
        <button
          type="button"
          className={classNames(css.inviteButton, css.inviteButtonDisabled)}
          disabled
          title={intl.formatMessage({ id: 'ExploreCreatorsPage.collabNotReady' })}
        >
          <FormattedMessage id="ExploreCreatorsPage.collabButton" />
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
  } = props;

  const [activeFilter, setActiveFilter] = useState('discover');

  useEffect(() => {
    onFetchCreators();
  }, [onFetchCreators]);

  const { variantPrefix = 'listing-card' } = config.layout.listingImage;

  const title = intl.formatMessage(
    { id: 'ExploreCreatorsPage.schemaTitle' },
    { marketplaceName: config.marketplaceName }
  );

  const visibleCreators =
    activeFilter === 'favorites'
      ? creators.filter(creator => savedCreatorIds.includes(creator.id.uuid))
      : creators;

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

          <div className={css.filterRow}>
            <button type="button" className={css.filtersButton}>
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
                  variantPrefix={variantPrefix}
                  isSaved={savedCreatorIds.includes(creator.id.uuid)}
                  onToggleSaved={onToggleSavedCreator}
                  intl={intl}
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
