// Resolves the CGC creator-profile listing fields (contentNiche, platforms,
// usageRights, deliverableCount, turnaroundDays) against their Console-configured
// labels (see CGC-SETUP.md §2c). Console config isn't present in this repo, so
// this degrades to the raw stored value when a field config isn't found locally —
// the same fallback CustomListingFields relies on for every other custom field.

const findFieldConfig = (listingFieldConfigs, key) =>
  (listingFieldConfigs || []).find(config => config.key === key);

const labelForOption = (fieldConfig, value) => {
  const option = fieldConfig?.enumOptions?.find(o => `${o.option}` === `${value}`);
  return option?.label || value;
};

/**
 * @param {Object} publicData - listing.attributes.publicData
 * @param {Array<Object>} listingFieldConfigs - config.listing.listingFields
 * @returns {Object} { nicheLabels, platformLabels, usageRightsLabel, deliverableCount, turnaroundDays }
 */
export const getCreatorFieldLabels = (publicData, listingFieldConfigs) => {
  const {
    contentNiche = [],
    platforms = [],
    usageRights,
    deliverableCount,
    turnaroundDays,
  } = publicData || {};

  const nicheConfig = findFieldConfig(listingFieldConfigs, 'contentNiche');
  const platformsConfig = findFieldConfig(listingFieldConfigs, 'platforms');
  const usageRightsConfig = findFieldConfig(listingFieldConfigs, 'usageRights');

  return {
    nicheLabels: contentNiche.map(value => labelForOption(nicheConfig, value)),
    platformLabels: platforms.map(value => labelForOption(platformsConfig, value)),
    usageRightsLabel: usageRights ? labelForOption(usageRightsConfig, usageRights) : null,
    deliverableCount: typeof deliverableCount === 'number' ? deliverableCount : null,
    turnaroundDays: typeof turnaroundDays === 'number' ? turnaroundDays : null,
  };
};

/**
 * Same idea as getCreatorFieldLabels, but for the `project-brief` listing
 * fields (contentNiche, platforms, budgetRange, deadline — see
 * CGC-SETUP.md §2c).
 *
 * @param {Object} publicData - listing.attributes.publicData
 * @param {Array<Object>} listingFieldConfigs - config.listing.listingFields
 * @returns {Object} { nicheLabels, platformLabels, budgetRangeLabel, deadline }
 */
export const getProjectFieldLabels = (publicData, listingFieldConfigs) => {
  const { contentNiche = [], platforms = [], budgetRange, deadline = null } = publicData || {};

  const nicheConfig = findFieldConfig(listingFieldConfigs, 'contentNiche');
  const platformsConfig = findFieldConfig(listingFieldConfigs, 'platforms');
  const budgetRangeConfig = findFieldConfig(listingFieldConfigs, 'budgetRange');

  return {
    nicheLabels: contentNiche.map(value => labelForOption(nicheConfig, value)),
    platformLabels: platforms.map(value => labelForOption(platformsConfig, value)),
    budgetRangeLabel: budgetRange ? labelForOption(budgetRangeConfig, budgetRange) : null,
    deadline,
  };
};
