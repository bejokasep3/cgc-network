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
  const { contentNiche = [], platforms = [], usageRights, deliverableCount, turnaroundDays } =
    publicData || {};

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
 * Same idea as getCreatorFieldLabels, but for the `project` listing fields
 * (contentNiche, platforms, usageRights, requiresProduct, contentDueDate,
 * deliverables — see IMPLEMENTATION-PLAN.md §2.1). Price is NOT included
 * here: it lives on `listing.attributes.price` (a Money), not publicData.
 *
 * @param {Object} publicData - listing.attributes.publicData
 * @param {Array<Object>} listingFieldConfigs - config.listing.listingFields
 * @returns {Object} { nicheLabels, platformLabels, usageRightsLabel, requiresProduct, contentDueDate, deliverableCount }
 */
export const getProjectFieldLabels = (publicData, listingFieldConfigs) => {
  const {
    contentNiche = [],
    platforms = [],
    usageRights,
    requiresProduct = false,
    contentDueDate = null,
    deliverables = [],
  } = publicData || {};

  const nicheConfig = findFieldConfig(listingFieldConfigs, 'contentNiche');
  const platformsConfig = findFieldConfig(listingFieldConfigs, 'platforms');
  const usageRightsConfig = findFieldConfig(listingFieldConfigs, 'usageRights');

  return {
    nicheLabels: contentNiche.map(value => labelForOption(nicheConfig, value)),
    platformLabels: platforms.map(value => labelForOption(platformsConfig, value)),
    usageRightsLabel: usageRights ? labelForOption(usageRightsConfig, usageRights) : null,
    requiresProduct: !!requiresProduct,
    contentDueDate,
    deliverableCount: Array.isArray(deliverables) ? deliverables.length : 0,
  };
};

/**
 * Resolves a single Console-configured enum value to its label — the same
 * lookup getProjectFieldLabels/getCreatorFieldLabels do internally, exposed
 * for callers that need to label one-off values (e.g. ProjectDetailPage.js's
 * per-deliverable platform column) instead of a whole publicData object.
 *
 * @param {Array<Object>} listingFieldConfigs - config.listing.listingFields
 * @param {string} key - the listing field's key (e.g. 'platforms')
 * @param {string} value - the stored enum value
 * @returns {string} the configured label, or the raw value if not found
 */
export const getListingFieldOptionLabel = (listingFieldConfigs, key, value) =>
  labelForOption(findFieldConfig(listingFieldConfigs, key), value);
