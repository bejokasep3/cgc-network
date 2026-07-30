import React from 'react';

import { useConfiguration } from '../../context/configurationContext';
import { FormattedMessage } from '../../util/reactIntl';
import { getCreatorFieldLabels } from '../../util/creatorFields';
import { Heading } from '../../components';

import css from './ListingPage.module.css';

/**
 * Surfaces deliverableCount, turnaroundDays and usageRights as a single,
 * unmissable block instead of letting them sit as three more rows in the
 * generic custom-fields list. Usage rights ambiguity is the client's stated
 * main source of UGC licensing disputes, so it gets its own highlighted line
 * rather than blending in with the rest of the package details.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.publicData - listing.attributes.publicData
 * @returns {JSX.Element|null}
 */
const SectionCreatorPackageMaybe = props => {
  const { publicData } = props;
  const config = useConfiguration();

  const { nicheLabels, platformLabels, usageRightsLabel, deliverableCount, turnaroundDays } =
    getCreatorFieldLabels(publicData, config.listing.listingFields);

  const hasPackageDetails =
    deliverableCount != null || turnaroundDays != null || usageRightsLabel;

  if (!hasPackageDetails) {
    return null;
  }

  return (
    <section className={css.sectionCreatorPackage}>
      <Heading as="h2" rootClassName={css.sectionHeadingWithExtraMargin}>
        <FormattedMessage id="ListingPage.creatorPackageTitle" />
      </Heading>
      <div className={css.creatorPackageStats}>
        {deliverableCount != null ? (
          <div className={css.creatorPackageStat}>
            <span className={css.creatorPackageStatValue}>{deliverableCount}</span>
            <span className={css.creatorPackageStatLabel}>
              <FormattedMessage
                id="ListingPage.creatorPackageDeliverables"
                values={{ count: deliverableCount }}
              />
            </span>
          </div>
        ) : null}
        {turnaroundDays != null ? (
          <div className={css.creatorPackageStat}>
            <span className={css.creatorPackageStatValue}>{turnaroundDays}</span>
            <span className={css.creatorPackageStatLabel}>
              <FormattedMessage
                id="ListingPage.creatorPackageTurnaround"
                values={{ days: turnaroundDays }}
              />
            </span>
          </div>
        ) : null}
      </div>
      {usageRightsLabel ? (
        <div className={css.creatorPackageUsageRights}>
          <FormattedMessage
            id="ListingPage.creatorPackageUsageRights"
            values={{ usageRights: <strong>{usageRightsLabel}</strong> }}
          />
        </div>
      ) : null}
      {nicheLabels.length > 0 || platformLabels.length > 0 ? (
        <div className={css.creatorPackageTags}>
          {[...nicheLabels, ...platformLabels].map((label, index) => (
            <span key={`${label}-${index}`} className={css.creatorPackageTag}>
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default SectionCreatorPackageMaybe;
