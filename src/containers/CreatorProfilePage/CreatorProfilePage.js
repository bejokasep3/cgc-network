import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { createResourceLocatorString } from '../../util/routes';
import { parse } from '../../util/urlHelpers';
import { types as sdkTypes } from '../../util/sdkLoader';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { toggleSavedCreator } from '../../ducks/brandRoster.duck';
import { getCreatorFieldLabels } from '../../util/creatorFields';
import { checkBrandAccess, isSubscriptionStatusResolved } from '../../util/subscription';
import { REVIEW_TYPE_OF_PROVIDER } from '../../util/types';
import { isUserAuthorized, isBrandUserType } from '../../util/userHelpers';
import {
  showListing,
  fetchReviews,
  fetchOwnProjects,
  sendInquiry,
} from '../ListingPage/ListingPage.duck';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  AvatarLarge,
  NamedLink,
  NamedRedirect,
  IconSpinner,
  IconLocation,
  IconVerified,
  ReviewRating,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import InquiryForm from '../ListingPage/InquiryForm/InquiryForm';
import { ProfileActionsMenu, ReviewScoreBox, ProfileReviewList } from '../ProfilePage/ProfilePage';

import css from './CreatorProfilePage.module.css';

const { UUID } = sdkTypes;

const MAX_CATEGORY_LABELS = 2;

const averageRating = reviews => {
  const providerReviews = reviews.filter(r => r.attributes?.type === REVIEW_TYPE_OF_PROVIDER);
  if (providerReviews.length === 0) {
    return { average: null, count: 0 };
  }
  const total = providerReviews.reduce((sum, r) => sum + (r.attributes?.rating || 0), 0);
  return { average: total / providerReviews.length, count: providerReviews.length };
};

/**
 * A brand's read-only view of a creator, reached by clicking "Collab" on
 * ExploreCreatorsPage. Shows the creator's package details and reviews (both
 * sourced from their published creator-profile listing, same data
 * ListingPage would show), plus an "invite to a campaign" form that lets the
 * brand attach one of its own project listings — the same
 * project-attachment mechanism ListingPage's contact modal already offers, just
 * surfaced directly on the page instead of behind a "Contact" button, since
 * inviting is the whole point of landing here.
 *
 * A purpose-built page (rather than routing to the generic ListingPage)
 * because a creator isn't a product: the client's brief calls for showing
 * performance/collaboration info here, not a product gallery and price.
 *
 * @param {Object} props
 * @param {Object} props.params - Route params, expects params.id (the
 *   creator's published creator-profile listing id)
 * @returns {JSX.Element}
 */
