import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { types as sdkTypes } from '../../util/sdkLoader';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { checkBrandAccess } from '../../util/subscription';
import { isUserAuthorized } from '../../util/userHelpers';
import { showListing } from '../ListingPage/ListingPage.duck';
import {
  fetchProjectApplicantsThunk,
  fetchProjectCollaborationsThunk,
} from '../ProjectDetailPage/ProjectDetailPage.duck';
import { deriveProjectOverview } from '../ProjectDetailPage/projectOverviewStats';
import { buildProjectPrefillInitialValues } from '../PostProjectPage/postProjectPrefill';
import { submitEditProjectThunk } from './EditProjectPage.duck';

import { Heading, Page, LayoutSingleColumn, NamedRedirect, IconSpinner } from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import PostProjectForm from '../PostProjectPage/PostProjectForm';

import css from './EditProjectPage.module.css';

const { UUID } = sdkTypes;

/**
 * A brand's "Edit project" destination — reuses PostProjectForm (the same
 * focused form PostProjectPage.js uses to create a project) pre-filled from
 * the existing listing, instead of routing into the general
 * EditListingWizard. Submitting updates the listing in place (see
 * EditProjectPage.duck.js); it never re-publishes or re-creates it.
 *
 * Posting a project is a brand-gated action (see PostProjectPage.js), and
 * editing one mirrors the same gate.
 *
 * @param {Object} props
 * @param {Object} props.params - Route params, expects params.id (the
 *   project listing id)
 * @returns {JSX.Element}
 */
const EditProjectPage = props => {
  const { params } = props;
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();

  const listingId = new UUID(params.id);

  const currentUser = useSelector(state => state.user?.currentUser);
  const brandSubscription = useSelector(state => state.brandSubscription);
  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));
  const { showListingError } = useSelector(state => state.ListingPage);
  const { submitInProgress, submitError, submittedListingId } = useSelector(
    state => state.EditProjectPage
  );
  const { applicantRefs, collaborationRefs } = useSelector(state => state.ProjectDetailPage);
  const applicants = useSelector(state => getMarketplaceEntities(state, applicantRefs));
  const collaborations = useSelector(state => getMarketplaceEntities(state, collaborationRefs));

  useEffect(() => {
    dispatch(showListing(listingId, config)).catch(() => {
      // Ignore, error handling in duck file / showListingError below.
    });
    dispatch(fetchProjectApplicantsThunk({ projectId: params.id }));
    dispatch(fetchProjectCollaborationsThunk({ projectId: params.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const listing = useSelector(
    state => getMarketplaceEntities(state, [{ id: listingId, type: 'listing' }])[0]
  );

  const displayName = currentUser?.attributes?.profile?.displayName;
  const title = intl.formatMessage({ id: 'EditProjectPage.schemaTitle' });

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="RequestAccessPage" />;
  }

  const subscriptionResolved =
    brandSubscription?.status !== null && !brandSubscription?.fetchInProgress;
  const brandAccessDenied =
    subscriptionResolved &&
    !checkBrandAccess({ status: brandSubscription?.status, isBrand: true }).allowed;

  // Mirrors PostProjectPage.js's three-way (loading / denied / allowed)
  // branch for exactly the same reason: brandAccessDenied stays false both
  // while the subscription fetch is still in flight and if it permanently
  // failed, so this must gate the form explicitly rather than falling
  // through.
  if (!subscriptionResolved) {
    return (
      <Page title={title} scrollingDisabled={scrollingDisabled}>
        <LayoutSingleColumn
          topbar={
            <DashboardTopbar
              displayName={displayName}
              currentPage="ManageCampaignsPage"
              onLogout={() => dispatch(logout())}
            />
          }
        >
          {brandSubscription?.fetchError ? (
            <p className={css.error}>
              <FormattedMessage id="EditProjectPage.subscriptionCheckFailed" />
            </p>
          ) : (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          )}
        </LayoutSingleColumn>
      </Page>
    );
  }

  if (brandAccessDenied) {
    return <NamedRedirect name="SubscriptionPage" search="reason=post-project" />;
  }

  // Only known once the listing has loaded — an edit link only ever exists
  // on the owner's own ProjectDetailPage, so a mismatch here means someone
  // navigated to this URL directly for a project they don't own.
  const isOwner = !!listing && listing.author?.id?.uuid === currentUser.id?.uuid;
  if (listing && !isOwner) {
    return <NamedRedirect name="ExploreCreatorsPage" />;
  }

  if (submittedListingId) {
    return <NamedRedirect name="ProjectDetailPage" params={{ id: submittedListingId.uuid }} />;
  }

  const overview = deriveProjectOverview({ applicants, collaborations });
  const hasActiveActivity = overview.awaitingApproval > 0 || overview.bookedCreators > 0;

  const handleSubmit = values => {
    const {
      title: projectTitle,
      description,
      deliverables,
      contentDueDate,
      price,
      priceNegotiable,
      ...customFieldValues
    } = values;
    dispatch(
      submitEditProjectThunk({
        listingId: listing.id,
        title: projectTitle,
        description,
        price,
        deliverables,
        contentDueDate,
        priceNegotiable: Array.isArray(priceNegotiable) && priceNegotiable.length > 0,
        publicListingFields: customFieldValues,
        config,
      })
    ).catch(() => {
      // Ignore, error handling in duck file / submitError below.
    });
  };

  const publicData = listing?.attributes?.publicData || {};
  const initialValues = listing
    ? {
        ...buildProjectPrefillInitialValues(listing),
        contentDueDate: publicData.contentDueDate,
      }
    : null;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage="ManageCampaignsPage"
            onLogout={() => dispatch(logout())}
          />
        }
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="EditProjectPage.heading" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="EditProjectPage.subtitle" />
          </p>

          {showListingError ? (
            <p className={css.error}>
              <FormattedMessage id="EditProjectPage.loadFailed" />
            </p>
          ) : !listing || !initialValues ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : (
            <>
              {hasActiveActivity ? (
                <div className={css.activityBanner}>
                  <FormattedMessage id="EditProjectPage.activityBanner" />
                </div>
              ) : null}

              <PostProjectForm
                listingFieldsConfig={config.listing.listingFields}
                marketplaceCurrency={config.currency}
                onSubmit={handleSubmit}
                inProgress={submitInProgress}
                apiSubmitError={submitError}
                initialValues={initialValues}
              />
            </>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default EditProjectPage;
