const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateOverview,
  calculateCategoryAnalysis,
  calculateTrendSummary,
  buildMonthlyTrend,
  calculateMean,
  calculateStandardDeviation,
  detectExpenseAnomalies,
  detectRecurringExpenses,
  normalizeExpenseTitle,
  calculateMaintenanceCostAnalysis,
  calculateVendorCostAnalysis,
  getHealthLevel,
  calculateSpendingTrendScore,
  calculateAnomalyScore,
  calculateCategoryConcentrationScore,
  calculateMaintenanceVarianceScore,
  calculatePendingPaymentScore,
  calculateExpenseHealthScore,
  getConfidenceLevel,
  calculateExpenseConfidence,
  generateActionableExpenseInsights,
} = require("../src/services/expenseInsightService");

// ============================================================
// TEST DATA
// ============================================================

const expenses = [
  {
    _id: "expense-1",
    title: "Electricity Bill January",
    description: "Monthly electricity bill",
    category: "ELECTRICITY",
    amount: 3200,
    expenseDate: new Date("2026-01-15"),
    paymentStatus: "PAID",
    paidBy: "OWNER",
    paymentMethod: "BANK_TRANSFER",
  },
  {
    _id: "expense-2",
    title: "Electricity Bill February",
    description: "Monthly electricity bill",
    category: "ELECTRICITY",
    amount: 3400,
    expenseDate: new Date("2026-02-15"),
    paymentStatus: "PAID",
    paidBy: "OWNER",
    paymentMethod: "BANK_TRANSFER",
  },
  {
    _id: "expense-3",
    title: "Repair Plumbing",
    description: "Plumbing repair",
    category: "REPAIR",
    amount: 4500,
    expenseDate: new Date("2026-03-10"),
    paymentStatus: "PAID",
    paidBy: "OWNER",
    paymentMethod: "UPI",
  },
  {
    _id: "expense-4",
    title: "Monthly Cleaning",
    description: "Property cleaning",
    category: "CLEANING",
    amount: 2500,
    expenseDate: new Date("2026-04-05"),
    paymentStatus: "PAID",
    paidBy: "OWNER",
    paymentMethod: "CASH",
  },
  {
    _id: "expense-5",
    title: "Electricity Bill May",
    description: "Monthly electricity bill",
    category: "ELECTRICITY",
    amount: 3600,
    expenseDate: new Date("2026-05-15"),
    paymentStatus: "PENDING",
    paidBy: "OWNER",
    paymentMethod: "BANK_TRANSFER",
  },
  {
    _id: "expense-6",
    title: "Security Service",
    description: "Security service payment",
    category: "SECURITY",
    amount: 5200,
    expenseDate: new Date("2026-06-20"),
    paymentStatus: "PAID",
    paidBy: "OWNER",
    paymentMethod: "BANK_TRANSFER",
  },
  {
    _id: "expense-7",
    title: "Monthly Cleaning",
    description: "Property cleaning",
    category: "CLEANING",
    amount: 2600,
    expenseDate: new Date("2026-07-05"),
    paymentStatus: "PAID",
    paidBy: "OWNER",
    paymentMethod: "CASH",
  },
  {
    _id: "expense-8",
    title: "Emergency Structural Repair",
    description: "Major structural repair",
    category: "REPAIR",
    amount: 45000,
    expenseDate: new Date("2026-08-18"),
    paymentStatus: "PARTIALLY_PAID",
    paidBy: "OWNER",
    paymentMethod: "BANK_TRANSFER",
  },
];

// ============================================================
// BASIC CALCULATION TESTS
// ============================================================

test("calculateMean should calculate the arithmetic mean", () => {
  assert.equal(calculateMean([100, 200, 300]), 200);
});

test("calculateMean should return 0 for an empty array", () => {
  assert.equal(calculateMean([]), 0);
});

test("calculateStandardDeviation should return a numeric result", () => {
  const result = calculateStandardDeviation([10, 20, 30]);

  assert.equal(typeof result, "number");
});

test("calculateStandardDeviation should handle repeated values", () => {
  const result = calculateStandardDeviation([100, 100, 100]);

  assert.equal(typeof result, "number");
});

// ============================================================
// OVERVIEW
// ============================================================

test("calculateOverview should calculate expense totals correctly", () => {
  const result = calculateOverview(expenses);

  assert.equal(result.totalExpenses, 8);
  assert.equal(result.totalAmount, 70000);
  assert.equal(result.averageExpense, 8750);
  assert.equal(result.highestExpense, 45000);
  assert.equal(result.lowestExpense, 2500);
});

test("calculateOverview should calculate payment status totals", () => {
  const result = calculateOverview(expenses);

  assert.equal(result.paidAmount, 21400);
  assert.equal(result.pendingAmount, 48600);
});

// ============================================================
// CATEGORY ANALYSIS
// ============================================================

test("calculateCategoryAnalysis should group expenses by category", () => {
  const result = calculateCategoryAnalysis(expenses);

  assert.ok(Array.isArray(result.categories));

  const electricity = result.categories.find(
    (item) => item.category === "ELECTRICITY",
  );

  const repair = result.categories.find((item) => item.category === "REPAIR");

  assert.ok(electricity);
  assert.ok(repair);

  assert.equal(electricity.totalAmount, 10200);
  assert.equal(repair.totalAmount, 49500);

  assert.equal(electricity.expenseCount, 3);
  assert.equal(repair.expenseCount, 2);
});

test("calculateCategoryAnalysis should calculate category percentages", () => {
  const result = calculateCategoryAnalysis(expenses);

  const repair = result.categories.find((item) => item.category === "REPAIR");

  assert.ok(repair);

  assert.equal(repair.percentageOfTotal, 70.71);
});

// ============================================================
// MONTHLY TREND
// ============================================================

