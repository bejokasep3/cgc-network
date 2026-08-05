/**
 * Bridges RosterPage's "Collab again" (IMPLEMENTATION-PLAN.md F8.1) to
 * PostProjectPage: pre-fill a new project from a previous one and remember
 * which creator to invite once it's published. React Router has no built-in
 * way to pass complex values (a Money price, a UUID to invite) across a
 * NamedLink navigation, so this mirrors CheckoutPageSessionHelpers.js's
 * sessionStorage + sdkTypes replacer/reviver pattern instead of a query
 * string.
 */
import { types as sdkTypes } from '../../util/sdkLoader';

const STORAGE_KEY = 'CGCPostProjectPrefill';
// Single-use and short-lived: this only exists to bridge one click to the
// very next page render. If it's more than a few minutes old, something
// unexpected happened (a stale tab, browser back after finishing) and it
// should not silently apply to an unrelated visit to /projects/new.
const MAX_AGE_MS = 5 * 60 * 1000;

/**
 * @param {Object} params
 * @param {Object} params.initialValues - PostProjectForm initialValues
 * @param {Object} params.inviteCreator
 * @param {propTypes.uuid} params.inviteCreator.creatorListingId
 * @param {string} params.inviteCreator.message
 */
export const storePostProjectPrefill = ({ initialValues, inviteCreator }) => {
  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser || !window.sessionStorage) {
    return;
  }
  const data = { initialValues, inviteCreator, storedAt: new Date().toISOString() };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data, sdkTypes.replacer));
};

/**
 * Reads and immediately clears the stored prefill — it is single-use
 * regardless of whether this particular read turns out to be valid, so a
 * second visit to /projects/new never re-applies it.
 *
 * @param {Object} history - react-router history, for the same
 *   `action === 'PUSH'` check CheckoutPageSessionHelpers.js uses so a page
 *   refresh or browser-back doesn't re-apply stale data.
 * @returns {{initialValues: Object, inviteCreator: Object}|null}
 */
export const readAndClearPostProjectPrefill = history => {
  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser || !window.sessionStorage) {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  window.sessionStorage.removeItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const hasNavigatedThroughLink = history?.action === 'PUSH' || history?.action === 'REPLACE';
  if (!hasNavigatedThroughLink) {
    return null;
  }

  try {
    const data = JSON.parse(raw, sdkTypes.reviver);
    const isFresh =
      !!data?.storedAt && Date.now() - new Date(data.storedAt).getTime() < MAX_AGE_MS;
    return isFresh ? { initialValues: data.initialValues, inviteCreator: data.inviteCreator } : null;
  } catch (e) {
    return null;
  }
};

/**
 * Builds PostProjectForm initialValues from a previous project listing.
 * contentDueDate is deliberately left out — a past due date would just fail
 * the form's notInThePast validator, so the brand always has to pick a
 * fresh one anyway.
 *
 * @param {propTypes.listing} projectListing
 * @returns {Object}
 */
export const buildProjectPrefillInitialValues = projectListing => {
  const { title, description, price } = projectListing.attributes;
  const publicData = projectListing.attributes.publicData || {};
  const deliverables = (publicData.deliverables || []).map((deliverable, index) => ({
    ...deliverable,
    id: `d${index}`,
  }));

  return {
    title,
    description,
    price,
    deliverables: deliverables.length > 0 ? deliverables : undefined,
    usageRights: publicData.usageRights,
    // FieldCheckbox stores checked state as an array of checked values, not
    // a bare boolean — see PostProjectForm.js.
    priceNegotiable: publicData.priceNegotiable ? ['priceNegotiable'] : undefined,
    requiresProduct: publicData.requiresProduct,
    contentNiche: publicData.contentNiche,
    platforms: publicData.platforms,
  };
};
