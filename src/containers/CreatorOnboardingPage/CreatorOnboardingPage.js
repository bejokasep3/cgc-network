import React, { useEffect } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { fetchOwnCreatorProfileThunk } from '../../ducks/creatorProfile.duck';
import { fetchStripeAccount } from '../../ducks/stripeConnectAccount.duck';
import { getCreatorSetupSteps } from './creatorSetupSteps';

import { Heading, Page, LayoutSingleColumn, NamedLink } from '../../components';
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
    onLogout,
  } = props;

  useEffect(() => {
    onFetchOwnCreatorProfile();
    // sdk.stripeAccount.fetch() 404s (rejects) for a user who has never
    // connected a Stripe account — only call it once that relationship
    // exists, same guard StripePayoutPage.duck.js uses.
    if (currentUser?.stripeAccount) {
      onFetchStripeAccount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFetchOwnCreatorProfile, onFetchStripeAccount, currentUser?.stripeAccount]);

  const title = intl.formatMessage({ id: 'CreatorOnboardingPage.schemaTitle' });
  const displayName = currentUser?.attributes?.profile?.displayName;

  const steps = getCreatorSetupSteps({
    currentUser,
    ownProfileListing: creatorProfile?.ownProfileListing,
    stripeAccount: stripeConnectAccount?.stripeAccount,
  });
  const currentStepIndex = steps.findIndex(step => !step.done);
  const allDone = currentStepIndex === -1;
  const doneCount = steps.filter(step => step.done).length;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar displayName={displayName} role="creator" onLogout={onLogout} />
        }
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="CreatorOnboardingPage.heading" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="CreatorOnboardingPage.subtitle" />
          </p>

          <div className={css.progressBarTrack}>
            <div
              className={css.progressBarFill}
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
          <p className={css.progressLabel}>
            <FormattedMessage
              id="CreatorOnboardingPage.progressLabel"
              values={{ done: doneCount, total: steps.length }}
            />
          </p>

          <div className={css.stepList}>
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={classNames(css.stepCard, {
                  [css.stepCardDone]: step.done,
                  [css.stepCardCurrent]: index === currentStepIndex,
                })}
              >
                <span
                  className={classNames(css.stepIcon, {
                    [css.stepIconDone]: step.done,
                    [css.stepIconCurrent]: index === currentStepIndex,
                  })}
                >
                  {step.done ? '✓' : index + 1}
                </span>
                <div className={css.stepInfo}>
                  <Heading
                    as="h2"
                    rootClassName={classNames(css.stepTitle, { [css.stepTitleDone]: step.done })}
                  >
                    <FormattedMessage id={step.titleId} />
                  </Heading>
                  <p className={css.stepBody}>
                    <FormattedMessage id={step.bodyId} />
                  </p>
                </div>
                {step.done ? (
                  <span className={css.stepDoneBadge}>
                    <FormattedMessage id="CreatorOnboardingPage.stepDone" />
                  </span>
                ) : step.routeName ? (
                  <NamedLink name={step.routeName} className={css.stepCta}>
                    <FormattedMessage id={step.ctaLabelId} />
                  </NamedLink>
                ) : null}
              </div>
            ))}
          </div>

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
  onLogout: () => dispatch(logout()),
});

const CreatorOnboardingPage = compose(connect(mapStateToProps, mapDispatchToProps))(
  CreatorOnboardingPageComponent
);

export default CreatorOnboardingPage;
