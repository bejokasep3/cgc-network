import React, { useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { isScrollingDisabled } from '../../ducks/ui.duck';

import { Heading, Page, PrimaryButton, SecondaryButton } from '../../components';

import css from './BrandOnboardingPage.module.css';

// Each step is intentionally a plain object here rather than pulled from config,
// since onboarding copy/order is expected to change often during rollout.
const STEPS = [
  {
    id: 'company',
    titleId: 'BrandOnboardingPage.step1Title',
    bodyId: 'BrandOnboardingPage.step1Body',
  },
  {
    id: 'preferences',
    titleId: 'BrandOnboardingPage.step2Title',
    bodyId: 'BrandOnboardingPage.step2Body',
  },
  {
    id: 'payment',
    titleId: 'BrandOnboardingPage.step3Title',
    bodyId: 'BrandOnboardingPage.step3Body',
  },
];

/**
 * Brand onboarding page. Code-only page (not managed through Console/PageBuilder) that
 * walks a new brand through a fixed set of setup steps before they land on the
 * marketplace proper. Step content is static for now; wire each step up to its
 * real form/action (company details, creator preferences, payment setup) as those
 * flows are built out.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled - Whether scrolling is disabled
 * @returns {JSX.Element}
 */
export const BrandOnboardingPageComponent = props => {
  const intl = useIntl();
  const { scrollingDisabled } = props;

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const handleNext = () => {
    setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setStepIndex(i => Math.max(i - 1, 0));
  };

  const title = intl.formatMessage({ id: 'BrandOnboardingPage.title' });

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <div className={css.root}>
        <Heading as="h1" rootClassName={css.heading}>
          <FormattedMessage id="BrandOnboardingPage.title" />
        </Heading>

        <ol className={css.progress}>
          {STEPS.map((step, index) => (
            <li
              key={step.id}
              className={classNames(css.progressStep, {
                [css.progressStepActive]: index === stepIndex,
                [css.progressStepDone]: index < stepIndex,
              })}
            >
              {index + 1}
            </li>
          ))}
        </ol>

        <div className={css.stepCard}>
          <Heading as="h2" rootClassName={css.stepTitle}>
            <FormattedMessage id={currentStep.titleId} />
          </Heading>
          <p className={css.stepBody}>
            <FormattedMessage id={currentStep.bodyId} />
          </p>
        </div>

        <div className={css.actions}>
          {stepIndex > 0 ? (
            <SecondaryButton className={css.backButton} onClick={handleBack}>
              <FormattedMessage id="BrandOnboardingPage.back" />
            </SecondaryButton>
          ) : null}
          <PrimaryButton className={css.nextButton} onClick={handleNext} disabled={isLastStep}>
            <FormattedMessage
              id={isLastStep ? 'BrandOnboardingPage.done' : 'BrandOnboardingPage.next'}
            />
          </PrimaryButton>
        </div>
      </div>
    </Page>
  );
};

const mapStateToProps = state => {
  return {
    scrollingDisabled: isScrollingDisabled(state),
  };
};

const BrandOnboardingPage = compose(connect(mapStateToProps))(BrandOnboardingPageComponent);

export default BrandOnboardingPage;
