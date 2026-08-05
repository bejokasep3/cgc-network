import React, { useState } from 'react';
import { compose } from 'redux';
import { connect, useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { createResourceLocatorString } from '../../util/routes';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { checkBrandAccess } from '../../util/subscription';
import { isUserAuthorized } from '../../util/userHelpers';
import { sendInvitationThunk } from '../ProjectInvitePage/ProjectInvitePage.duck';
import { submitProjectThunk } from './PostProjectPage.duck';
import { readAndClearPostProjectPrefill } from './postProjectPrefill';

import { Heading, Page, LayoutSingleColumn, NamedRedirect, IconSpinner } from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import PostProjectForm from './PostProjectForm';

import css from './PostProjectPage.module.css';

/**
 * A brand's "New campaign" destination: a focused, single-step form for
 * posting a project listing, instead of routing into the general
 * listing-creation wizard. Submitting creates and immediately publishes a
 * real `project` listing (see PostProjectPage.duck.js) — same data model
 * Console and the rest of the app already use, just a purpose-built UI on
 * top instead of the multi-tab EditListingWizard.
 *
 * Posting a project is a brand-gated action (CGC-SETUP.md §4), so an
 * unsubscribed brand is redirected to SubscriptionPage before the form ever
 * renders — mirroring the same check EditListingPage used to do for this
 * listing type.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled
 * @param {propTypes.currentUser} props.currentUser
 * @param {Object} props.brandSubscription - state.brandSubscription
 * @param {boolean} props.submitInProgress
 * @param {propTypes.error} props.submitError
 * @param {string|null} props.submittedListingId
 * @param {Function} props.onSubmitProject
 * @param {Function} props.onLogout
 * @returns {JSX.Element}
 */
export const PostProjectPageComponent = props => {
  const intl = useIntl();
  const config = useConfiguration();
  const routeConfiguration = useRouteConfiguration();
  const dispatch = useDispatch();
  const history = useHistory();
  const {
    scrollingDisabled,
    currentUser,
    brandSubscription,
    submitInProgress,
    submitError,
    submittedListingId,
    onSubmitProject,
    onLogout,
  } = props;

  // "Collab again" from RosterPage (F8.1) bridges here via sessionStorage —
  // see postProjectPrefill.js for why (React Router has no built-in way to
  // pass a Money price or a UUID to invite across a NamedLink navigation).
  // Read once on mount and never again, so a page refresh doesn't re-apply
  // stale data or double-invite.
  const [prefill] = useState(() => readAndClearPostProjectPrefill(history));

  const displayName = currentUser?.attributes?.profile?.displayName;
  const title = intl.formatMessage({ id: 'PostProjectPage.schemaTitle' });

  // A brand still in Sharetribe's built-in 'pending-approval' state (F0.2)
  // shouldn't be able to publish a real, live project listing — the only
  // enforcement of that gate used to be the one-time redirect right after
  // signup (AuthenticationPage.js), which is bypassable (e.g. direct
  // navigation, browser back). Mirrors the same isUserAuthorized gate
  // ProjectDetailPage.js already applies to a creator's "apply" action.
  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="RequestAccessPage" />;
  }

  const subscriptionResolved =
    brandSubscription?.status !== null && !brandSubscription?.fetchInProgress;
  const brandAccessDenied =
    subscriptionResolved &&
    !checkBrandAccess({ status: brandSubscription?.status, isBrand: true }).allowed;

  // Not resolved yet must NOT fall through to the form below — brandAccessDenied
  // is false both while we're still waiting on fetchBrandSubscription AND if
  // that fetch ever failed (ducks/brandSubscription.duck.js's rejected case
  // leaves status at null forever), so without this branch an unsubscribed
  // brand could post for free anytime the status fetch hadn't resolved.
  // Mirrors the same three-way (loading / denied / allowed) branch
  // CreatorProfilePage.js uses for its gated invite form — plus a distinct
  // error state (CreatorProfilePage doesn't have one) so a permanently
  // failed fetch (e.g. STRIPE_SECRET_KEY/STRIPE_BRAND_SUBSCRIPTION_PRICE_ID
  // not configured, server/api/subscription.js's notConfigured) shows as an
  // error instead of spinning forever with no explanation.
  if (!subscriptionResolved) {
    return (
      <Page title={title} scrollingDisabled={scrollingDisabled}>
        <LayoutSingleColumn
          topbar={
            <DashboardTopbar
              displayName={displayName}
              currentPage="ManageCampaignsPage"
              onLogout={onLogout}
            />
          }
        >
          {brandSubscription?.fetchError ? (
            <p className={css.error}>
              <FormattedMessage id="PostProjectPage.subscriptionCheckFailed" />
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
    // Explains why the brand landed here instead of the form — see
    // SubscriptionPage.js's reasonNotice.
    return <NamedRedirect name="SubscriptionPage" search="reason=post-project" />;
  }

  // Only the plain "post a project" path redirects declaratively off
  // submittedListingId — the "Collab again" path below drives its own
  // redirect imperatively, once the follow-up invite has also been sent.
  if (submittedListingId && !prefill?.inviteCreator) {
    return <NamedRedirect name="ManageCampaignsPage" />;
  }

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
    const submitPromise = onSubmitProject({
      title: projectTitle,
      description,
      price,
      deliverables,
      contentDueDate,
      // FieldCheckbox always yields an array of checked values (or none),
      // never a bare boolean — see PostProjectForm.js.
      priceNegotiable: Array.isArray(priceNegotiable) && priceNegotiable.length > 0,
      publicListingFields: customFieldValues,
      config,
    });

    if (prefill?.inviteCreator) {
      // The invite IS the point of "Collab again" — send it as soon as the
      // project exists, then land on the project's own page instead of the
      // campaign list. If the invite call itself fails, the project still
      // exists and is still worth landing on: ProjectInvitePage (reachable
      // from there) shows the true sent/not-sent state per creator, so
      // nothing here needs to claim success that may not have happened.
      submitPromise
        .unwrap()
        .then(listingId =>
          dispatch(
            sendInvitationThunk({
              creatorListingId: prefill.inviteCreator.creatorListingId,
              projectId: listingId.uuid,
              message: prefill.inviteCreator.message,
            })
          )
            .unwrap()
            .catch(() => {})
            .then(() =>
              history.push(
                createResourceLocatorString(
                  'ProjectDetailPage',
                  routeConfiguration,
                  { id: listingId.uuid },
                  {}
                )
              )
            )
        )
        .catch(() => {
          // Submission error already surfaced via submitError below.
        });
    }
  };

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage="ManageCampaignsPage"
            onLogout={onLogout}
          />
        }
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="PostProjectPage.heading" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="PostProjectPage.subtitle" />
          </p>

          <div className={css.card}>
            <PostProjectForm
              listingFieldsConfig={config.listing.listingFields}
              marketplaceCurrency={config.currency}
              onSubmit={handleSubmit}
              inProgress={submitInProgress}
              apiSubmitError={submitError}
              initialValues={prefill?.initialValues}
            />
          </div>
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  const { submitInProgress, submitError, submittedListingId } = state.PostProjectPage;
  return {
    scrollingDisabled: isScrollingDisabled(state),
    currentUser,
    brandSubscription: state.brandSubscription,
    submitInProgress,
    submitError,
    submittedListingId,
  };
};

const mapDispatchToProps = dispatch => ({
  onSubmitProject: params => dispatch(submitProjectThunk(params)),
  onLogout: () => dispatch(logout()),
});

const PostProjectPage = compose(connect(mapStateToProps, mapDispatchToProps))(PostProjectPageComponent);

export default PostProjectPage;
