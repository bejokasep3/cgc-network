import React, { useEffect } from 'react';
import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';

import { FormattedMessage } from '../../util/reactIntl';
import { NamedLink } from '../../components';
import { fetchStripeAccount } from '../../ducks/stripeConnectAccount.duck';
import { getCreatorSetupSteps } from './creatorSetupSteps';

import css from './CreatorSetupBanner.module.css';

/**
 * Thin strip shown on BrowseProjectsPage and MyCollaborationsPage while a
 * creator's setup checklist (see creatorSetupSteps.js) isn't finished yet.
 * Renders nothing once every step is done.
 *
 * @param {Object} props
 * @param {propTypes.currentUser} props.currentUser
 * @param {Object|null} props.ownProfileListing
 * @param {string} [props.className]
 * @returns {JSX.Element|null}
 */
const CreatorSetupBanner = props => {
  const { currentUser, ownProfileListing, className } = props;
  const dispatch = useDispatch();
  const stripeAccount = useSelector(state => state.stripeConnectAccount?.stripeAccount);

  useEffect(() => {
    // sdk.stripeAccount.fetch() 404s (rejects) for a user who has never
    // connected a Stripe account — only call it once that relationship
    // exists, same guard StripePayoutPage.duck.js uses.
    if (currentUser?.stripeAccount) {
      dispatch(fetchStripeAccount()).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.stripeAccount]);

  const steps = getCreatorSetupSteps({ currentUser, ownProfileListing, stripeAccount });
  const doneCount = steps.filter(step => step.done).length;

  if (doneCount === steps.length) {
    return null;
  }

  return (
    <div className={classNames(css.root, className)}>
      <span className={css.progressText}>
        <FormattedMessage
          id="CreatorSetupBanner.progress"
          values={{ done: doneCount, total: steps.length }}
        />
      </span>
      <NamedLink name="CreatorOnboardingPage" className={css.cta}>
        <FormattedMessage id="CreatorSetupBanner.cta" />
      </NamedLink>
    </div>
  );
};

export default CreatorSetupBanner;
