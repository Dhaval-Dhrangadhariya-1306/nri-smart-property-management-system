const assert = require("node:assert/strict");

const {
  generateActionableExpenseInsights,
} = require("./src/services/expenseInsightService");

// ============================================================
// PHASE 4.6.8 - ACTIONABLE EXPENSE INSIGHTS TEST
// ============================================================

const PASS = "PASS";
const FAIL = "FAIL";

function logTest(name) {
  console.log(`\n----------------------------------------------`);
  console.log(name);
}

function logPass(message) {
  console.log(`[${PASS}] ${message}`);
}

function hasInsight(result, type) {
  return result.insights.some((insight) => insight.type === type);
}

function runTests() {
  console.log("\n==============================================");
  console.log("PHASE 4.6.8 - ACTIONABLE EXPENSE INSIGHTS");
  console.log("==============================================");

  // ----------------------------------------------------------
  // TEST FIXTURES
  // ----------------------------------------------------------

  const overview = {
    totalExpenses: 10,
    totalAmount: 100000,
    averageExpense: 10000,
    highestExpense: 50000,
    lowestExpense: 2000,
    paidAmount: 30000,
    pendingAmount: 70000,
  };

  const trends = {
    direction: "INCREASING",
    changePercent: 150,
    currentPeriodAmount: 50000,
    previousPeriodAmount: 20000,
  };

  const categories = {
    categories: [
      {
        category: "REPAIR",
        totalAmount: 80000,
        expenseCount: 3,
        averageExpense: 26666.67,
        percentageOfTotal: 80,
      },
      {
        category: "ELECTRICITY",
        totalAmount: 20000,
        expenseCount: 7,
        averageExpense: 2857.14,
        percentageOfTotal: 20,
      },
    ],
    dominantCategory: {
      category: "REPAIR",
      totalAmount: 80000,
      expenseCount: 3,
      averageExpense: 26666.67,
      percentageOfTotal: 80,
    },
    concentrationPercent: 80,
  };

  const anomalies = {
    detected: true,
    method: "Z_SCORE",
    meanExpense: 10000,
    standardDeviation: 12000,
    confidence: "MEDIUM",
    anomalies: [
      {
        expenseId: "test-expense-1",
        title: "Emergency Structural Repair",
        category: "REPAIR",
        amount: 50000,
        zScore: 3.2,
        severity: "HIGH",
        percentageAboveMean: 400,
      },
    ],
  };

  const recurringAnalysis = {
    detected: true,
    confidence: "MEDIUM",
    patterns: [
      {
        category: "ELECTRICITY",
        titlePattern: "monthly electricity bill",
        occurrences: 3,
        averageAmount: 3400,
        minimumAmount: 3200,
        maximumAmount: 3600,
        amountVariationPercent: 11.76,
        averageIntervalDays: 31,
        confidence: "MEDIUM",
      },
    ],
  };

  const maintenanceAnalysis = {
    linkedExpenseCount: 2,
    totalMaintenanceExpense: 50000,
    maintenanceExpensePercentage: 50,
    requestsAnalyzed: 2,
    requestsWithCostData: 2,
    overruns: [
      {
        maintenanceRequestId: "maintenance-1",
        title: "Structural Repair",
        category: "STRUCTURAL",
        priority: "HIGH",
        status: "COMPLETED",
        estimatedCost: 30000,
        actualCost: 50000,
        variance: 20000,
        variancePercent: 66.67,
      },
    ],
    totalEstimatedCost: 30000,
    totalActualCost: 50000,
    totalVariance: 20000,
    variancePercent: 66.67,
  };

  const vendorAnalysis = {
    vendorCount: 2,
    totalVendorExpense: 50000,
    vendors: [
      {
        vendorId: "vendor-1",
        totalExpense: 30000,
        jobCount: 1,
        averageExpensePerJob: 30000,
        totalEstimatedCost: 25000,
        totalActualCost: 30000,
        variance: 5000,
        variancePercent: 20,
      },
      {
        vendorId: "vendor-2",
        totalExpense: 20000,
        jobCount: 1,
        averageExpensePerJob: 20000,
        totalEstimatedCost: 20000,
        totalActualCost: 20000,
        variance: 0,
        variancePercent: 0,
      },
    ],
  };

  const healthScore = {
    score: 20,
    level: "CRITICAL",
    factors: {
      spendingTrend: { score: 0, maxScore: 25 },
      anomalyLevel: { score: 15, maxScore: 25 },
      categoryConcentration: { score: 0, maxScore: 15 },
      maintenanceCostVariance: { score: 0, maxScore: 20 },
      pendingPaymentBurden: { score: 0, maxScore: 15 },
    },
  };

  const confidence = {
    score: 60,
    level: "MEDIUM",
    dataPoints: {
      expenseCount: 10,
      anomalyAnalysisAvailable: true,
      recurringAnalysisAvailable: true,
      maintenanceCostDataAvailable: true,
    },
  };

  // ----------------------------------------------------------
  // GENERATE INSIGHTS
  // ----------------------------------------------------------

  const result = generateActionableExpenseInsights({
    overview,
    trends,
    categories,
    anomalies,
    recurringAnalysis,
    maintenanceAnalysis,
    vendorAnalysis,
    healthScore,
    confidence,
  });

  assert.ok(
    result && typeof result === "object",
    "Insight service returned an invalid result",
  );

  assert.ok(Array.isArray(result.insights), "result.insights must be an array");

  assert.equal(
    result.count,
    result.insights.length,
    "Insight count does not match the insights array",
  );

  assert.ok(
    result.insights.every(
      (insight) =>
        insight &&
        typeof insight.type === "string" &&
        typeof insight.priority === "number",
    ),
    "Each insight must have a type and numeric priority",
  );

  console.log(`\nTotal insights generated: ${result.count}`);

  result.insights.forEach((insight, index) => {
    console.log(`${index + 1}. [${insight.severity}] ${insight.title}`);
    console.log(`   Type: ${insight.type}`);
    console.log(`   Priority: ${insight.priority}`);
    console.log(`   Message: ${insight.message}`);
    console.log(`   Recommendation: ${insight.recommendation}`);
  });

  // ----------------------------------------------------------
  // TEST 1 - HEALTH SCORE
  // ----------------------------------------------------------

  logTest("TEST 1: Expense Health Insight");

  assert.ok(
    hasInsight(result, "HEALTH_SCORE"),
    "HEALTH_SCORE insight was not generated",
  );

  assert.equal(
    result.insights.find((item) => item.type === "HEALTH_SCORE").severity,
    "CRITICAL",
    "Critical health should generate CRITICAL severity",
  );

  logPass("Health score insight passed");

  // ----------------------------------------------------------
  // TEST 2 - SPENDING TREND
  // ----------------------------------------------------------

  logTest("TEST 2: Spending Trend Insight");

  assert.ok(
    hasInsight(result, "SPENDING_TREND"),
    "SPENDING_TREND insight was not generated",
  );

  assert.equal(
    result.insights.find((item) => item.type === "SPENDING_TREND").severity,
    "HIGH",
    "A 150% increase should generate HIGH severity",
  );

  logPass("Spending trend insight passed");

  // ----------------------------------------------------------
  // TEST 3 - CATEGORY CONCENTRATION
  // ----------------------------------------------------------

  logTest("TEST 3: Category Concentration");

  assert.ok(
    hasInsight(result, "CATEGORY_CONCENTRATION"),
    "CATEGORY_CONCENTRATION insight was not generated",
  );

  assert.equal(
    result.insights.find((item) => item.type === "CATEGORY_CONCENTRATION")
      .severity,
    "HIGH",
    "80% concentration should generate HIGH severity",
  );

  logPass("Category concentration passed");

  // ----------------------------------------------------------
  // TEST 4 - ANOMALY
  // ----------------------------------------------------------

  logTest("TEST 4: Expense Anomaly");

  assert.ok(hasInsight(result, "ANOMALY"), "ANOMALY insight was not generated");

  assert.equal(
    result.insights.find((item) => item.type === "ANOMALY").severity,
    "HIGH",
    "A HIGH anomaly should generate HIGH severity",
  );

  logPass("Anomaly insight passed");

  // ----------------------------------------------------------
  // TEST 5 - RECURRING EXPENSE
  // ----------------------------------------------------------

  logTest("TEST 5: Recurring Expense");

  assert.ok(
    hasInsight(result, "RECURRING_EXPENSE"),
    "RECURRING_EXPENSE insight was not generated",
  );

  logPass("Recurring expense insight passed");

  // ----------------------------------------------------------
  // TEST 6 - PENDING PAYMENTS
  // ----------------------------------------------------------

  logTest("TEST 6: Pending Payments");

  assert.ok(
    hasInsight(result, "PENDING_PAYMENTS"),
    "PENDING_PAYMENTS insight was not generated",
  );

  assert.equal(
    result.insights.find((item) => item.type === "PENDING_PAYMENTS").severity,
    "CRITICAL",
    "A 70% pending payment burden should generate CRITICAL severity",
  );

  logPass("Pending payment insight passed");

  // ----------------------------------------------------------
  // TEST 7 - MAINTENANCE COST
  // ----------------------------------------------------------

  logTest("TEST 7: Maintenance Cost Overrun");

  assert.ok(
    hasInsight(result, "MAINTENANCE_COST"),
    "MAINTENANCE_COST insight was not generated",
  );

  assert.equal(
    result.insights.find((item) => item.type === "MAINTENANCE_COST").severity,
    "HIGH",
    "A 66.67% maintenance overrun should generate HIGH severity",
  );

  logPass("Maintenance cost insight passed");

  // ----------------------------------------------------------
  // TEST 8 - VENDOR COST
  // ----------------------------------------------------------

  logTest("TEST 8: Vendor Cost");

  assert.ok(
    hasInsight(result, "VENDOR_COST"),
    "VENDOR_COST insight was not generated",
  );

  logPass("Vendor cost insight passed");

  // ----------------------------------------------------------
  // TEST 9 - DATA CONFIDENCE
  // ----------------------------------------------------------

  logTest("TEST 9: Data Confidence");

  assert.ok(
    hasInsight(result, "DATA_CONFIDENCE"),
    "DATA_CONFIDENCE insight was not generated",
  );

  logPass("Data confidence insight passed");

  // ----------------------------------------------------------
  // TEST 10 - PRIORITY SORTING
  // ----------------------------------------------------------

  logTest("TEST 10: Insight Priority Sorting");

  for (let i = 1; i < result.insights.length; i += 1) {
    assert.ok(
      result.insights[i - 1].priority <= result.insights[i].priority,
      "Insights are not sorted by ascending priority",
    );
  }

  logPass("Priority sorting passed");

  // ----------------------------------------------------------
  // FINAL SUMMARY
  // ----------------------------------------------------------

  const expectedTypes = [
    "HEALTH_SCORE",
    "SPENDING_TREND",
    "CATEGORY_CONCENTRATION",
    "ANOMALY",
    "RECURRING_EXPENSE",
    "PENDING_PAYMENTS",
    "MAINTENANCE_COST",
    "VENDOR_COST",
    "DATA_CONFIDENCE",
  ];

  console.log("\n==============================================");
  console.log("PHASE 4.6.8 TEST SUMMARY");
  console.log("==============================================");
  console.log(`Total insights: ${result.count}`);

  for (const type of expectedTypes) {
    console.log(`${type}: ${hasInsight(result, type) ? PASS : FAIL}`);
  }

  console.log("\nPASS: ALL PHASE 4.6.8 VALIDATIONS PASSED");
  console.log("==============================================\n");
}

try {
  runTests();
} catch (error) {
  console.error("\nFAIL: Phase 4.6.8 validation failed.");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
}
