const dns = require("node:dns");

// Configure DNS before initializing Mongoose.
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not configured");
    }

    const connection = await mongoose.connect(process.env.MONGODB_URI);

    logger.info(`MongoDB connected: ${connection.connection.host}`);

    logger.info(`Database: ${connection.connection.name}`);

    return connection;
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);

    throw error;
  }
};

module.exports = connectDB;
