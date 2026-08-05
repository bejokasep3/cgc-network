import React, { useEffect, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';

import { useConfiguration } from '../../context/configurationContext';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { REVIEW_TYPE_OF_PROVIDER, REVIEW_TYPE_OF_CUSTOMER, propTypes } from '../../util/types';
import {
  NO_ACCESS_PAGE_USER_PENDING_APPROVAL,
  NO_ACCESS_PAGE_VIEW_LISTINGS,
  PROFILE_PAGE_PENDING_APPROVAL_VARIANT,
} from '../../util/urlHelpers';
import {
  isErrorNoViewingPermission,
  isErrorUserPendingApproval,
  isForbiddenError,
  isNotFoundError,
} from '../../util/errors';
import {
  getDetailCustomFieldValue,
  getFieldValue,
  pickCustomFieldProps,
} from '../../util/fieldHelpers';
import {
  getCurrentUserTypeRoles,
  hasPermissionToViewData,
  isUserAuthorized,
  isBrandUserType,
} from '../../util/userHelpers';
import { getCreatorFieldLabels } from '../../util/creatorFields';
import { richText } from '../../util/richText';
import { createSlug } from '../../util/urlHelpers';
import { CGC_UGC_PROCESS_NAME, getProcess } from '../../transactions/transaction';

import { isScrollingDisabled } from '../../ducks/ui.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { toggleSavedCreator } from '../../ducks/brandRoster.duck';
import { logout } from '../../ducks/auth.duck';
import { queryCollaborationHistory } from './ProfilePage.duck';
import {
  Heading,
  H4,
  Page,
  Avatar,
  AvatarLarge,
  NamedLink,
  ListingCard,
  ReviewRating,
  LayoutSingleColumn,
  NamedRedirect,
  CustomExtendedDataSection,
  IconLocation,
  IconVerified,
  IconSpinner,
  Menu,
  MenuLabel,
  MenuContent,
  MenuItem,
  UserDisplayName,
} from '../../components';

import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';
import NotFoundPage from '../../containers/NotFoundPage/NotFoundPage';

import css from './ProfilePage.module.css';

const MIN_LENGTH_FOR_LONG_WORDS = 20;
const MAX_CATEGORY_LABELS = 2;

// "1 year ago"-style relative time matching the reference design's review
// list. Walks divisions from seconds up to years, picking the largest unit
// whose magnitude is still >= 1 (standard Intl.RelativeTimeFormat pattern).
const RELATIVE_TIME_DIVISIONS = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Infinity, unit: 'year' },
];

