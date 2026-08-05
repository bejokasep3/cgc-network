import React, { useEffect, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { fetchOwnCreatorProfileThunk } from '../../ducks/creatorProfile.duck';
import { fetchStripeAccount } from '../../ducks/stripeConnectAccount.duck';
import { markWelcomeSeenThunk } from '../../ducks/user.duck';
import { isUserAuthorized } from '../../util/userHelpers';
import { getCreatorSetupSteps } from './creatorSetupSteps';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  NamedLink,
  NamedRedirect,
  SetupChecklist,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';

import css from './CreatorOnboardingPage.module.css';

/**
 * Creator's setup checklist: account approval (invite-only vetting),
 * profile, creator-profile package listing, and Stripe payout — linked from
 * BrowseProjectsPage/MyCollaborationsPage whenever setup is incomplete (see
 * CreatorSetupBanner.js). Unlike BrandOnboardingPage (a static, disconnected
 * placeholder), each step here reflects the creator's real account state.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled
 * @param {propTypes.currentUser} props.currentUser
 * @param {Object} props.creatorProfile - state.creatorProfile
 * @param {Object} props.stripeConnectAccount - state.stripeConnectAccount
 * @param {Function} props.onFetchOwnCreatorProfile
 * @param {Function} props.onFetchStripeAccount
 * @param {Function} props.onMarkWelcomeSeen
 * @param {Function} props.onLogout
 * @returns {JSX.Element}
 */
export const CreatorOnboardingPageComponent = props => {
  const intl = useIntl();
  const {
    scrollingDisabled,
    currentUser,
    creatorProfile,
    stripeConnectAccount,
    onFetchOwnCreatorProfile,
    onFetchStripeAccount,
    onMarkWelcomeSeen,
    onLogout,
  } = props;

  // Captured once on mount rather than derived from currentUser on every
  // render — otherwise the welcome heading would disappear mid-visit the
  // moment onMarkWelcomeSeen's setCurrentUser lands.
  const [isFirstVisit] = useState(
    () => !currentUser?.attributes?.profile?.privateData?.welcomeSeenAt
  );

  useEffect(() => {
    onFetchOwnCreatorProfile();
    // sdk.stripeAccount.fetch() 404s (rejects) for a user who has never
    // connected a Stripe account — only call it once that relationship
    // exists, same guard StripePayoutPage.duck.js uses.
    if (currentUser?.stripeAccount) {
      onFetchStripeAccount();
    }
    if (isFirstVisit && isUserAuthorized(currentUser)) {
      onMarkWelcomeSeen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFetchOwnCreatorProfile, onFetchStripeAccount, currentUser?.stripeAccount]);

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const title = intl.formatMessage({ id: 'CreatorOnboardingPage.schemaTitle' });
  const displayName = currentUser?.attributes?.profile?.displayName;

  const steps = getCreatorSetupSteps({
    currentUser,
    ownProfileListing: creatorProfile?.ownProfileListing,
    stripeAccount: stripeConnectAccount?.stripeAccount,
  });
  const allDone = steps.every(step => step.done);

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar displayName={displayName} role="creator" onLogout={onLogout} />
        }
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage
              id={isFirstVisit ? 'CreatorOnboardingPage.welcomeHeading' : 'CreatorOnboardingPage.heading'}
            />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage
              id={isFirstVisit ? 'CreatorOnboardingPage.welcomeSubtitle' : 'CreatorOnboardingPage.subtitle'}
            />
          </p>

          <SetupChecklist steps={steps} progressLabelId="CreatorOnboardingPage.progressLabel" />

          {!allDone ? (
            <NamedLink name="BrowseProjectsPage" className={css.skipLink}>
              <FormattedMessage id="CreatorOnboardingPage.skipLink" />
            </NamedLink>
          ) : null}

          {allDone ? (
            <div className={css.allDoneCard}>
              <Heading as="h2" rootClassName={css.allDoneTitle}>
                <FormattedMessage id="CreatorOnboardingPage.allDoneTitle" />
              </Heading>
              <p className={css.allDoneBody}>
                <FormattedMessage id="CreatorOnboardingPage.allDoneBody" />
              </p>
              <NamedLink name="BrowseProjectsPage" className={css.allDoneCta}>
                <FormattedMessage id="CreatorOnboardingPage.allDoneCta" />
              </NamedLink>
            </div>
          ) : null}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  return {
    scrollingDisabled: isScrollingDisabled(state),
    currentUser,
    creatorProfile: state.creatorProfile,
    stripeConnectAccount: state.stripeConnectAccount,
  };
};

const mapDispatchToProps = dispatch => ({
  onFetchOwnCreatorProfile: () => dispatch(fetchOwnCreatorProfileThunk()),
  onFetchStripeAccount: () => dispatch(fetchStripeAccount()).catch(() => {}),
  onMarkWelcomeSeen: () => dispatch(markWelcomeSeenThunk()).unwrap().catch(() => {}),
  onLogout: () => dispatch(logout()),
});

const CreatorOnboardingPage = compose(connect(mapStateToProps, mapDispatchToProps))(
  CreatorOnboardingPageComponent
);

export default CreatorOnboardingPage;
