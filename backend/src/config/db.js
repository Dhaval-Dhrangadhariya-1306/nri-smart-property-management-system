const dns = require("node:dns");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

let memoryServer = null;

const connectDB = async () => {
  try {
    let uri = (process.env.MONGODB_URI || "").trim();

    if (uri && uri.startsWith("mongodb+srv://")) {
      try {
        dns.setServers(["1.1.1.1", "8.8.8.8"]);
      } catch {
        // Ignore DNS server error
      }
    }

    if (!uri) {
      logger.info(
        "No MONGODB_URI configured. Starting in-memory MongoDB server for local development...",
      );
      const { MongoMemoryServer } = require("mongodb-memory-server");
      memoryServer = await MongoMemoryServer.create({
        instance: { launchTimeout: 60000 },
      });
      uri = memoryServer.getUri();
      logger.info(`In-memory MongoDB started at: ${uri}`);
    }

    let connection;
    try {
      connection = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
    } catch (connectErr) {
      if (!memoryServer && process.env.NODE_ENV !== "production") {
        logger.warn(
          `Could not connect to external MongoDB (${connectErr.message}). Falling back to in-memory database for development...`,
        );
        const { MongoMemoryServer } = require("mongodb-memory-server");
        memoryServer = await MongoMemoryServer.create({
          instance: { launchTimeout: 60000 },
        });
        const fallbackUri = memoryServer.getUri();
        connection = await mongoose.connect(fallbackUri);
        logger.info(`Fallback in-memory MongoDB started at: ${fallbackUri}`);
      } else {
        throw connectErr;
      }
    }

    logger.info(`MongoDB connected: ${connection.connection.host}`);
    logger.info(`Database: ${connection.connection.name}`);

    return connection;
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (memoryServer) {
      await memoryServer.stop();
      memoryServer = null;
    }
  } catch (error) {
    logger.error(`Error disconnecting database: ${error.message}`);
  }
};

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.disconnectDB = disconnectDB;