const relativeTimeFromNow = (date, intl) => {
  let duration = (date.getTime() - Date.now()) / 1000;
  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return intl.formatRelativeTime(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
};

// Decorative sparkle next to the review score, purely visual (aria-hidden).
const ReviewStarBurst = props => (
  <svg
    className={props.className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.937A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
  </svg>
);

// "Roster" (saved creators, CGC-FRONTEND-PLAN.md §4.2) + "copy profile link":
// the header's "..." overflow menu. Roster toggle only offered to a brand
// (viewer has the customer role) looking at a creator's own profile — never
// on the creator's own view of their profile. Copy-link has no such
// condition, so the menu itself always renders.
export const ProfileActionsMenu = props => {
  const {
    showRosterButton,
    isSaved,
    toggleInProgress,
    onToggleSavedCreator,
    onCopyProfileLink,
  } = props;
  const intl = useIntl();

  return (
    <Menu contentPosition="left" useArrow={false}>
      <MenuLabel
        className={css.moreButton}
        isOpenClassName={css.moreButtonIsOpen}
        ariaLabel={intl.formatMessage({ id: 'ProfilePage.moreActions' })}
      >
        <span aria-hidden="true">&#8230;</span>
      </MenuLabel>
      <MenuContent className={css.moreMenuContent}>
        {showRosterButton ? (
          <MenuItem key="roster">
            <button
              type="button"
              className={css.moreMenuItem}
              onClick={onToggleSavedCreator}
              disabled={toggleInProgress}
            >
              {toggleInProgress ? (
                <IconSpinner rootClassName={css.moreMenuItemSpinner} />
              ) : (
                <FormattedMessage
                  id={isSaved ? 'ProfilePage.removeFromRoster' : 'ProfilePage.saveToRoster'}
                />
              )}
            </button>
          </MenuItem>
        ) : null}
        <MenuItem key="copy-link">
          <button type="button" className={css.moreMenuItem} onClick={onCopyProfileLink}>
            <FormattedMessage id="ProfilePage.copyProfileLink" />
          </button>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
};

// Sidebar card sitting next to the main column — in the same slot a booking
// calendar would occupy on a typical provider-profile layout. There's no
// booking flow here, so it surfaces what actually matters for CGC: past
// collaborations with this creator. Renders nothing when there's none to show,
// so the main column takes the full width instead of leaving a blank aside.
export const ProfileSidebar = props => {
  const { show, collaborationHistory, queryCollaborationHistoryInProgress, currentCreatorListing, intl } = props;

  if (!show) {
    return null;
  }

  return (
    <div className={css.sidebar}>
      <CollaborationHistoryMaybe
        show={show}
        history={collaborationHistory}
        historyInProgress={queryCollaborationHistoryInProgress}
        currentCreatorListing={currentCreatorListing}
        intl={intl}
      />
    </div>
  );
};

export const ReviewsErrorMaybe = props => {
  const { queryReviewsError } = props;
  return queryReviewsError ? (
    <p className={css.error}>
      <FormattedMessage id="ProfilePage.loadingReviewsFailed" />
    </p>
  ) : null;
};

// Average + count for a single review type, used for the header card's
// headline score and each tab's score box below.
const averageOf = reviews => {
  if (reviews.length === 0) {
    return { average: null, count: 0 };
  }
  const total = reviews.reduce((sum, r) => sum + (r.attributes?.rating || 0), 0);
  return { average: total / reviews.length, count: reviews.length };
};

export const ReviewScoreBox = props => {
  const { reviews } = props;
  const { average, count } = averageOf(reviews);

  if (average == null) {
    return (
      <div className={css.reviewScoreBox}>
        <span className={css.reviewScoreEmpty}>
          <FormattedMessage id="ProfilePage.noRatingYet" />
        </span>
      </div>
    );
  }

  return (
    <div className={css.reviewScoreBox}>
      <ReviewStarBurst className={classNames(css.reviewScoreDecoration, css.reviewScoreDecorationLeft)} />
      <div className={css.reviewScoreMain}>
        <span className={css.reviewScoreValue}>{average.toFixed(1)}</span>
        <ReviewRating
          rating={Math.round(average)}
          className={css.reviewScoreStars}
          reviewStarClassName={css.reviewScoreStar}
        />
        <span className={css.reviewScoreCount}>
          <FormattedMessage id="ProfilePage.reviewScoreCount" values={{ count }} />
        </span>
      </div>
      <ReviewStarBurst className={classNames(css.reviewScoreDecoration, css.reviewScoreDecorationRight)} />
    </div>
  );
};

// A single review row: avatar, name, single-star rating + relative date, body.
// Purpose-built here (rather than the shared <Reviews> component) since that
// component is also used by CreatorProfilePage and ListingPage's
// SectionReviews with a different, denser layout — changing it would affect
// those pages too.
export const ProfileReviewItem = props => {
  const { review } = props;
  // Real useIntl() rather than a drilled-down `intl` prop: MainContent's
  // `intl` prop can end up shadowed by `...rest` (see ProfilePageComponent),
  // which would silently corrupt formatRelativeTime for callers that pass a
  // custom `intl` prop through ProfilePage (e.g. tests).
  const intl = useIntl();
  const rating = review.attributes.rating;

  return (
    <li className={css.reviewItem}>
      <Avatar className={css.reviewAvatar} user={review.author} />
      <div className={css.reviewBody}>
        <div className={css.reviewHeaderRow}>
          <span className={css.reviewAuthor}>
            <UserDisplayName user={review.author} intl={intl} />
          </span>
          <span className={css.reviewMeta}>
            <ReviewRating
              rating={rating}
              className={css.reviewItemStars}
              reviewStarClassName={css.reviewItemStar}
            />
            <span className={css.reviewRatingValue}>{rating.toFixed(1)}</span>
            <span className={css.reviewDate}>{relativeTimeFromNow(review.attributes.createdAt, intl)}</span>
          </span>
        </div>
        <p className={css.reviewContent}>{review.attributes.content}</p>
      </div>
    </li>
  );
};

export const ProfileReviewList = props => {
  const { reviews } = props;

  // No separate empty-state text here: ReviewScoreBox already shows
  // "No ratings yet" right above when the list is empty, so a second one
  // would just duplicate it.
  if (reviews.length === 0) {
    return null;
  }

  return (
    <ul className={css.reviewList}>
      {reviews.map(r => (
        <ProfileReviewItem key={`review-${r.id.uuid}`} review={r} />
      ))}
    </ul>
  );
};

// A single "Reviews & ratings" block. Most CGC users only ever collect one
// review type — a brand is reviewed as a customer, a creator as a provider —
// so the common case is just a score box + list, no tab switcher at all. The
// switcher only appears for the rare user who holds both roles.
export const ProfileReviews = props => {
  const { reviews = [], queryReviewsError, userTypeRoles, intl } = props;

  const reviewsOfProvider = reviews.filter(r => r.attributes.type === REVIEW_TYPE_OF_PROVIDER);
  const reviewsOfCustomer = reviews.filter(r => r.attributes.type === REVIEW_TYPE_OF_CUSTOMER);

  const availableTypes = [
    userTypeRoles.provider
      ? {
          type: REVIEW_TYPE_OF_PROVIDER,
          list: reviewsOfProvider,
          labelId: 'ProfilePage.reviewsFromMyCustomersTitle',
        }
      : null,
    userTypeRoles.customer
      ? {
          type: REVIEW_TYPE_OF_CUSTOMER,
          list: reviewsOfCustomer,
          labelId: 'ProfilePage.reviewsAsACustomerTitle',
        }
      : null,
  ].filter(Boolean);

  const [activeType, setActiveType] = useState(availableTypes[0]?.type);
  const active = availableTypes.find(t => t.type === activeType) || availableTypes[0];

  if (!active) {
    return null;
  }

  return (
    <div>
      {availableTypes.length > 1 ? (
        <div
          className={css.reviewTypeTabs}
          role="tablist"
          aria-label={intl.formatMessage({ id: 'ProfilePage.screenreader.reviewsNav' })}
        >
          {availableTypes.map(t => (
            <Heading key={t.type} as="h3" rootClassName={css.reviewTypeTabHeading}>
              <button
                type="button"
                role="tab"
                aria-selected={t.type === active.type}
                className={classNames(css.reviewTypeTab, {
                  [css.reviewTypeTabActive]: t.type === active.type,
                })}
                onClick={() => setActiveType(t.type)}
              >
                <FormattedMessage id={t.labelId} values={{ count: t.list.length }} />
              </button>
            </Heading>
          ))}
        </div>
      ) : (
        <Heading as="h3" rootClassName={css.reviewTypeLabel}>
          <FormattedMessage id={active.labelId} values={{ count: active.list.length }} />
        </Heading>
      )}

      <ReviewScoreBox reviews={active.list} />
      <ReviewsErrorMaybe queryReviewsError={queryReviewsError} />
      <ProfileReviewList reviews={active.list} intl={intl} />
    </div>
  );
};

export const CustomUserFields = props => {
  const { publicData, metadata, userFieldConfig, intl } = props;

  const shouldPickUserField = fieldConfig =>
    ['public', 'metadata'].includes(fieldConfig?.scope) &&
    fieldConfig?.showConfig?.displayInProfile !== false;
  const propsForCustomFields =
    pickCustomFieldProps(
      { publicData, metadata },
      userFieldConfig,
      'userType',
      shouldPickUserField
    ) || [];

  const pickUserFields = (filteredConfigs, config) => {
    const { key, schemaType, enumOptions, userTypeConfig = {}, showConfig = {} } = config;
    const { limitToUserTypeIds, userTypeIds } = userTypeConfig;
    const userType = publicData.userType;
    const isTargetUserType = !limitToUserTypeIds || userTypeIds.includes(userType);

    const { label, displayInProfile } = showConfig;
    const publicDataValue = getFieldValue(publicData, key);
    const metadataValue = getFieldValue(metadata, key);
    const value = publicDataValue !== null ? publicDataValue : metadataValue;

    if (displayInProfile && isTargetUserType && value !== null) {
      const detailValue = getDetailCustomFieldValue(
        enumOptions,
        value,
        schemaType,
        key,
        label,
        intl,
        'ProfilePage'
      );

      return detailValue ? filteredConfigs.concat(detailValue) : filteredConfigs;
    }
    return filteredConfigs;
  };
  const sectionDetailsProps = {
    ...props,
    fieldConfigs: userFieldConfig,
    heading: 'ProfilePage.detailsTitle',
    rootClassName: css.userFieldSection,
  };

  return (
    <CustomExtendedDataSection
      sectionDetailsProps={sectionDetailsProps}
      propsForCustomFields={propsForCustomFields}
      idPrefix="profilePage"
      pickExtendedDataFields={pickUserFields}
      rootClassName={css.userFieldSection}
    />
  );
};

const cgcProcess = getProcess(CGC_UGC_PROCESS_NAME);
// Same "successfully finished" set StageTracker collapses into its
// "Approved & paid" stage — the collaborations worth a one-click repeat.
const BOOK_AGAIN_ELIGIBLE_STATES = [
  cgcProcess.states.RECEIVED,
  cgcProcess.states.COMPLETED,
  cgcProcess.states.REVIEWED_BY_CUSTOMER,
  cgcProcess.states.REVIEWED_BY_PROVIDER,
  cgcProcess.states.REVIEWED,
];

// "Collaboration history per creator" + "book again" (CGC-FRONTEND-PLAN.md
// §4.2). Book again links to the creator's current creator-profile listing
// (the transaction's own listing may since be closed or deleted) rather than
// attempting to silently replay stale pricing/availability from the old
// transaction — the brand still goes through the normal booking flow, just
// without having to search for the creator again.
export const CollaborationHistoryMaybe = props => {
  const { show, history, historyInProgress, currentCreatorListing, intl } = props;

  if (!show) {
    return null;
  }

  const bookAgainParamsMaybe = currentCreatorListing
    ? {
        id: currentCreatorListing.id.uuid,
        slug: createSlug(currentCreatorListing.attributes.title || ''),
      }
    : null;

  return (
    <div className={css.sidebarCard}>
      <H4 as="h2" className={css.collaborationHistoryTitle}>
        <FormattedMessage id="ProfilePage.collaborationHistoryTitle" />
      </H4>
      {historyInProgress ? null : history.length === 0 ? (
        <p className={css.collaborationHistoryEmpty}>
          <FormattedMessage id="ProfilePage.collaborationHistoryEmpty" />
        </p>
      ) : (
        <ul className={css.collaborationHistoryList}>
          {history.map(tx => {
            const processState = cgcProcess.getState(tx);
            const canBookAgain = bookAgainParamsMaybe && BOOK_AGAIN_ELIGIBLE_STATES.includes(processState);
            return (
              <li key={tx.id.uuid} className={css.collaborationHistoryItem}>
                <NamedLink
                  className={css.collaborationHistoryLink}
                  name="OrderDetailsPage"
                  params={{ id: tx.id.uuid }}
                >
                  <span className={css.collaborationHistoryListingTitle}>
                    {tx.listing?.attributes?.title}
                  </span>
                  <span className={css.collaborationHistoryDate}>
                    {intl.formatDate(new Date(tx.attributes.lastTransitionedAt))}
                  </span>
                </NamedLink>
                {canBookAgain ? (
                  <NamedLink
                    className={css.bookAgainLink}
                    name="ListingPage"
                    params={bookAgainParamsMaybe}
                  >
                    <FormattedMessage id="ProfilePage.bookAgain" />
                  </NamedLink>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export const ProfileHeaderCard = props => {
  const {
    user,
    displayName,
    userTypeRoles,
    reviews = [],
    location,
    categoryLabels = [],
    categoryExtraCount = 0,
    headerCta,
    actionsMenu,
    intl,
  } = props;

  const reviewsOfProvider = reviews.filter(r => r.attributes.type === REVIEW_TYPE_OF_PROVIDER);
  const reviewsOfCustomer = reviews.filter(r => r.attributes.type === REVIEW_TYPE_OF_CUSTOMER);
  const primaryReviews = userTypeRoles.provider ? reviewsOfProvider : reviewsOfCustomer;
  const { average, count } = averageOf(primaryReviews);

  const roleLabelId = userTypeRoles.provider
    ? 'ProfilePage.roleLabelCreator'
    : 'ProfilePage.roleLabelBrand';

  const isVerified = isUserAuthorized(user);

  return (
    <div className={css.headerCard}>
      <div className={css.avatarWrapper}>
        <AvatarLarge className={css.avatar} user={user} disableProfileLink />
        {isVerified ? (
          <IconVerified
            className={css.verifiedBadge}
            aria-label={intl.formatMessage({ id: 'ProfilePage.verifiedBadgeLabel' })}
          />
        ) : null}
      </div>

      <div className={css.headerInfo}>
        <Heading as="h2" rootClassName={css.heading}>
          {displayName}
        </Heading>
        <span className={css.roleLabel}>
          <FormattedMessage id={roleLabelId} />
        </span>

        {location ? (
          <div className={css.locationRow}>
            <IconLocation className={css.locationIcon} />
            <span className={css.locationText}>{location}</span>
          </div>
        ) : null}

        <div className={css.metaRow}>
          <div className={css.metaColumn}>
            <span className={css.metaLabel}>
              <FormattedMessage id="ProfilePage.metaRatingLabel" />
            </span>
            {average != null ? (
              <a href="#profile-reviews" className={css.metaValueLink}>
                <ReviewRating
                  rating={Math.round(average)}
                  className={css.reviewStars}
                  reviewStarClassName={css.reviewStar}
                />
                <span className={css.metaValue}>
                  {average.toFixed(1)} ·{' '}
                  <FormattedMessage id="ProfilePage.reviewCount" values={{ count }} />
                </span>
              </a>
            ) : (
              <span className={css.metaValue}>
                <FormattedMessage id="ProfilePage.noRatingYet" />
              </span>
            )}
          </div>

          {categoryLabels.length > 0 ? (
            <div className={css.metaColumn}>
              <span className={css.metaLabel}>
                <FormattedMessage id="ProfilePage.metaCategoryLabel" />
              </span>
              <span className={css.metaValue}>
                {categoryLabels.join(', ')}
                {categoryExtraCount > 0 ? ` +${categoryExtraCount}` : ''}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className={css.headerActions}>
        {actionsMenu}
        {headerCta}
      </div>
    </div>
  );
};

export const MainContent = props => {
  const {
    userShowError,
    bio,
    displayName,
    listings,
    queryListingsError,
    reviews = [],
    queryReviewsError,
    publicData,
    metadata,
    userFieldConfig,
    intl,
    hideReviews,
    userTypeRoles,
    isCurrentUser,
  } = props;

  const visibleListings = listings.filter(
    l => !l.attributes.deleted && l.attributes.state === 'published'
  );
  const hasListings = visibleListings.length > 0;
  const bioWithLinks = richText(bio, {
    linkify: true,
    longWordMinLength: MIN_LENGTH_FOR_LONG_WORDS,
    longWordClass: css.longWord,
  });

  if (userShowError || queryListingsError) {
    return (
      <p className={css.error}>
        <FormattedMessage id="ProfilePage.loadingDataFailed" />
      </p>
    );
  }

  const aboutTitleId = userTypeRoles.provider
    ? 'ProfilePage.aboutTitleCreator'
    : 'ProfilePage.aboutTitleBrand';

  const listingsTitleId = userTypeRoles.provider
    ? isCurrentUser
      ? 'ProfilePage.listingsTitleOwnCreator'
      : 'ProfilePage.listingsTitleCreator'
    : isCurrentUser
    ? 'ProfilePage.listingsTitleOwnBrand'
    : 'ProfilePage.listingsTitleBrand';

  return (
    <div>
      <section className={css.section}>
        <Heading as="h2" rootClassName={css.sectionHeading}>
          <FormattedMessage id={aboutTitleId} />
        </Heading>
        {bio ? (
          <p className={css.bio}>{bioWithLinks}</p>
        ) : (
          <p className={css.bioEmpty}>
            <FormattedMessage id="ProfilePage.aboutEmpty" />
          </p>
        )}
      </section>

      {displayName ? (
        <CustomUserFields
          publicData={publicData}
          metadata={metadata}
          userFieldConfig={userFieldConfig}
          intl={intl}
        />
      ) : null}

      {hasListings ? (
        <section className={css.section}>
          <Heading as="h2" rootClassName={css.sectionHeading}>
            <FormattedMessage id={listingsTitleId} values={{ count: visibleListings.length }} />
          </Heading>
          <div className={css.listingsGrid}>
            {visibleListings.map(l => (
              <ListingCard key={l.id.uuid} listing={l} showAuthorInfo={false} />
            ))}
          </div>
        </section>
      ) : null}
      {hideReviews ? null : (
        <section id="profile-reviews" className={css.section}>
          <Heading as="h2" rootClassName={css.sectionHeading}>
            <FormattedMessage id="ProfilePage.reviewsAndRatingsTitle" />
          </Heading>
          <ProfileReviews
            reviews={reviews}
            queryReviewsError={queryReviewsError}
            userTypeRoles={userTypeRoles}
            intl={intl}
          />
        </section>
      )}
    </div>
  );
};

/**
 * ProfilePageComponent
 *
 * @component
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled - Whether the scrolling is disabled
 * @param {propTypes.currentUser} props.currentUser - The current user
 * @param {boolean} props.useCurrentUser - Whether to use the current user
 * @param {propTypes.user|propTypes.currentUser} props.user - The user
 * @param {propTypes.error} props.userShowError - The user show error
 * @param {propTypes.error} props.queryListingsError - The query listings error
 * @param {Array<propTypes.listing|propTypes.ownListing>} props.listings - The listings
 * @param {Array<propTypes.review>} props.reviews - The reviews
 * @param {propTypes.error} props.queryReviewsError - The query reviews error
 * @returns {JSX.Element} ProfilePageComponent
 */
export const ProfilePageComponent = props => {
  const config = useConfiguration();
  const intl = useIntl();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    scrollingDisabled,
    params: pathParams,
    currentUser,
    useCurrentUser,
    userShowError,
    user,
    listings = [],
    toggleInProgress,
    onToggleSavedCreator,
    onQueryCollaborationHistory,
    onLogout,
    reviews = [],
    queryReviewsError,
    collaborationHistory = [],
    queryCollaborationHistoryInProgress,
    ...rest
  } = props;
  const isVariant = pathParams.variant?.length > 0;
  const isPreview = isVariant && pathParams.variant === PROFILE_PAGE_PENDING_APPROVAL_VARIANT;

  const isCurrentUser = currentUser?.id && currentUser?.id?.uuid === pathParams.id;
  const profileUser = useCurrentUser ? currentUser : user;
  const { bio, displayName, publicData, metadata } = profileUser?.attributes?.profile || {};
  const { userFields } = config.user;

  // Roster ("saved creators", CGC-FRONTEND-PLAN.md §4.2) and collaboration
  // history: only offered to a brand (viewer has the customer role) looking
  // at a creator's own profile (someone who has published at least one
  // creator-profile listing), not on the creator's own view of their profile.
  const creatorProfileListing = listings.find(
    l => l?.attributes?.publicData?.listingType === 'creator-profile'
  );
  const isCreatorProfileUser = !!creatorProfileListing;
  const { customer: viewerIsBrand } = getCurrentUserTypeRoles(config, currentUser);
  const showRosterButton = !isCurrentUser && isCreatorProfileUser && viewerIsBrand && !!currentUser?.id;
  const showCollaborationHistory = showRosterButton;
  const savedCreatorIds = currentUser?.attributes?.profile?.privateData?.savedCreatorIds || [];
  const isSavedCreator = !!profileUser?.id?.uuid && savedCreatorIds.includes(profileUser.id.uuid);
  const handleToggleSavedCreator = () => onToggleSavedCreator(profileUser.id.uuid);
  const handleCopyProfileLink = () => {
    if (typeof window !== 'undefined' && window.navigator?.clipboard) {
      window.navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  };
  const creatorId = profileUser?.id?.uuid;

  useEffect(() => {
    if (showCollaborationHistory && creatorId) {
      onQueryCollaborationHistory(creatorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCollaborationHistory, creatorId]);

  // Stripe's onboarding needs a business URL for each seller, but the profile page can be
  // too empty for the provider at the time they are creating their first listing.
  // To remedy the situation, we redirect Stripe's crawler to the landing page of the marketplace.
  // TODO: When there's more content on the profile page, we should consider by-passing this redirection.
  const searchParams = rest?.location?.search;
  const isStorefront = searchParams
    ? new URLSearchParams(searchParams)?.get('mode') === 'storefront'
    : false;
  if (isStorefront) {
    return <NamedRedirect name="LandingPage" />;
  }

  const isPrivateMarketplace = config.accessControl.marketplace.private === true;
  const isUnauthorizedUser = currentUser && !isUserAuthorized(currentUser);
  const isUnauthorizedOnPrivateMarketplace = isPrivateMarketplace && isUnauthorizedUser;
  const hasUserPendingApprovalError = isErrorUserPendingApproval(userShowError);
  const hasNoViewingRightsUser = currentUser && !hasPermissionToViewData(currentUser);
  const hasNoViewingRightsOnPrivateMarketplace = isPrivateMarketplace && hasNoViewingRightsUser;

  const userTypeRoles = getCurrentUserTypeRoles(config, profileUser);

  const isDataLoaded = isPreview
    ? currentUser != null || userShowError != null
    : hasNoViewingRightsOnPrivateMarketplace
    ? currentUser != null || userShowError != null
    : user != null || userShowError != null;

  const schemaTitleVars = { name: displayName, marketplaceName: config.marketplaceName };
  const schemaTitle = intl.formatMessage({ id: 'ProfilePage.schemaTitle' }, schemaTitleVars);

  if (!isDataLoaded) {
    return null;
  } else if (!isPreview && isNotFoundError(userShowError)) {
    return <NotFoundPage staticContext={props.staticContext} />;
  } else if (!isPreview && (isUnauthorizedOnPrivateMarketplace || hasUserPendingApprovalError)) {
    return (
      <NamedRedirect
        name="NoAccessPage"
        params={{ missingAccessRight: NO_ACCESS_PAGE_USER_PENDING_APPROVAL }}
      />
    );
  } else if (
    (!isPreview && hasNoViewingRightsOnPrivateMarketplace && !isCurrentUser) ||
    isErrorNoViewingPermission(userShowError)
  ) {
    // Someone without viewing rights on a private marketplace is trying to
    // view a profile page that is not their own – redirect to NoAccessPage
    return (
      <NamedRedirect
        name="NoAccessPage"
        params={{ missingAccessRight: NO_ACCESS_PAGE_VIEW_LISTINGS }}
      />
    );
  } else if (!isPreview && isForbiddenError(userShowError)) {
    // This can happen if private marketplace mode is active, but it's not reflected through asset yet.
    return (
      <NamedRedirect
        name="SignupPage"
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  } else if (isPreview && mounted && !isCurrentUser) {
    // Someone is manipulating the URL, redirect to current user's profile page.
    return isCurrentUser === false ? (
      <NamedRedirect name="ProfilePage" params={{ id: currentUser?.id?.uuid }} />
    ) : null;
  } else if ((isPreview || isPrivateMarketplace) && !mounted) {
    // This preview of the profile page is not rendered on server-side
    // and the first pass on client-side should render the same UI.
    return null;
  }

  const topbarDisplayName = currentUser?.attributes?.profile?.displayName;
  const topbarRole = isBrandUserType(config, currentUser) ? 'brand' : 'creator';

  // Header meta: location comes straight off the user's own publicData (no
  // dedicated user field configured yet — see PLAN-PROFILEPAGE-REDESIGN.md
  // §2.3). Category differs by role: a creator's niche lives on their
  // creator-profile listing (same source ExploreCreatorsPage/CreatorProfilePage
  // read), a brand's industry (if ever added) would live on the user itself.
  const location = publicData?.location || publicData?.city || null;

  let categoryLabels = [];
  let categoryExtraCount = 0;
  if (userTypeRoles.provider) {
    const creatorListingPublicData = creatorProfileListing?.attributes?.publicData || {};
    const { nicheLabels } = getCreatorFieldLabels(
      creatorListingPublicData,
      config.listing.listingFields
    );
    categoryLabels = nicheLabels.slice(0, MAX_CATEGORY_LABELS);
    categoryExtraCount = Math.max(nicheLabels.length - MAX_CATEGORY_LABELS, 0);
  } else if (publicData?.industry) {
    categoryLabels = [publicData.industry];
  }

  const showCollabCta = viewerIsBrand && isCreatorProfileUser && !isCurrentUser;

  const headerCta =
    mounted && isCurrentUser ? (
      <NamedLink className={css.ctaButton} name="ProfileSettingsPage">
        <FormattedMessage id="ProfilePage.editProfileLinkDesktop" />
      </NamedLink>
    ) : showCollabCta ? (
      <NamedLink
        className={css.ctaButton}
        name="CreatorProfilePage"
        params={{ id: creatorProfileListing.id.uuid }}
      >
        <FormattedMessage id="ProfilePage.collabCta" />
      </NamedLink>
    ) : null;

  const actionsMenu = (
    <ProfileActionsMenu
      showRosterButton={showRosterButton}
      isSaved={isSavedCreator}
      toggleInProgress={toggleInProgress}
      onToggleSavedCreator={handleToggleSavedCreator}
      onCopyProfileLink={handleCopyProfileLink}
    />
  );

  const pageHeadingId = userTypeRoles.provider
    ? 'ProfilePage.pageHeadingCreator'
    : 'ProfilePage.pageHeadingBrand';

  // This is rendering normal profile page (not preview for pending-approval)
  return (
    <Page
      scrollingDisabled={scrollingDisabled}
      title={schemaTitle}
      schema={{
        '@context': 'http://schema.org',
        '@type': 'ProfilePage',
        mainEntity: {
          '@type': 'Person',
          name: profileUser?.attributes?.profile?.displayName,
        },
        name: schemaTitle,
      }}
    >
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar displayName={topbarDisplayName} role={topbarRole} onLogout={onLogout} />
        }
        footer={<FooterContainer />}
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.pageHeading}>
            <FormattedMessage id={pageHeadingId} />
          </Heading>
          <div className={css.layout}>
            <div className={css.main}>
              <ProfileHeaderCard
                user={profileUser}
                displayName={displayName}
                userTypeRoles={userTypeRoles}
                reviews={reviews}
                location={location}
                categoryLabels={categoryLabels}
                categoryExtraCount={categoryExtraCount}
                headerCta={headerCta}
                actionsMenu={actionsMenu}
                intl={intl}
              />
              <MainContent
                bio={bio}
                displayName={displayName}
                userShowError={userShowError}
                publicData={publicData}
                metadata={metadata}
                userFieldConfig={userFields}
                hideReviews={hasNoViewingRightsOnPrivateMarketplace}
                intl={intl}
                userTypeRoles={userTypeRoles}
                isCurrentUser={isCurrentUser}
                listings={listings}
                reviews={reviews}
                queryReviewsError={queryReviewsError}
                {...rest}
              />
            </div>
            <ProfileSidebar
              show={showCollaborationHistory}
              collaborationHistory={collaborationHistory}
              queryCollaborationHistoryInProgress={queryCollaborationHistoryInProgress}
              currentCreatorListing={creatorProfileListing}
              intl={intl}
            />
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  const {
    userId,
    userShowError,
    queryListingsError,
    userListingRefs,
    reviews = [],
    queryReviewsError,
    collaborationHistory,
    queryCollaborationHistoryInProgress,
  } = state.ProfilePage;
  const userMatches = getMarketplaceEntities(state, [{ type: 'user', id: userId }]);
  const user = userMatches.length === 1 ? userMatches[0] : null;

  // Show currentUser's data if it's not approved yet
  const isCurrentUser = userId?.uuid === currentUser?.id?.uuid;
  const useCurrentUser =
    isCurrentUser && !(isUserAuthorized(currentUser) && hasPermissionToViewData(currentUser));

  return {
    scrollingDisabled: isScrollingDisabled(state),
    currentUser,
    useCurrentUser,
    user,
    userShowError,
    queryListingsError,
    listings: getMarketplaceEntities(state, userListingRefs),
    reviews,
    queryReviewsError,
    toggleInProgress: state.brandRoster.toggleInProgress,
    collaborationHistory,
    queryCollaborationHistoryInProgress,
  };
};

const mapDispatchToProps = dispatch => ({
  onToggleSavedCreator: creatorId => dispatch(toggleSavedCreator(creatorId)),
  onQueryCollaborationHistory: creatorId => dispatch(queryCollaborationHistory(creatorId)),
  onLogout: () => dispatch(logout()),
});

const ProfilePage = compose(connect(mapStateToProps, mapDispatchToProps))(ProfilePageComponent);

export default ProfilePage;
