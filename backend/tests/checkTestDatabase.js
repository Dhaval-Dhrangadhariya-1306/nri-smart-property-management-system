const path = require("node:path");
const dns = require("node:dns");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const dotenv = require("dotenv");
const mongoose = require("mongoose");

const envPath = path.resolve(__dirname, "../.env.test");
dotenv.config({ path: envPath, override: true });

const EXPECTED_DATABASE = "nri_property_test";

function getDatabaseName(uri) {
  try {
    const normalizedUri = uri
      .replace(/^mongodb\+srv:/, "https:")
      .replace(/^mongodb:/, "http:");

    return new URL(normalizedUri).pathname.slice(1).split("?")[0];
  } catch {
    throw new Error("MONGODB_URI is not a valid connection URI.");
  }
}

async function main() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to run: NODE_ENV must be test.");
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from .env.test.");
  }

  const databaseFromUri = getDatabaseName(uri);

  if (databaseFromUri !== EXPECTED_DATABASE) {
    throw new Error(
      `Refusing to connect: expected ${EXPECTED_DATABASE}, found ${
        databaseFromUri || "(no database name)"
      }.`,
    );
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    const actualDatabase = mongoose.connection.name;

    if (actualDatabase !== EXPECTED_DATABASE) {
      throw new Error(
        `Safety check failed: connected to ${actualDatabase}, ` +
          `not ${EXPECTED_DATABASE}.`,
      );
    }

    console.log("Connection successful.");
    console.log(`Verified database: ${actualDatabase}`);
    console.log("No data was modified.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Test database connection check failed:", error.message);
  process.exitCode = 1;
});
