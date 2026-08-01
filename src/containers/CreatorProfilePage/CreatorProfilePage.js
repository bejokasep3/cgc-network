import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { createResourceLocatorString } from '../../util/routes';
import { types as sdkTypes } from '../../util/sdkLoader';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { getCreatorFieldLabels } from '../../util/creatorFields';
import { checkBrandAccess, isSubscriptionStatusResolved } from '../../util/subscription';
import { REVIEW_TYPE_OF_PROVIDER } from '../../util/types';
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
  Avatar,
  NamedLink,
  IconSpinner,
  ReviewRating,
  Reviews,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import InquiryForm from '../ListingPage/InquiryForm/InquiryForm';

import css from './CreatorProfilePage.module.css';

const { UUID } = sdkTypes;

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
 * brand attach one of its own project-brief listings — the same
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
  const { params } = props;
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
  const author = listing?.author;
  const displayName = author?.attributes?.profile?.displayName;
  const bio = author?.attributes?.profile?.bio;

  const publicData = listing?.attributes?.publicData || {};
  const { nicheLabels, platformLabels, usageRightsLabel, deliverableCount, turnaroundDays } =
    getCreatorFieldLabels(publicData, config.listing.listingFields);

  const { average, count } = averageRating(reviews);

  const subscriptionResolved = isSubscriptionStatusResolved(brandSubscription);
  const brandAccessDenied =
    subscriptionResolved &&
    !checkBrandAccess({ status: brandSubscription?.status, isBrand: true }).allowed;

  const handleInviteSubmit = values => {
    const { message, inviteBriefId } = values;
    const projectListing = inviteBriefId
      ? ownProjects.find(l => l.id.uuid === inviteBriefId)
      : null;
    const protectedData = projectListing
      ? { inviteBriefId, inviteBriefTitle: projectListing.attributes.title }
      : undefined;

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

  const loggedInDisplayName = currentUser?.attributes?.profile?.displayName;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={loggedInDisplayName}
            currentPage="ExploreCreatorsPage"
            onLogout={() => dispatch(logout())}
          />
        }
      >
        <div className={css.root}>
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
                  <Avatar user={author} className={css.avatar} disableProfileLink />
                  <div className={css.headerInfo}>
                    <Heading as="h1" rootClassName={css.heading}>
                      {displayName}
                    </Heading>
                    <div className={css.ratingRow}>
                      {average != null ? (
                        <>
                          <ReviewRating
                            rating={Math.round(average)}
                            className={css.reviewStars}
                            reviewStarClassName={css.reviewStar}
                          />
                          <span className={css.ratingText}>
                            {average.toFixed(1)} ·{' '}
                            <FormattedMessage
                              id="CreatorProfilePage.reviewCount"
                              values={{ count }}
                            />
                          </span>
                        </>
                      ) : (
                        <span className={css.ratingText}>
                          <FormattedMessage id="CreatorProfilePage.noRatingYet" />
                        </span>
                      )}
                    </div>
                    {nicheLabels.length > 0 || platformLabels.length > 0 ? (
                      <div className={css.tags}>
                        {[...nicheLabels, ...platformLabels].map((label, index) => (
                          <span key={`${label}-${index}`} className={css.tag}>
                            {label}
                          </span>
                        ))}
                      </div>
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

                <section className={css.section}>
                  <Heading as="h2" rootClassName={css.sectionHeading}>
                    <FormattedMessage id="CreatorProfilePage.reviewsTitle" values={{ count }} />
                  </Heading>
                  {fetchReviewsError ? (
                    <p className={css.error}>
                      <FormattedMessage id="CreatorProfilePage.reviewsFailed" />
                    </p>
                  ) : count === 0 ? (
                    <p className={css.noReviews}>
                      <FormattedMessage id="CreatorProfilePage.noReviews" />
                    </p>
                  ) : (
                    <Reviews reviews={reviews.filter(r => r.attributes?.type === REVIEW_TYPE_OF_PROVIDER)} />
                  )}
                </section>
              </div>

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
                      className={css.inviteForm}
                      submitButtonWrapperClassName={css.inviteSubmitButtonWrapper}
                      listingTitle={listing?.attributes?.title}
                      authorDisplayName={displayName}
                      sendInquiryError={sendInquiryError}
                      onSubmit={handleInviteSubmit}
                      inProgress={sendInquiryInProgress || fetchOwnProjectsInProgress}
                      isInviteFlow
                      projectOptions={projectOptions}
                    />
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default CreatorProfilePage;
