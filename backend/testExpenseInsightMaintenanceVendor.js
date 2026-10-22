"use strict";

const path = require("node:path");
const dns = require("node:dns");

// Use public DNS resolvers, as in the original script.
dns.setServers(["1.1.1.1", "8.8.8.8"]);

// Explicitly load the test environment.
require("dotenv").config({
  path: path.resolve(__dirname, ".env.test"),
  override: true,
});

const mongoose = require("mongoose");
const assert = require("node:assert/strict");

const {
  calculateMaintenanceCostAnalysis,
  calculateVendorCostAnalysis,
} = require("./src/services/expenseInsightService");

const Expense = require("./src/models/Expense");

const EXPECTED_DB = "nri_property_test";
const OWNER_ID = "6aa97840f532befd1c175241";
const PROPERTY_ID = "6aa97840f532befd1c175245";

function logSection(title) {
  console.log("\n----------------------------------------------");
  console.log(title);
  console.log("----------------------------------------------");
}

function assertEqual(actual, expected, label) {
  assert.equal(
    actual,
    expected,
    `${label}: expected ${expected}, received ${actual}`,
  );

  console.log(`[PASS] ${label}: ${actual}`);
}

function validateEnvironment() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to run: NODE_ENV must be test.");
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from backend/.env.test.");
  }

  let databaseFromUri;

  try {
    databaseFromUri = decodeURIComponent(
      new URL(uri).pathname.slice(1).split("?")[0],
    );
  } catch {
    throw new Error("MONGODB_URI is not a valid MongoDB connection URI.");
  }

  if (databaseFromUri !== EXPECTED_DB) {
    throw new Error(
      `Refusing to connect: expected database "${EXPECTED_DB}", ` +
        `but the URI specifies "${databaseFromUri}".`,
    );
  }

  return uri;
}

