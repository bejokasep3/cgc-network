import { DELIVERABLE_TYPE_OPTIONS } from '../PostProjectPage/PostProjectForm';
import { getProjectFieldLabels } from '../../util/creatorFields';

const deliverableTypeLabel = (intl, type) => {
  const option = DELIVERABLE_TYPE_OPTIONS.find(o => o.key === type);
  return option ? intl.formatMessage({ id: option.labelId }) : type;
};

/**
 * Flattens a brand's completed collaborations down to one row per delivered
 * asset — the last (accepted) version of each deliverable that actually has
 * one. A deliverable with no submitted version yet has nothing to freeze
 * into the library, so it's skipped rather than shown as an empty row.
 *
 * @param {Array<Object>} transactions - cgc-ugc-approval transactions
 *   (customer === current brand), each with .protectedData.deliverables and
 *   .protectedData.projectId
 * @param {Object} projectListingsById - { [uuid]: listing }, the related
 *   project listings (for usageRights)
 * @param {Array<Object>} listingFieldConfigs - config.listing.listingFields
 * @param {Object} intl - react-intl object, for deliverable type labels
 * @returns {Array<Object>} one entry per delivered asset:
 *   { id, transactionId, projectId, projectTitle, creatorId, creatorName,
 *     platform, deliverableTypeLabel, usageRightsLabel, contentLinks,
 *     submissionNote }
 */
export const buildLibraryAssets = (transactions, projectListingsById, listingFieldConfigs, intl) => {
  return (transactions || []).flatMap(tx => {
    const projectId = tx.attributes?.protectedData?.projectId;
    const project = projectId ? projectListingsById?.[projectId] : null;
    const { usageRightsLabel } = getProjectFieldLabels(
      project?.attributes?.publicData,
      listingFieldConfigs
    );
    const deliverables = tx.attributes?.protectedData?.deliverables || [];
    const creator = tx.provider;

    return deliverables
      .map(deliverable => {
        const versions = Array.isArray(deliverable.versions) ? deliverable.versions : [];
        const finalVersion = versions[versions.length - 1];
        if (!finalVersion) {
          return null;
        }
        return {
          id: `${tx.id.uuid}-${deliverable.id}`,
          transactionId: tx.id.uuid,
          projectId: projectId || null,
          projectTitle: project?.attributes?.title || null,
          creatorId: creator?.id?.uuid || null,
          creatorName: creator?.attributes?.profile?.displayName || null,
          platform: deliverable.platform || null,
          deliverableTypeLabel: deliverableTypeLabel(intl, deliverable.type),
          usageRightsLabel: usageRightsLabel || null,
          contentLinks: finalVersion.contentLinks || '',
          submissionNote: finalVersion.submissionNote || '',
        };
      })
      .filter(Boolean);
  });
};

/**
 * Distinct filter option sets derived from the asset list itself, so the
 * filter dropdowns never offer a choice that would return zero results.
 *
 * @param {Array<Object>} assets - buildLibraryAssets() output
 * @returns {{projects: Array<{id, title}>, creators: Array<{id, name}>, platforms: Array<string>}}
 */
export const getLibraryFilterOptions = assets => {
  const byId = (map, id, value) => {
    if (id && !map.has(id)) {
      map.set(id, value);
    }
    return map;
  };

  const projects = [...(assets || []).reduce(
    (map, a) => byId(map, a.projectId, { id: a.projectId, title: a.projectTitle }),
    new Map()
  ).values()];
  const creators = [...(assets || []).reduce(
    (map, a) => byId(map, a.creatorId, { id: a.creatorId, name: a.creatorName }),
    new Map()
  ).values()];
  const platforms = [...new Set((assets || []).map(a => a.platform).filter(Boolean))];

  return { projects, creators, platforms };
};

/**
 * @param {Array<Object>} assets - buildLibraryAssets() output
 * @param {Object} filters
 * @param {string} [filters.projectId]
 * @param {string} [filters.creatorId]
 * @param {string} [filters.platform]
 * @returns {Array<Object>}
 */
export const filterLibraryAssets = (assets, filters = {}) => {
  const { projectId, creatorId, platform } = filters;
  return (assets || []).filter(
    a =>
      (!projectId || a.projectId === projectId) &&
      (!creatorId || a.creatorId === creatorId) &&
      (!platform || a.platform === platform)
  );
};
