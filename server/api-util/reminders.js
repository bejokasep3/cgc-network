/**
 * Deadline reminders (IMPLEMENTATION-PLAN.md F7.1).
 *
 * Sharetribe's own process.edn notifications can only fire relative to a
 * transition's own state-entry time (`:time/first-entered-state`) — they
 * have no way to read an arbitrary date field off a DIFFERENT entity, and
 * `contentDueDate` lives on the project listing, not the transaction
 * (confirmed while building F6.1/F6.2). That's why the existing
 * `content-due-reminder-*` notifications in process.edn are only a rough
 * "N days after entering this state" approximation, not tied to what the
 * brand actually promised — this module is what replaces them (F7.2 removes
 * the old ones once this is live, pending your approval since that's a
 * process.edn change).
 *
 * Sending itself is stubbed (see server/api/cron/reminders.js) — this
 * module only decides WHO needs a reminder and WHEN, which is fully
 * testable without a live email provider.
 *
 * Dedup: a transaction's own `metadata.remindersSent` (NOT protectedData —
 * Sharetribe has no endpoint to update a transaction's protectedData
 * outside a transition, only `transactions/updateMetadata`, confirmed
 * against the Integration API reference) records which milestones have
 * already gone out, so calling the cron endpoint twice in a row for the
 * same transaction only sends once.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const REMINDER_MILESTONES = {
  H3: 'h3',
  H1: 'h1',
  OVERDUE: 'overdue',
};
exports.REMINDER_MILESTONES = REMINDER_MILESTONES;

/**
 * @param {string} dueDateIso - YYYY-MM-DD (contentDueDate)
 * @param {Date} now
 * @returns {number} whole days remaining, rounded up; negative once overdue
 */
const daysRemaining = (dueDateIso, now) =>
  Math.ceil((new Date(dueDateIso).getTime() - now.getTime()) / MS_PER_DAY);
exports.daysRemaining = daysRemaining;

/**
 * @param {number} days - daysRemaining() output
 * @returns {string|null} one of REMINDER_MILESTONES, or null if no
 *   milestone applies today
 */
const milestoneForDaysRemaining = days => {
  if (days === 3) return REMINDER_MILESTONES.H3;
  if (days === 1) return REMINDER_MILESTONES.H1;
  if (days < 0) return REMINDER_MILESTONES.OVERDUE;
  return null;
};
exports.milestoneForDaysRemaining = milestoneForDaysRemaining;

/**
 * Decides which active collaborations need a reminder sent right now.
 *
 * @param {Array<Object>} transactions - active cgc-ugc-approval transactions
 *   (Integration API resources), each with .attributes.protectedData.projectId
 *   and .relationships.provider
 * @param {Object} projectListingsById - { [uuid]: listing }, the related
 *   project listings (for contentDueDate)
 * @param {Date} [now]
 * @returns {Array<Object>} one job per transaction needing a reminder:
 *   { transactionId, providerId, projectTitle, milestone, dueDate,
 *     daysRemaining, remindersSentBefore }
 */
exports.buildReminderJobs = (transactions, projectListingsById, now = new Date()) => {
  return (transactions || [])
    .map(tx => {
      const projectId = tx.attributes?.protectedData?.projectId;
      const project = projectId ? projectListingsById?.[projectId] : null;
      const dueDate = project?.attributes?.publicData?.contentDueDate;
      if (!dueDate) {
        return null;
      }

      const days = daysRemaining(dueDate, now);
      const milestone = milestoneForDaysRemaining(days);
      if (!milestone) {
        return null;
      }

      const remindersSentBefore = tx.attributes?.metadata?.remindersSent || [];
      if (remindersSentBefore.includes(milestone)) {
        return null;
      }

      const providerId = tx.relationships?.provider?.data?.id?.uuid;
      if (!providerId) {
        return null;
      }

      return {
        transactionId: tx.id.uuid,
        providerId,
        projectTitle: project.attributes.title,
        milestone,
        dueDate,
        daysRemaining: days,
        remindersSentBefore,
      };
    })
    .filter(Boolean);
};