async function runTest() {
  let testPassed = false;

  try {
    console.log("\n==============================================");
    console.log("PHASE 4.6.6 - MAINTENANCE/VENDOR TEST");
    console.log("==============================================");

    // --------------------------------------------------------
    // 1. DATABASE SAFETY
    // --------------------------------------------------------

    logSection("DATABASE SAFETY CHECKS");

    const uri = validateEnvironment();

    console.log("[PASS] NODE_ENV is test.");
    console.log(`[PASS] Expected database: ${EXPECTED_DB}`);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    assertEqual(mongoose.connection.name, EXPECTED_DB, "Connected database");

    console.log("[PASS] Database safety checks completed.");

    // --------------------------------------------------------
    // 2. FETCH EXPENSE FIXTURES
    // --------------------------------------------------------

    logSection("FETCH TEST EXPENSES");

    const ownerObjectId = new mongoose.Types.ObjectId(OWNER_ID);
    const propertyObjectId = new mongoose.Types.ObjectId(PROPERTY_ID);

    const expenses = await Expense.find({
      owner: ownerObjectId,
      property: propertyObjectId,
      isActive: true,
    }).lean();

    console.log(`Active expenses found: ${expenses.length}`);

    if (expenses.length === 0) {
      throw new Error(
        "No active expenses found for the configured test owner " +
          "and property. Verify the test fixtures and IDs.",
      );
    }

    // --------------------------------------------------------
    // 3. MAINTENANCE ANALYSIS
    // --------------------------------------------------------

    logSection("MAINTENANCE ANALYSIS");

    const maintenanceAnalysis =
      await calculateMaintenanceCostAnalysis(expenses);

    assert.ok(
      maintenanceAnalysis && typeof maintenanceAnalysis === "object",
      "Maintenance analysis must return an object.",
    );

    console.dir(maintenanceAnalysis, {
      depth: null,
      colors: process.stdout.isTTY,
    });

    // --------------------------------------------------------
    // 4. VENDOR ANALYSIS
    // --------------------------------------------------------

    logSection("VENDOR ANALYSIS");

    const vendorAnalysis = await calculateVendorCostAnalysis(expenses);

    assert.ok(
      vendorAnalysis && typeof vendorAnalysis === "object",
      "Vendor analysis must return an object.",
    );

    console.dir(vendorAnalysis, {
      depth: null,
      colors: process.stdout.isTTY,
    });

    // --------------------------------------------------------
    // 5. MAINTENANCE VALIDATIONS
    // --------------------------------------------------------

    logSection("MAINTENANCE VALIDATIONS");

    assertEqual(
      maintenanceAnalysis.linkedExpenseCount,
      1,
      "Linked maintenance expense count",
    );

    assertEqual(
      maintenanceAnalysis.totalMaintenanceExpense,
      6500,
      "Total linked maintenance expense",
    );

    assertEqual(
      maintenanceAnalysis.requestsAnalyzed,
      1,
      "Maintenance requests analyzed",
    );

    assertEqual(
      maintenanceAnalysis.requestsWithCostData,
      1,
      "Maintenance requests with cost data",
    );

    assertEqual(
      maintenanceAnalysis.totalEstimatedCost,
      25000,
      "Estimated maintenance cost",
    );

    assertEqual(
      maintenanceAnalysis.totalActualCost,
      28000,
      "Actual maintenance cost",
    );

    assertEqual(
      maintenanceAnalysis.totalVariance,
      3000,
      "Maintenance cost overrun",
    );

    assertEqual(
      maintenanceAnalysis.variancePercent,
      12,
      "Maintenance cost overrun percentage",
    );

    // --------------------------------------------------------
    // 6. VENDOR VALIDATIONS
    // --------------------------------------------------------

    logSection("VENDOR VALIDATIONS");

    assertEqual(vendorAnalysis.vendorCount, 1, "Vendor count");

    assertEqual(
      vendorAnalysis.totalVendorExpense,
      6500,
      "Total linked vendor expense",
    );

    assert.ok(
      Array.isArray(vendorAnalysis.vendors),
      "Vendor analysis must contain a vendors array.",
    );

    const vendor = vendorAnalysis.vendors[0];

    assert.ok(vendor, "Expected vendor analysis entry was not found.");

    assertEqual(vendor.jobCount, 1, "Vendor job count");

    assertEqual(vendor.totalExpense, 6500, "Vendor linked expense");

    assertEqual(
      vendor.averageExpensePerJob,
      6500,
      "Average linked expense per job",
    );

    assertEqual(
      vendor.totalEstimatedCost,
      25000,
      "Vendor estimated maintenance cost",
    );

    assertEqual(
      vendor.totalActualCost,
      28000,
      "Vendor actual maintenance cost",
    );

    assertEqual(vendor.variance, 3000, "Vendor maintenance cost overrun");

    assertEqual(
      vendor.variancePercent,
      12,
      "Vendor maintenance overrun percentage",
    );

    // --------------------------------------------------------
    // 7. FINAL SUMMARY
    // --------------------------------------------------------

    console.log("\n==============================================");
    console.log("PHASE 4.6.6 TEST SUMMARY");
    console.log("==============================================");

    console.log("\nMaintenance summary:");
    console.log("Estimated cost:        INR 25,000");
    console.log("Actual cost:           INR 28,000");
    console.log("Cost overrun:          INR 3,000 (12%)");
    console.log("Linked expense total:  INR 6,500");

    console.log("\nVendor summary:");
    console.log("Vendor count:          1");
    console.log("Linked vendor expense: INR 6,500");
    console.log("Jobs analyzed:         1");

    console.log("\n[PASS] All maintenance validations passed.");
    console.log("[PASS] All vendor validations passed.");
    console.log("[PASS] No database records were modified by this script.");
    console.log("\nPASS: ALL PHASE 4.6.6 VALIDATIONS PASSED");
    console.log("==============================================");

    testPassed = true;
  } catch (error) {
    console.error("\n==============================================");
    console.error("PHASE 4.6.6 TEST FAILED");
    console.error(error.stack || error.message);
    console.error("==============================================");

    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect();
        console.log("\nMongoDB connection closed.");
      } catch (cleanupError) {
        console.error(
          "\nFailed to close MongoDB connection:",
          cleanupError.message,
        );

        process.exitCode = 1;
      }
    }

    if (!testPassed && process.exitCode !== 1) {
      process.exitCode = 1;
    }
  }
}

runTest().catch((error) => {
  console.error("Unexpected test runner failure:", error);
  process.exitCode = 1;
});
