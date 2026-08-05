import React from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../util/reactIntl';
import { Heading, NamedLink } from '../../components';
import { ONBOARDING_LINK_STATE } from '../../util/userHelpers';

import css from './SetupChecklist.module.css';

/**
 * Progress bar + step list shared by CreatorOnboardingPage and
 * BrandOnboardingPage. Purely presentational — the caller derives `steps`
 * from the account's real state (see creatorSetupSteps.js / brandSetupSteps.js)
 * and this component just renders it.
 *
 * @param {Object} props
 * @param {Array<Object>} props.steps - { id, titleId, bodyId, done, ctaLabelId, routeName }
 * @param {string} props.progressLabelId - message id for "{done} of {total} steps complete"
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
const SetupChecklist = props => {
  const { steps, progressLabelId, className } = props;
  const currentStepIndex = steps.findIndex(step => !step.done);
  const doneCount = steps.filter(step => step.done).length;

  return (
    <div className={classNames(className)}>
      <div className={css.progressBarTrack}>
        <div
          className={css.progressBarFill}
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <p className={css.progressLabel}>
        <FormattedMessage id={progressLabelId} values={{ done: doneCount, total: steps.length }} />
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
                <FormattedMessage id="SetupChecklist.stepDone" />
              </span>
            ) : step.routeName ? (
              <NamedLink
                name={step.routeName}
                className={css.stepCta}
                to={{ state: ONBOARDING_LINK_STATE }}
              >
                <FormattedMessage id={step.ctaLabelId} />
              </NamedLink>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SetupChecklist;
