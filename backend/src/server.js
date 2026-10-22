require("dotenv").config();

const mongoose = require("mongoose");

const app = require("./app");
const connectDB = require("./config/db");
const logger = require("./utils/logger");
const { startBackgroundJobs, stopBackgroundJobs } = require("./jobs/scheduler");

const PORT = Number(process.env.PORT) || 5000;
const SHUTDOWN_TIMEOUT_MS = 10000;

const startServer = async () => {
  let server;
  let backgroundJobsStarted = false;
  let isShuttingDown = false;
  let shutdownTimeout;

  const shutdown = async (signal, initialExitCode = 0) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    let exitCode = initialExitCode;

    logger.info(`${signal} received. Starting graceful shutdown...`);

    shutdownTimeout = setTimeout(() => {
      logger.error("Graceful shutdown timed out");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      // Stop future background-job executions first.
      if (backgroundJobsStarted) {
        try {
          await Promise.resolve(stopBackgroundJobs());
          backgroundJobsStarted = false;
        } catch (error) {
          exitCode = 1;
          logger.error(`Failed to stop background jobs: ${error.message}`);
        }
      }

      // Stop accepting requests and wait for active requests.
      if (server?.listening) {
        try {
          await new Promise((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          });

          logger.info("HTTP server closed");
        } catch (error) {
          exitCode = 1;
          logger.error(`Failed to close HTTP server: ${error.message}`);
        }
      }

      // Attempt DB cleanup even if HTTP shutdown failed.
      try {
        await mongoose.disconnect();
        logger.info("MongoDB connection closed");
      } catch (error) {
        exitCode = 1;
        logger.error(`Failed to close MongoDB: ${error.message}`);
      }

      logger.info("Graceful shutdown finished");
    } finally {
      clearTimeout(shutdownTimeout);
      process.exitCode = exitCode;
    }
  };

  try {
    // Connect to MongoDB before accepting requests.
    await connectDB();

    // Start background jobs only after the DB connection succeeds.
    startBackgroundJobs();
    backgroundJobsStarted = true;

    server = app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });

    server.on("error", (error) => {
      logger.error(`HTTP server error: ${error.message}`);
      void shutdown("SERVER_ERROR", 1);
    });

    process.once("SIGINT", () => {
      void shutdown("SIGINT");
    });

    process.once("SIGTERM", () => {
      void shutdown("SIGTERM");
    });
  } catch (error) {
    logger.error(`Server startup failed: ${error.message}`);

    // Clean up only resources that were started or connected.
    if (backgroundJobsStarted) {
      try {
        await Promise.resolve(stopBackgroundJobs());
        backgroundJobsStarted = false;
      } catch (shutdownError) {
        logger.error(
          `Failed to stop background jobs after startup error: ${shutdownError.message}`,
        );
      }
    }

    try {
      await mongoose.disconnect();
    } catch (shutdownError) {
      logger.error(
        `Failed to close MongoDB after startup error: ${shutdownError.message}`,
      );
    }

    process.exitCode = 1;
  }
};

void startServer();
