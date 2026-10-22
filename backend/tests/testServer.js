const path = require("node:path");
const dns = require("node:dns");

// Resolve MongoDB Atlas SRV records using public DNS.
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const dotenv = require("dotenv");
const mongoose = require("mongoose");
const express = require("express");

const envPath = path.resolve(__dirname, "../.env.test");

dotenv.config({ path: envPath, override: true });

const EXPECTED_DATABASE = "nri_property_test";
const EXPECTED_PORT = 5001;
const port = Number(process.env.PORT || EXPECTED_PORT);

if (port !== EXPECTED_PORT) {
  throw new Error(
    `Refusing to start: test server must use port ${EXPECTED_PORT}.`,
  );
}

async function startTestServer() {
  // Validate the test environment before connecting to MongoDB.
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to start: NODE_ENV must be test.");
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from .env.test.");
  }

  // Extract and validate the database name from the URI.
  let configuredDatabase;

  try {
    const normalizedUri = process.env.MONGODB_URI.replace(
      /^mongodb\+srv:/,
      "https:",
    ).replace(/^mongodb:/, "http:");

    configuredDatabase = new URL(normalizedUri).pathname.slice(1).split("?")[0];
  } catch {
    throw new Error("Refusing to start: MONGODB_URI is invalid.");
  }

  if (configuredDatabase !== EXPECTED_DATABASE) {
    throw new Error(
      `Refusing to start: expected database "${EXPECTED_DATABASE}", ` +
        `got "${configuredDatabase || "(empty)"}".`,
    );
  }

  // Connect only after validating the test environment and URI.
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  // Verify the actual connected database.
  if (mongoose.connection.name !== EXPECTED_DATABASE) {
    const actualDatabase = mongoose.connection.name;

    await mongoose.disconnect();

    throw new Error(
      `Refusing to start: connected to "${actualDatabase}", ` +
        `not "${EXPECTED_DATABASE}".`,
    );
  }

  const app = express();

  // Parse JSON before registering test-only POST endpoints.
  app.use(express.json());

  // Verify test environment and database isolation.
  app.get("/__test-safety", (_req, res) => {
    res.json({
      success: true,
      environment: process.env.NODE_ENV,
      database: mongoose.connection.name,
    });
  });

  // Test-only endpoint for verifying JWT tokenVersion invalidation.
  // Never register this endpoint in production.
  if (process.env.NODE_ENV === "test") {
    app.post("/__test/increment-token-version", async (req, res) => {
      try {
        const { email } = req.body || {};

        if (typeof email !== "string" || !email.trim()) {
          return res.status(400).json({
            success: false,
            message: "Email is required",
          });
        }

        const User = require("../src/models/User");

        const user = await User.findOneAndUpdate(
          { email: email.trim().toLowerCase() },
          { $inc: { tokenVersion: 1 } },
          { new: true },
        ).select("_id tokenVersion");

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "Test user not found",
          });
        }

        return res.json({
          success: true,
          tokenVersion: user.tokenVersion,
        });
      } catch (error) {
        console.error("Test token-version update failed:", error.message);

        return res.status(500).json({
          success: false,
          message: "Test token-version update failed",
        });
      }
    });
  }

  // Mount the main application after test-only routes so the
  // application's not-found handler cannot intercept them first.
  app.use(require("../src/app"));

  const server = app.listen(port, () => {
    console.log(`Test API listening on http://localhost:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Verified database: ${mongoose.connection.name}`);
    console.log("Background jobs are not started by this test server.");
  });

  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log("\nShutting down test server...");

    server.close(async (error) => {
      try {
        await mongoose.disconnect();

        if (error) {
          console.error("Test server shutdown failed:", error.message);
          process.exitCode = 1;
        } else {
          console.log("Test database connection closed.");
        }
      } catch (disconnectError) {
        console.error("Database disconnect failed:", disconnectError.message);
        process.exitCode = 1;
      }
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startTestServer().catch(async (error) => {
  console.error("Test server startup failed:", error.message);

  await mongoose.disconnect().catch(() => {});

  process.exitCode = 1;
});
