import React, { useEffect, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { markWelcomeSeenThunk } from '../../ducks/user.duck';
import { isUserAuthorized } from '../../util/userHelpers';
import { getBrandSetupSteps } from './brandSetupSteps';

import { Heading, Page, LayoutSingleColumn, NamedLink, NamedRedirect, SetupChecklist } from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';

import css from './BrandOnboardingPage.module.css';

/**
 * Brand's setup checklist: account approval (invite-only vetting), profile,
 * subscription, and first project posted — linked from
 * ExploreCreatorsPage/ManageCampaignsPage whenever setup is incomplete (see
 * BrandSetupBanner.js). Mirrors CreatorOnboardingPage.js; each step reflects
 * the brand's real account state (see brandSetupSteps.js) rather than a
 * static, disconnected walkthrough.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled
 * @param {propTypes.currentUser} props.currentUser
 * @param {boolean} props.currentUserHasListings - state.user.currentUserHasListings
 * @param {Object|null} props.subscriptionStatus - state.brandSubscription.status
 * @param {Function} props.onMarkWelcomeSeen
 * @param {Function} props.onLogout
 * @returns {JSX.Element}
 */
export const BrandOnboardingPageComponent = props => {
  const intl = useIntl();
  const {
    scrollingDisabled,
    currentUser,
    currentUserHasListings,
    subscriptionStatus,
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
    if (isFirstVisit && isUserAuthorized(currentUser)) {
      onMarkWelcomeSeen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const title = intl.formatMessage({ id: 'BrandOnboardingPage.schemaTitle' });
  const displayName = currentUser?.attributes?.profile?.displayName;

  const steps = getBrandSetupSteps({
    currentUser,
    subscriptionStatus,
    hasPublishedListing: currentUserHasListings,
  });
  const allDone = steps.every(step => step.done);

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={<DashboardTopbar displayName={displayName} role="brand" onLogout={onLogout} />}
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage
              id={isFirstVisit ? 'BrandOnboardingPage.welcomeHeading' : 'BrandOnboardingPage.heading'}
            />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage
              id={isFirstVisit ? 'BrandOnboardingPage.welcomeSubtitle' : 'BrandOnboardingPage.subtitle'}
            />
          </p>

          <SetupChecklist steps={steps} progressLabelId="BrandOnboardingPage.progressLabel" />

          {!allDone ? (
            <NamedLink name="ExploreCreatorsPage" className={css.skipLink}>
              <FormattedMessage id="BrandOnboardingPage.skipLink" />
            </NamedLink>
          ) : null}

          {allDone ? (
            <div className={css.allDoneCard}>
              <Heading as="h2" rootClassName={css.allDoneTitle}>
                <FormattedMessage id="BrandOnboardingPage.allDoneTitle" />
              </Heading>
              <p className={css.allDoneBody}>
                <FormattedMessage id="BrandOnboardingPage.allDoneBody" />
              </p>
              <NamedLink name="ExploreCreatorsPage" className={css.allDoneCta}>
                <FormattedMessage id="BrandOnboardingPage.allDoneCta" />
              </NamedLink>
            </div>
          ) : null}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { currentUser, currentUserHasListings } = state.user;
  return {
    scrollingDisabled: isScrollingDisabled(state),
    currentUser,
    currentUserHasListings,
    subscriptionStatus: state.brandSubscription?.status,
  };
};

const mapDispatchToProps = dispatch => ({
  onMarkWelcomeSeen: () => dispatch(markWelcomeSeenThunk()).unwrap().catch(() => {}),
  onLogout: () => dispatch(logout()),
});

const BrandOnboardingPage = compose(connect(mapStateToProps, mapDispatchToProps))(
  BrandOnboardingPageComponent
);

export default BrandOnboardingPage;
