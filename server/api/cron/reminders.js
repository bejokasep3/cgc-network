/**
 * Deadline reminders (IMPLEMENTATION-PLAN.md F7.1).
 *
 * POST /api/cron/reminders, called by an external scheduler (Heroku
 * Scheduler / cron-job.org) once an hour — deliberately not a library
 * running inside this process, since that wouldn't work correctly across
 * multiple server instances (each would fire its own timers). Protected by
 * a shared secret header instead of a user session, since nobody is logged
 * in when the scheduler calls this.
 *
 * Sending is stubbed (see sendReminderEmail below) pending a real email
 * provider decision — server/api-util/reminders.js's job-selection logic is
 * what actually matters here and is fully covered by its own tests.
 */
const { getIntegrationSdk } = require('../../api-util/integrationSdk');
const { handleError } = require('../../api-util/sdk');
const {
  CGC_UGC_PROCESS_NAME,
  ACTIVE_UGC_STATES,
} = require('../../api-util/adminHealth');
const { buildReminderJobs } = require('../../api-util/reminders');

const CRON_SECRET_HEADER = 'x-cron-secret';
const PER_PAGE = 100;

const fetchAllPages = queryFn => {
  const fetchPage = (page, accumulated) =>
    queryFn(page).then(response => {
      const { data, meta } = response.data;
      const combined = accumulated.concat(data);
      const hasMorePages = meta && page < meta.totalPages;
      return hasMorePages ? fetchPage(page + 1, combined) : combined;
    });
  return fetchPage(1, []);
};

// Replace with a real provider call (SendGrid/Mailgun/Postmark/etc.) once
// one is chosen — at that point this will also need to look up the
// provider's email via integrationSdk.users.show({id: job.providerId}),
// which isn't fetched today since it'd be wasted work while stubbed.
const sendReminderEmail = job => {
  // eslint-disable-next-line no-console
  console.log(
    `[cron/reminders] ${job.milestone} reminder due for transaction ${job.transactionId} ` +
      `(provider ${job.providerId}, project "${job.projectTitle}", due ${job.dueDate})`
  );
  return Promise.resolve();
};

module.exports = (req, res) => {
  const configuredSecret = process.env.CGC_CRON_SECRET;
  if (!configuredSecret) {
    return res
      .status(501)
      .json({ message: 'CGC_CRON_SECRET is not configured. Reminders are disabled.' });
  }

  const providedSecret = req.get(CRON_SECRET_HEADER);
  if (providedSecret !== configuredSecret) {
    return res.status(401).json({ message: 'Invalid or missing cron secret.' });
  }

  const integrationSdk = getIntegrationSdk();

  fetchAllPages(page =>
    integrationSdk.transactions.query({
      processNames: CGC_UGC_PROCESS_NAME,
      states: ACTIVE_UGC_STATES.join(','),
      page,
      perPage: PER_PAGE,
    })
  )
    .then(transactions => {
      const projectIds = [
        ...new Set(
          transactions.map(tx => tx.attributes?.protectedData?.projectId).filter(Boolean)
        ),
      ];
      const fetchProjectListings = projectIds.length
        ? integrationSdk.listings.query({ ids: projectIds }).then(response => response.data.data)
        : Promise.resolve([]);

      return fetchProjectListings.then(projectListings => ({ transactions, projectListings }));
    })
    .then(({ transactions, projectListings }) => {
      const projectListingsById = projectListings.reduce((acc, listing) => {
        acc[listing.id.uuid] = listing;
        return acc;
      }, {});

      const jobs = buildReminderJobs(transactions, projectListingsById);

      return Promise.all(
        jobs.map(job =>
          sendReminderEmail(job).then(() =>
            integrationSdk.transactions.updateMetadata({
              id: job.transactionId,
              metadata: { remindersSent: [...job.remindersSentBefore, job.milestone] },
            })
          )
        )
      ).then(() => jobs.length);
    })
    .then(remindersSent => {
      res.status(200).json({ remindersSent });
    })
    .catch(e => handleError(res, e));
};
