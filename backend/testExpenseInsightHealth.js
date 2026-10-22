const path = require("node:path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const assert = require("node:assert/strict");

// ============================================================
// PHASE 4.6.7 - EXPENSE HEALTH & CONFIDENCE TEST
// ============================================================

// Load the dedicated test environment.
dotenv.config({
  path: path.resolve(__dirname, ".env.test"),
  override: true,
});

const connectDB = require("./src/config/db");

const {
  calculateExpenseHealthScore,
  calculateExpenseConfidence,
  calculateSpendingTrendScore,
  calculateAnomalyScore,
  calculateCategoryConcentrationScore,
  calculateMaintenanceVarianceScore,
  calculatePendingPaymentScore,
} = require("./src/services/expenseInsightService");

const EXPECTED_DATABASE_NAME = "nri_property_test";

function printSection(title) {
  console.log("\n----------------------------------------------");
  console.log(title);
  console.log("----------------------------------------------");
}

function printPass(message) {
  console.log(`[PASS] ${message}`);
}

async function runTest() {
  let testPassed = false;

  try {
    console.log("\n==============================================");
    console.log("PHASE 4.6.7 - EXPENSE HEALTH & CONFIDENCE TEST");
    console.log("==============================================");

    // ----------------------------------------------------------
    // SAFETY CHECKS
    // ----------------------------------------------------------

    assert.equal(
      process.env.NODE_ENV,
      "test",
      "Refusing to run: NODE_ENV must be test",
    );

    assert.ok(process.env.MONGODB_URI, "MONGODB_URI is missing from .env.test");

    const configuredDatabase = new URL(
      process.env.MONGODB_URI,
    ).pathname.replace(/^\/+/, "");

    assert.equal(
      configuredDatabase,
      EXPECTED_DATABASE_NAME,
      `Refusing to run against database "${configuredDatabase}". Expected "${EXPECTED_DATABASE_NAME}".`,
    );

    console.log("Environment: TEST");
    console.log(`Expected database: ${EXPECTED_DATABASE_NAME}`);

    // ----------------------------------------------------------
    // CONNECT TO THE TEST DATABASE
    // ----------------------------------------------------------

    await connectDB();

    assert.equal(
      mongoose.connection.name,
      EXPECTED_DATABASE_NAME,
      "Connected database does not match the expected test database",
    );

    console.log(`Connected database: ${mongoose.connection.name}`);
    printPass("Test database safety checks passed");

    // ----------------------------------------------------------
    // TEST DATA
    // ----------------------------------------------------------

    const overview = {
      totalExpenses: 9,
      totalAmount: 98000,
      averageExpense: 10888.89,
      highestExpense: 45000,
      lowestExpense: 2500,
      paidAmount: 49400,
      pendingAmount: 48600,
    };

    const trends = {
      direction: "INCREASING",
      changePercent: 1630.77,
      currentPeriodAmount: 45000,
      previousPeriodAmount: 2600,
    };

    const categories = {
      categories: [
        {
          category: "REPAIR",
          totalAmount: 77500,
          expenseCount: 3,
          averageExpense: 25833.33,
          percentageOfTotal: 79.08,
        },
      ],
      dominantCategory: {
        category: "REPAIR",
        totalAmount: 77500,
        expenseCount: 3,
        averageExpense: 25833.33,
        percentageOfTotal: 79.08,
      },
      concentrationPercent: 79.08,
    };

    const anomalies = {
      detected: true,
      method: "Z_SCORE",
      meanExpense: 10888.89,
      standardDeviation: 13200,
      anomalies: [
        {
          title: "Emergency Structural Repair",
          amount: 45000,
          severity: "HIGH",
        },
      ],
      confidence: "MEDIUM",
    };

    const recurringAnalysis = {
      detected: true,
      patterns: [
        {
          category: "ELECTRICITY",
          titlePattern: "monthly electricity bill",
          occurrences: 3,
          averageAmount: 3400,
          confidence: "MEDIUM",
        },
      ],
      confidence: "MEDIUM",
    };

    const maintenanceAnalysis = {
      linkedExpenseCount: 1,
      totalMaintenanceExpense: 28000,
      maintenanceExpensePercentage: 28.57,
      requestsAnalyzed: 1,
      requestsWithCostData: 1,
      overruns: [],
      totalEstimatedCost: 30000,
      totalActualCost: 0,
      totalVariance: 0,
      variancePercent: 0,
    };

    // ----------------------------------------------------------
    // INDIVIDUAL HEALTH FACTORS
    // ----------------------------------------------------------

    printSection("INDIVIDUAL HEALTH FACTOR TESTS");

    const spendingTrendScore = calculateSpendingTrendScore(trends);

    console.log(`Spending trend score: ${spendingTrendScore}/25`);
    assert.equal(spendingTrendScore, 0, "Unexpected spending trend score");
    printPass("Spending trend factor");

    const anomalyScore = calculateAnomalyScore(anomalies);

    console.log(`Anomaly score: ${anomalyScore}/25`);
    assert.equal(anomalyScore, 15, "Unexpected anomaly score");
    printPass("Anomaly factor");

    const categoryScore = calculateCategoryConcentrationScore(categories);

    console.log(`Category concentration score: ${categoryScore}/15`);
    assert.equal(categoryScore, 0, "Unexpected category concentration score");
    printPass("Category concentration factor");

    const maintenanceScore =
      calculateMaintenanceVarianceScore(maintenanceAnalysis);

    console.log(`Maintenance variance score: ${maintenanceScore}/20`);
    assert.equal(maintenanceScore, 20, "Unexpected maintenance variance score");
    printPass("Maintenance variance factor");

    const pendingScore = calculatePendingPaymentScore(overview);

    console.log(`Pending payment score: ${pendingScore}/15`);
    assert.equal(pendingScore, 5, "Unexpected pending payment score");
    printPass("Pending payment factor");

    // ----------------------------------------------------------
    // COMPLETE HEALTH SCORE
    // ----------------------------------------------------------

    printSection("COMPLETE HEALTH SCORE");

    const healthScore = calculateExpenseHealthScore({
      overview,
      trends,
      categories,
      anomalies,
      maintenanceAnalysis,
    });

    assert.ok(
      healthScore && typeof healthScore === "object",
      "Health score result is invalid",
    );

    assert.equal(
      typeof healthScore.score,
      "number",
      "Health score must be numeric",
    );

    assert.ok(healthScore.factors, "Health score factors are missing");

    console.dir(healthScore, { depth: null });

    const expectedScore =
      spendingTrendScore +
      anomalyScore +
      categoryScore +
      maintenanceScore +
      pendingScore;

    console.log(`Expected health score: ${expectedScore}`);
    console.log(`Actual health score: ${healthScore.score}`);

    assert.equal(
      healthScore.score,
      expectedScore,
      "Health score does not equal the sum of its factors",
    );

    assert.equal(
      healthScore.level,
      "CONCERNING",
      `Expected CONCERNING health level, received ${healthScore.level}`,
    );

    printPass("Complete health score");

    // ----------------------------------------------------------
    // CONFIDENCE SCORE
    // ----------------------------------------------------------

    printSection("CONFIDENCE SCORE");

    const confidence = calculateExpenseConfidence({
      expenseCount: 9,
      anomalyAnalysis: anomalies,
      recurringAnalysis,
      maintenanceAnalysis,
    });

    assert.ok(
      confidence && typeof confidence === "object",
      "Confidence result is invalid",
    );

    assert.equal(
      typeof confidence.score,
      "number",
      "Confidence score must be numeric",
    );

    console.dir(confidence, { depth: null });

    assert.equal(
      confidence.score,
      71,
      `Expected confidence score 71, received ${confidence.score}`,
    );

    assert.equal(
      confidence.level,
      "MEDIUM",
      `Expected MEDIUM confidence, received ${confidence.level}`,
    );

    printPass("Expense confidence score");

    // ----------------------------------------------------------
    // FACTOR CONSISTENCY
    // ----------------------------------------------------------

    printSection("FACTOR CONSISTENCY VALIDATION");

    const factorChecks = [
      ["spendingTrend", spendingTrendScore],
      ["anomalyLevel", anomalyScore],
      ["categoryConcentration", categoryScore],
      ["maintenanceCostVariance", maintenanceScore],
      ["pendingPaymentBurden", pendingScore],
    ];

    for (const [factorName, expectedFactorScore] of factorChecks) {
      assert.ok(
        healthScore.factors[factorName],
        `Missing health factor: ${factorName}`,
      );

      assert.equal(
        healthScore.factors[factorName].score,
        expectedFactorScore,
        `Factor mismatch: ${factorName}`,
      );

      printPass(`${factorName} factor consistency`);
    }

    // ----------------------------------------------------------
    // FINAL SUMMARY
    // ----------------------------------------------------------

    console.log("\n==============================================");
    console.log("PHASE 4.6.7 TEST SUMMARY");
    console.log("==============================================");

    console.log(
      `Health Score: ${healthScore.score}/100 - ${healthScore.level}`,
    );

    console.log(`Confidence: ${confidence.score}/100 - ${confidence.level}`);

    console.log("\nFactor Summary:");
    console.log(`Spending Trend:         ${spendingTrendScore}/25`);
    console.log(`Anomaly Level:          ${anomalyScore}/25`);
    console.log(`Category Concentration: ${categoryScore}/15`);
    console.log(`Maintenance Variance:   ${maintenanceScore}/20`);
    console.log(`Pending Payments:       ${pendingScore}/15`);

    console.log("\nPASS: ALL PHASE 4.6.7 VALIDATIONS PASSED");
    console.log("==============================================");

    testPassed = true;
  } catch (error) {
    console.error("\nFAIL: PHASE 4.6.7 TEST FAILED");
    console.error(error.stack || error);
    process.exitCode = 1;
  } finally {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log("\nMongoDB connection closed.");
      }
    } catch (disconnectError) {
      console.error(
        "Failed to close MongoDB connection:",
        disconnectError.message,
      );
      process.exitCode = 1;
    }

    if (!testPassed) {
      console.error("Phase 4.6.7 validation did not complete successfully.");
    }
  }
}

runTest().catch((error) => {
  console.error("Unexpected test runner failure:", error);
  process.exitCode = 1;
});
