require("dotenv").config({ path: ".env.test", override: true });

const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from .env.test");
  }

  if (process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to run: NODE_ENV must be test");
  }

  // Check the intended database name before connecting.
  const expectedDatabase = "nri_property_test";
  const databaseFromUri = new URL(uri).pathname.slice(1).split("?")[0];

  if (databaseFromUri !== expectedDatabase) {
    throw new Error(
      `Refusing to connect: expected ${expectedDatabase}, found ${databaseFromUri || "(no database name)"}`,
    );
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    const actualDatabase = mongoose.connection.name;

    if (actualDatabase !== expectedDatabase) {
      throw new Error(
        `Safety check failed: connected to ${actualDatabase}, not ${expectedDatabase}`,
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
