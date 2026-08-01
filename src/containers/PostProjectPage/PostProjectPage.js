import React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { checkBrandAccess } from '../../util/subscription';
import { submitProjectThunk } from './PostProjectPage.duck';

import { Heading, Page, LayoutSingleColumn, NamedRedirect } from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import PostProjectForm from './PostProjectForm';

import css from './PostProjectPage.module.css';

/**
 * A brand's "New campaign" destination: a focused, single-step form for
 * posting a project-brief listing, instead of routing into the general
 * listing-creation wizard. Submitting creates and immediately publishes a
 * real `project-brief` listing (see PostProjectPage.duck.js) — same data model
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

  const displayName = currentUser?.attributes?.profile?.displayName;

  const subscriptionResolved =
    brandSubscription?.status !== null && !brandSubscription?.fetchInProgress;
  const brandAccessDenied =
    subscriptionResolved &&
    !checkBrandAccess({ status: brandSubscription?.status, isBrand: true }).allowed;

  if (brandAccessDenied) {
    return <NamedRedirect name="SubscriptionPage" />;
  }

  if (submittedListingId) {
    return <NamedRedirect name="ManageCampaignsPage" />;
  }

  const title = intl.formatMessage({ id: 'PostProjectPage.schemaTitle' });

  const handleSubmit = values => {
    const { title: projectTitle, description, ...customFieldValues } = values;
    onSubmitProject({
      title: projectTitle,
      description,
      publicListingFields: customFieldValues,
      config,
    });
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

          <PostProjectForm
            listingFieldsConfig={config.listing.listingFields}
            onSubmit={handleSubmit}
            inProgress={submitInProgress}
            apiSubmitError={submitError}
          />
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
