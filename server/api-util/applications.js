/**
 * Validation for creator applications and brand access requests
 * (IMPLEMENTATION-PLAN.md F4.1, shapes per §2.7). Used by
 * server/api/applications.js — pulled out here, same as cgcCheckout.js, so
 * the validation rules are unit-testable without mocking Express/the SDK.
 */

const applicationError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.statusText = message;
  error.data = {};
  return error;
};
exports.applicationError = applicationError;

const isNonEmptyString = v => typeof v === 'string' && v.trim().length > 0;

/**
 * @param {Object} body - `{ handles, sampleWorks, niches, typicalTurnaroundDays, indicativeRateInSubunits }`
 * @returns {Object} the `privateData.application` value to write
 */
exports.validateCreatorApplication = body => {
  const { handles, sampleWorks, niches, typicalTurnaroundDays, indicativeRateInSubunits } =
    body || {};

  if (!Array.isArray(handles) || handles.length === 0) {
    throw applicationError(400, 'At least one social handle is required.');
  }
  for (const h of handles) {
    if (!isNonEmptyString(h?.platform) || !isNonEmptyString(h?.url)) {
      throw applicationError(400, 'Each handle needs a platform and a URL.');
    }
  }

  // "Wajib meminta tiga contoh karya" — exactly three, not "at least".
  if (!Array.isArray(sampleWorks) || sampleWorks.filter(isNonEmptyString).length !== 3) {
    throw applicationError(400, 'Exactly three sample work links are required.');
  }

  if (!Array.isArray(niches) || niches.length === 0) {
    throw applicationError(400, 'Select at least one niche.');
  }

  if (!Number.isInteger(typicalTurnaroundDays) || typicalTurnaroundDays <= 0) {
    throw applicationError(400, 'Enter a valid typical turnaround, in days.');
  }

  if (!Number.isInteger(indicativeRateInSubunits) || indicativeRateInSubunits <= 0) {
    throw applicationError(400, 'Enter a valid indicative rate.');
  }

  return {
    handles: handles.map(h => ({
      platform: h.platform,
      url: h.url,
      followers: Number.isInteger(h.followers) ? h.followers : null,
    })),
    sampleWorks: sampleWorks.filter(isNonEmptyString),
    niches,
    typicalTurnaroundDays,
    indicativeRateInSubunits,
    submittedAt: new Date().toISOString(),
  };
};

/**
 * @param {Object} body - `{ company, website, category, monthlyVolume, budgetRange, source }`
 * @returns {Object} the `privateData.accessRequest` value to write
 */
exports.validateAccessRequest = body => {
  const { company, website, category, monthlyVolume, budgetRange, source } = body || {};

  if (!isNonEmptyString(company)) {
    throw applicationError(400, 'Company name is required.');
  }
  if (!isNonEmptyString(website)) {
    throw applicationError(400, 'Company website is required.');
  }

  return {
    company: company.trim(),
    website: website.trim(),
    category: isNonEmptyString(category) ? category.trim() : null,
    monthlyVolume: isNonEmptyString(monthlyVolume) ? monthlyVolume.trim() : null,
    budgetRange: isNonEmptyString(budgetRange) ? budgetRange.trim() : null,
    source: isNonEmptyString(source) ? source.trim() : null,
    submittedAt: new Date().toISOString(),
  };
};