const CreatorProfilePage = props => {
  const { params, location } = props;
  const intl = useIntl();
  const config = useConfiguration();
  const routes = useRouteConfiguration();
  const history = useHistory();
  const dispatch = useDispatch();

  const listingId = new UUID(params.id);

  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));
  const brandSubscription = useSelector(state => state.brandSubscription);
  const {
    showListingError,
    reviews,
    fetchReviewsError,
    ownProjects,
    fetchOwnProjectsInProgress,
    sendInquiryInProgress,
    sendInquiryError,
  } = useSelector(state => state.ListingPage);

  useEffect(() => {
    dispatch(showListing(listingId, config)).catch(() => {
      // Ignore, error handling in duck file / showListingError below.
    });
    dispatch(fetchReviews(listingId)).catch(() => {});
    dispatch(fetchOwnProjects()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const listing = useSelector(
    state => getMarketplaceEntities(state, [{ id: listingId, type: 'listing' }])[0]
  );

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const author = listing?.author;
  const displayName = author?.attributes?.profile?.displayName;
  const bio = author?.attributes?.profile?.bio;
  const authorPublicData = author?.attributes?.profile?.publicData || {};
  const creatorLocation = authorPublicData.location || authorPublicData.city || null;
  const isAuthorVerified = isUserAuthorized(author);

  const publicData = listing?.attributes?.publicData || {};
  const { nicheLabels, platformLabels, usageRightsLabel, deliverableCount, turnaroundDays } =
    getCreatorFieldLabels(publicData, config.listing.listingFields);
  const categoryLabels = nicheLabels.slice(0, MAX_CATEGORY_LABELS);
  const categoryExtraCount = Math.max(nicheLabels.length - MAX_CATEGORY_LABELS, 0);

  const providerReviews = reviews.filter(r => r.attributes?.type === REVIEW_TYPE_OF_PROVIDER);
  const { average, count } = averageRating(reviews);

  // Which dashboard chrome (nav items, account-menu links) the logged-in
  // viewer should see — this page is reached both by brands (via "Collab"
  // on ExploreCreatorsPage) and by creators viewing their own public
  // profile (via the account menu), so it can't hardcode brand chrome.
  const isBrandViewer = isBrandUserType(config, currentUser);
  const isOwnProfile = !!(currentUser?.id && author?.id && currentUser.id.uuid === author.id.uuid);

  // "..." menu parity with ProfilePage's brand-facing view: roster save is
  // only offered to a brand viewing someone else's profile, copy-link always.
  const toggleInProgress = useSelector(state => state.brandRoster.toggleInProgress);
  const savedCreatorIds = currentUser?.attributes?.profile?.privateData?.savedCreatorIds || [];
  const isSavedCreator = !!author?.id?.uuid && savedCreatorIds.includes(author.id.uuid);
  const showRosterButton = !isOwnProfile && isBrandViewer && !!currentUser?.id;
  const handleToggleSavedCreator = () => dispatch(toggleSavedCreator(author.id.uuid));
  const handleCopyProfileLink = () => {
    if (typeof window !== 'undefined' && window.navigator?.clipboard) {
      window.navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  };

  const subscriptionResolved = isSubscriptionStatusResolved(brandSubscription);
  const brandAccessDenied =
    subscriptionResolved &&
    !checkBrandAccess({ status: brandSubscription?.status, isBrand: true }).allowed;

  const handleInviteSubmit = values => {
    const { message, projectId } = values;
    const projectListing = projectId ? ownProjects.find(l => l.id.uuid === projectId) : null;
    // IMPLEMENTATION-PLAN.md §2.5/F2.5: `invitationStatus` starts 'sent' and
    // is otherwise derived (accepted/expired), never written again from the
    // client.
    const protectedData = projectListing ? { projectId, invitationStatus: 'sent' } : undefined;

    dispatch(sendInquiry(listing, message.trim(), protectedData))
      .then(txId => {
        history.push(createResourceLocatorString('OrderDetailsPage', routes, { id: txId.uuid }, {}));
      })
      .catch(() => {
        // Ignore, error handling in duck file
      });
  };

  const title = displayName
    ? intl.formatMessage({ id: 'CreatorProfilePage.schemaTitle' }, { displayName })
    : intl.formatMessage({ id: 'CreatorProfilePage.schemaTitleFallback' });

  const projectOptions = ownProjects.map(l => ({ id: l.id.uuid, title: l.attributes.title }));

  // F2.5: arriving with ?project=<id> (from ExploreCreatorsPage/
  // ProjectInvitePage's "browse all creators" link) preselects that project
  // in the picker below, instead of the brand having to find it again.
  const requestedProjectId = parse(location?.search || '')?.project || null;
  const preselectedProjectId = projectOptions.some(p => p.id === requestedProjectId)
    ? requestedProjectId
    : undefined;

  const loggedInDisplayName = currentUser?.attributes?.profile?.displayName;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={loggedInDisplayName}
            currentPage={isBrandViewer ? 'ExploreCreatorsPage' : 'BrowseProjectsPage'}
            role={isBrandViewer ? 'brand' : 'creator'}
            onLogout={() => dispatch(logout())}
          />
        }
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.pageHeading}>
            <FormattedMessage id="CreatorProfilePage.pageHeading" />
          </Heading>
          {showListingError ? (
            <p className={css.error}>
              <FormattedMessage id="CreatorProfilePage.loadingFailed" />
            </p>
          ) : !listing ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : (
            <div className={css.layout}>
              <div className={css.main}>
                <div className={css.headerCard}>
                  <div className={css.avatarWrapper}>
                    <AvatarLarge className={css.avatar} user={author} disableProfileLink />
                    {isAuthorVerified ? (
                      <IconVerified
                        className={css.verifiedBadge}
                        aria-label={intl.formatMessage({
                          id: 'CreatorProfilePage.verifiedBadgeLabel',
                        })}
                      />
                    ) : null}
                  </div>
                  <div className={css.headerInfo}>
                    <Heading as="h2" rootClassName={css.heading}>
                      {displayName}
                    </Heading>
                    <span className={css.roleLabel}>
                      <FormattedMessage id="CreatorProfilePage.roleLabel" />
                    </span>
                    {creatorLocation ? (
                      <div className={css.locationRow}>
                        <IconLocation className={css.locationIcon} />
                        <span className={css.locationText}>{creatorLocation}</span>
                      </div>
                    ) : null}
                    <div className={css.metaRow}>
                      <div className={css.metaColumn}>
                        <span className={css.metaLabel}>
                          <FormattedMessage id="CreatorProfilePage.metaRatingLabel" />
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
                              <FormattedMessage
                                id="CreatorProfilePage.reviewCount"
                                values={{ count }}
                              />
                            </span>
                          </a>
                        ) : (
                          <span className={css.metaValue}>
                            <FormattedMessage id="CreatorProfilePage.noRatingYet" />
                          </span>
                        )}
                      </div>

                      {categoryLabels.length > 0 ? (
                        <div className={css.metaColumn}>
                          <span className={css.metaLabel}>
                            <FormattedMessage id="CreatorProfilePage.metaCategoryLabel" />
                          </span>
                          <span className={css.metaValue}>
                            {categoryLabels.join(', ')}
                            {categoryExtraCount > 0 ? ` +${categoryExtraCount}` : ''}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    {platformLabels.length > 0 ? (
                      <div className={css.tags}>
                        {platformLabels.map((label, index) => (
                          <span key={`${label}-${index}`} className={css.tag}>
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className={css.headerActions}>
                    <ProfileActionsMenu
                      showRosterButton={showRosterButton}
                      isSaved={isSavedCreator}
                      toggleInProgress={toggleInProgress}
                      onToggleSavedCreator={handleToggleSavedCreator}
                      onCopyProfileLink={handleCopyProfileLink}
                    />
                    {isOwnProfile ? (
                      <NamedLink className={css.ctaButton} name="CreatorPackagePage">
                        <FormattedMessage id="CreatorProfilePage.editProfileButton" />
                      </NamedLink>
                    ) : null}
                  </div>
                </div>

                <section className={css.section}>
                  <Heading as="h2" rootClassName={css.sectionHeading}>
                    <FormattedMessage id="CreatorProfilePage.aboutTitle" />
                  </Heading>
                  <p className={css.bio}>
                    {bio || intl.formatMessage({ id: 'CreatorProfilePage.aboutEmpty' })}
                  </p>
                </section>

                {deliverableCount != null || turnaroundDays != null || usageRightsLabel ? (
                  <section className={css.section}>
                    <Heading as="h2" rootClassName={css.sectionHeading}>
                      <FormattedMessage id="CreatorProfilePage.packageTitle" />
                    </Heading>
                    <div className={css.packageStats}>
                      {deliverableCount != null ? (
                        <div className={css.packageStat}>
                          <span className={css.packageStatValue}>{deliverableCount}</span>
                          <span className={css.packageStatLabel}>
                            <FormattedMessage
                              id="ListingPage.creatorPackageDeliverables"
                              values={{ count: deliverableCount }}
                            />
                          </span>
                        </div>
                      ) : null}
                      {turnaroundDays != null ? (
                        <div className={css.packageStat}>
                          <span className={css.packageStatValue}>{turnaroundDays}</span>
                          <span className={css.packageStatLabel}>
                            <FormattedMessage
                              id="ListingPage.creatorPackageTurnaround"
                              values={{ days: turnaroundDays }}
                            />
                          </span>
                        </div>
                      ) : null}
                    </div>
                    {usageRightsLabel ? (
                      <div className={css.usageRights}>
                        <FormattedMessage
                          id="ListingPage.creatorPackageUsageRights"
                          values={{ usageRights: <strong>{usageRightsLabel}</strong> }}
                        />
                      </div>
                    ) : null}
                    {publicData.requiresProduct ? (
                      <div className={css.requiresProduct}>
                        <FormattedMessage id="CreatorProfilePage.requiresProduct" />
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <section id="profile-reviews" className={css.section}>
                  <Heading as="h2" rootClassName={css.sectionHeading}>
                    <FormattedMessage id="CreatorProfilePage.reviewsTitle" values={{ count }} />
                  </Heading>
                  <ReviewScoreBox reviews={providerReviews} />
                  {fetchReviewsError ? (
                    <p className={css.error}>
                      <FormattedMessage id="CreatorProfilePage.reviewsFailed" />
                    </p>
                  ) : (
                    <ProfileReviewList reviews={providerReviews} />
                  )}
                </section>
              </div>

              {!isOwnProfile && isBrandViewer ? (
                <aside className={css.sidebar}>
                  <div className={css.inviteCard}>
                    <Heading as="h2" rootClassName={css.sectionHeading}>
                      <FormattedMessage id="CreatorProfilePage.inviteTitle" />
                    </Heading>
                    <p className={css.inviteSubtitle}>
                      <FormattedMessage id="CreatorProfilePage.inviteSubtitle" />
                    </p>

                    {!subscriptionResolved ? (
                      <div className={css.loading}>
                        <IconSpinner />
                      </div>
                    ) : brandAccessDenied ? (
                      <div className={css.subscriptionRequired}>
                        <p className={css.subscriptionRequiredBody}>
                          <FormattedMessage id="CreatorProfilePage.subscriptionRequiredBody" />
                        </p>
                        <NamedLink name="SubscriptionPage" className={css.subscribeButton}>
                          <FormattedMessage id="CreatorProfilePage.subscribeButton" />
                        </NamedLink>
                      </div>
                    ) : (
                      <InquiryForm
                        // Remounts once ownProjects finishes loading, so
                        // FinalForm's initialValues (preselectedProjectId)
                        // actually apply — it only reads them at mount, and
                        // ownProjects can still be loading when this first
                        // renders.
                        key={fetchOwnProjectsInProgress ? 'loading' : 'ready'}
                        className={css.inviteForm}
                        submitButtonWrapperClassName={css.inviteSubmitButtonWrapper}
                        listingTitle={listing?.attributes?.title}
                        authorDisplayName={displayName}
                        sendInquiryError={sendInquiryError}
                        onSubmit={handleInviteSubmit}
                        inProgress={sendInquiryInProgress || fetchOwnProjectsInProgress}
                        isInviteFlow
                        showHeader={false}
                        projectOptions={projectOptions}
                        initialValues={{ projectId: preselectedProjectId }}
                      />
                    )}
                  </div>
                </aside>
              ) : null}
            </div>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default CreatorProfilePage;
