const path = require("node:path");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "../.env.test");
dotenv.config({ path: envPath, override: true });

const EXPECTED_DATABASE = "nri_property_test";
const DEFAULT_TEST_URL = "http://localhost:5001";

async function main() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Blocked: NODE_ENV must be test.");
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Blocked: MONGODB_URI is missing from .env.test.");
  }

  let databaseName;

  try {
    const normalizedUri = uri
      .replace(/^mongodb\+srv:/, "https:")
      .replace(/^mongodb:/, "http:");

    databaseName = new URL(normalizedUri).pathname.slice(1).split("?")[0];
  } catch {
    throw new Error("Blocked: MONGODB_URI is not a valid connection URI.");
  }

  if (databaseName !== EXPECTED_DATABASE) {
    throw new Error(
      `Blocked: expected database "${EXPECTED_DATABASE}", found "${databaseName || "(empty)"}".`,
    );
  }

  const testUrl = new URL(process.env.TEST_BASE_URL || DEFAULT_TEST_URL);

  const allowedHosts = ["localhost", "127.0.0.1", "::1"];

  if (
    testUrl.protocol !== "http:" ||
    !allowedHosts.includes(testUrl.hostname) ||
    testUrl.port !== "5001"
  ) {
    throw new Error(
      "Blocked: integration tests must target localhost on port 5001.",
    );
  }

  const healthUrl = new URL("/", testUrl);

  let response;

  try {
    response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error(
      "Blocked: test API is unavailable at localhost:5001. Start tests/testServer.js first.",
    );
  }

  if (!response.ok) {
    throw new Error(
      `Blocked: test API health check returned HTTP ${response.status}.`,
    );
  }

  const body = await response.json();

  if (
    body.success !== true ||
    body.message !== "NRI Smart Property Management System API is running"
  ) {
    throw new Error(
      "Blocked: the service at localhost:5001 did not return the expected API health response.",
    );
  }

  console.log("Pre-test safety checks passed.");
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Configured database: ${databaseName}`);
  console.log(`Test API: ${healthUrl.origin}`);
}

main().catch((error) => {
  console.error(`Pre-test safety check failed: ${error.message}`);
  process.exitCode = 1;
});
