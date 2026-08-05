import React from 'react';
import classNames from 'classnames';
import { useSelector } from 'react-redux';

import { FormattedMessage } from '../../util/reactIntl';
import { NamedLink } from '../../components';
import { isSubscriptionStatusResolved } from '../../util/subscription';
import { getBrandSetupSteps } from './brandSetupSteps';

import css from './BrandSetupBanner.module.css';

/**
 * Thin strip shown on ExploreCreatorsPage and ManageCampaignsPage while a
 * brand's setup checklist (see brandSetupSteps.js) isn't finished yet.
 * Renders nothing once every step is done.
 *
 * Unlike CreatorSetupBanner, this needs no fetch effect of its own — every
 * source it reads (currentUser, brandSubscription.status,
 * currentUserHasListings) is already fetched at boot for authorized users
 * (see ducks/user.duck.js). That boot fetch is fire-and-forget, though (not
 * awaited by fetchCurrentUserThunk), so on a fresh page load subscription
 * status and currentUserHasListings can still be unresolved for a beat after
 * currentUser itself is ready. Rendering during that window would flash an
 * incomplete step for a brand who has actually already finished setup, so
 * this waits for both to resolve at least once before showing anything.
 *
 * @param {Object} props
 * @param {propTypes.currentUser} props.currentUser
 * @param {string} [props.className]
 * @returns {JSX.Element|null}
 */
const BrandSetupBanner = props => {
  const { currentUser, className } = props;
  const brandSubscriptionState = useSelector(state => state.brandSubscription);
  const currentUserHasListings = useSelector(state => state.user?.currentUserHasListings);
  const currentUserHasListingsFetched = useSelector(
    state => state.user?.currentUserHasListingsFetched
  );

  const subscriptionResolved = isSubscriptionStatusResolved(brandSubscriptionState);
  if (!subscriptionResolved || !currentUserHasListingsFetched) {
    return null;
  }

  const steps = getBrandSetupSteps({
    currentUser,
    subscriptionStatus: brandSubscriptionState?.status,
    hasPublishedListing: currentUserHasListings,
  });
  const doneCount = steps.filter(step => step.done).length;

  if (doneCount === steps.length) {
    return null;
  }

  return (
    <div className={classNames(css.root, className)}>
      <span className={css.progressText}>
        <FormattedMessage
          id="BrandSetupBanner.progress"
          values={{ done: doneCount, total: steps.length }}
        />
      </span>
      <NamedLink name="BrandOnboardingPage" className={css.cta}>
        <FormattedMessage id="BrandSetupBanner.cta" />
      </NamedLink>
    </div>
  );
};

export default BrandSetupBanner;