test("buildMonthlyTrend should create monthly expense buckets", () => {
  const result = buildMonthlyTrend(expenses);

  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0);
});

test("buildMonthlyTrend should include January expense", () => {
  const result = buildMonthlyTrend(expenses);

  const january = result.find(
    (item) =>
      String(item.month).includes("2026-01") ||
      String(item.label).includes("Jan"),
  );

  assert.ok(january);
});

test("calculateTrendSummary should return a trend summary", () => {
  const monthlyTrend = buildMonthlyTrend(expenses);

  const result = calculateTrendSummary(monthlyTrend);

  assert.ok(result);
  assert.equal(typeof result, "object");
});

// ============================================================
// NORMALIZATION
// ============================================================

test("normalizeExpenseTitle should normalize expense titles", () => {
  const result = normalizeExpenseTitle("  Monthly Electricity Bill  ");

  assert.equal(typeof result, "string");
  assert.equal(result, result.toLowerCase());
});

// ============================================================
// ANOMALY DETECTION
// ============================================================

test("detectExpenseAnomalies should return an anomaly analysis object", () => {
  const result = detectExpenseAnomalies(expenses);

  assert.ok(result);
  assert.equal(typeof result, "object");
});

test("detectExpenseAnomalies should identify anomaly analysis data", () => {
  const result = detectExpenseAnomalies(expenses);

  assert.ok(
    result.anomalies ||
      result.items ||
      result.detected ||
      result.anomalyCount !== undefined,
  );
});

// ============================================================
// RECURRING EXPENSES
// ============================================================

test("detectRecurringExpenses should return recurring expense analysis", () => {
  const result = detectRecurringExpenses(expenses);

  assert.ok(result);
  assert.equal(typeof result, "object");
});

test("detectRecurringExpenses should detect repeated electricity expenses", () => {
  const result = detectRecurringExpenses(expenses);

  const serialized = JSON.stringify(result).toLowerCase();

  assert.ok(serialized.includes("electricity"));
});

// ============================================================
// MAINTENANCE ANALYSIS
// ============================================================

test("calculateMaintenanceCostAnalysis should return an analysis object", () => {
  const result = calculateMaintenanceCostAnalysis([]);

  assert.ok(result);
  assert.equal(typeof result, "object");
});

// ============================================================
// VENDOR ANALYSIS
// ============================================================

test("calculateVendorCostAnalysis should return an analysis object", () => {
  const result = calculateVendorCostAnalysis([]);

  assert.ok(result);
  assert.equal(typeof result, "object");
});

// ============================================================
// HEALTH SCORE HELPERS
// ============================================================

test("getHealthLevel should return a valid health level", () => {
  assert.ok(getHealthLevel(90));
  assert.ok(getHealthLevel(60));
  assert.ok(getHealthLevel(30));
});

test("calculateSpendingTrendScore should return a numeric score", () => {
  const result = calculateSpendingTrendScore({
    trend: "STABLE",
  });

  assert.equal(typeof result, "number");
});

test("calculateAnomalyScore should return a numeric score", () => {
  const result = calculateAnomalyScore({
    anomalyCount: 0,
  });

  assert.equal(typeof result, "number");
});

test("calculateCategoryConcentrationScore should return a numeric score", () => {
  const result = calculateCategoryConcentrationScore([]);

  assert.equal(typeof result, "number");
});

test("calculateMaintenanceVarianceScore should return a numeric score", () => {
  const result = calculateMaintenanceVarianceScore({
    variance: 0,
  });

  assert.equal(typeof result, "number");
});

test("calculatePendingPaymentScore should return a numeric score", () => {
  const result = calculatePendingPaymentScore({
    pendingAmount: 0,
    totalAmount: 10000,
  });

  assert.equal(typeof result, "number");
});

test("calculateExpenseHealthScore should return a structured health result", () => {
  const result = calculateExpenseHealthScore({
    spendingTrendScore: 0,
    anomalyScore: 0,
    categoryConcentrationScore: 0,
    maintenanceVarianceScore: 0,
    pendingPaymentScore: 0,
  });

  assert.equal(typeof result, "object");

  assert.equal(typeof result.score, "number");
  assert.equal(typeof result.level, "string");

  assert.ok(result.score >= 0);
  assert.ok(result.score <= 100);

  assert.ok(result.factors);
});

// ============================================================
// CONFIDENCE
// ============================================================

test("getConfidenceLevel should return a valid confidence level", () => {
  assert.ok(getConfidenceLevel(90));
  assert.ok(getConfidenceLevel(60));
  assert.ok(getConfidenceLevel(20));
});

test("calculateExpenseConfidence should return a structured confidence result", () => {
  const result = calculateExpenseConfidence({
    expenseCount: 10,
  });

  assert.equal(typeof result, "object");

  assert.equal(typeof result.score, "number");
  assert.equal(typeof result.level, "string");

  assert.ok(result.score >= 0);
  assert.ok(result.score <= 100);

  assert.ok(result.dataPoints);
  assert.equal(result.dataPoints.expenseCount, 10);
});

// ============================================================
// ACTIONABLE INSIGHTS
// ============================================================

test("generateActionableExpenseInsights should return structured insights", () => {
  const result = generateActionableExpenseInsights({
    overview: {},
    categories: {},
    anomalies: {},
    recurringExpenses: {},
    maintenanceAnalysis: {},
    vendorAnalysis: {},
    healthScore: {
      score: 70,
      level: "MODERATE",
    },
    confidence: {
      score: 70,
      level: "MEDIUM",
    },
  });

  assert.equal(typeof result, "object");

  assert.equal(typeof result.count, "number");
  assert.ok(Array.isArray(result.insights));

  assert.equal(result.count, result.insights.length);
});
