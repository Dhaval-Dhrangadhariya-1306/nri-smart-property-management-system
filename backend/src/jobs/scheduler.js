const cron = require("node-cron");

const logger = require("../utils/logger");
const { runDocumentExpiryJob } = require("./documentExpiryJob");

const JOB_TIMEZONE = process.env.JOB_TIMEZONE || "Asia/Kolkata";

let documentExpiryTask = null;

const startBackgroundJobs = () => {
  if (documentExpiryTask) {
    logger.warn("Background jobs are already running");
    return;
  }

  documentExpiryTask = cron.schedule(
    "0 2 * * *",
    async () => {
      logger.info("Starting document expiry background job...");

      try {
        const result = await runDocumentExpiryJob();

        logger.info(
          `Document expiry job completed: processed=${result.processed}, expired=${result.expiredDocuments}, notifications=${result.notificationsCreated}`,
        );
      } catch (error) {
        logger.error(`Document expiry background job failed: ${error.message}`);
      }
    },
    {
      timezone: JOB_TIMEZONE,
    },
  );

  logger.info(
    `Background jobs started. Document expiry job scheduled daily at 02:00 (${JOB_TIMEZONE}).`,
  );
};

const stopBackgroundJobs = () => {
  if (!documentExpiryTask) {
    return;
  }

  documentExpiryTask.stop();
  documentExpiryTask = null;

  logger.info("Background jobs stopped");
};

module.exports = {
  startBackgroundJobs,
  stopBackgroundJobs,
};
