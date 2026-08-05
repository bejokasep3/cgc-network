import { getProcess, CGC_APPLICATION_PROCESS_NAME } from '../../transactions/transaction';
import { states as applicationStates } from '../../transactions/transactionProcessCGCApplication';
import { states as ugcStates } from '../../transactions/transactionProcessCGCUGC';
import { deriveCampaign } from '../ManageCampaignsPage/campaignData';

/**
 * Derives the four overview-card numbers for a single project's owner view,
 * from its raw applicant and collaboration transactions. Kept as a pure
 * function (mirrors campaignData.js's deriveCampaign) so
 * ProjectDetailPage.js only has to render, not re-derive this logic.
 *
 * - `awaitingApproval` counts only `applied` applications — a `countered`
 *   application is awaiting the *creator's* response, not the brand's, so it
 *   deliberately isn't counted here even though ManageCampaignsPage's row
 *   badge counts every application regardless of state.
 * - `productsToShip` mirrors ManageCampaignsPage.js's "due-to-ship" shipment
 *   filter: purchased-but-not-yet-shipped orders on a requires-product
 *   listing.
 * - `videosToApprove` mirrors campaignData.js's "needs-review" bucket, which
 *   is already ManageCampaignsPage's "actions required" definition.
 *
 * @param {Object} params
 * @param {Array<propTypes.transaction>} params.applicants - cgc-application sale txs for this project
 * @param {Array<propTypes.transaction>} params.collaborations - order txs (any process) for this project
 * @param {Object} [params.projectListing] - this project's own listing, needed
 *   for requiresProduct (see campaignData.js's deriveCampaign for why it
 *   can't be read off the collaboration's own tx.listing)
 * @returns {{awaitingApproval: number, bookedCreators: number, productsToShip: number, videosToApprove: number}}
 */
export const deriveProjectOverview = ({ applicants = [], collaborations = [], projectListing }) => {
  const awaitingApproval = applicants.filter(
    tx => getProcess(CGC_APPLICATION_PROCESS_NAME).getState(tx) === applicationStates.APPLIED
  ).length;

  const derivedCollaborations = collaborations.map(tx => deriveCampaign(tx, projectListing));

  const bookedCreatorIds = new Set(
    derivedCollaborations.map(c => c.provider?.id?.uuid).filter(Boolean)
  );

  const productsToShip = derivedCollaborations.filter(
    c => c.state === ugcStates.PURCHASED && c.isShippable
  ).length;

  const videosToApprove = derivedCollaborations.filter(c => c.bucket === 'needs-review').length;

  return {
    awaitingApproval,
    bookedCreators: bookedCreatorIds.size,
    productsToShip,
    videosToApprove,
  };
};
