require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const logger = require("./utils/logger");
const { startBackgroundJobs, stopBackgroundJobs } = require("./jobs/scheduler");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    startBackgroundJobs();

    const server = app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });

    const shutdown = (signal) => {
      logger.info(`${signal} received. Server shutting down...`);

      stopBackgroundJobs();

      server.close(() => {
        logger.info("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    logger.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
