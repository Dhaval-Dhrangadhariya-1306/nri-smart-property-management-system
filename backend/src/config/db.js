const mongoose = require("mongoose");
const dns = require("dns");

const logger = require("../utils/logger");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI);

    logger.info(`MongoDB connected: ${connection.connection.host}`);
    logger.info(`Database: ${connection.connection.name}`);
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
