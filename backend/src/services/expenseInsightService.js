const mongoose = require("mongoose");

const Expense = require("../models/Expense");
const Property = require("../models/Property");
const MaintenanceRequest = require("../models/MaintenanceRequest");

// ============================================================
// CONSTANTS
// ============================================================

const PERIODS = {
  "3M": 3,
  "6M": 6,
  "12M": 12,
};

const MIN_ANOMALY_DATA = 5;
const MIN_RECURRING_OCCURRENCES = 2;

const ANOMALY_THRESHOLDS = {
  HIGH: 2.5,
  MEDIUM: 2,
};

const RECURRING_RULES = {
  MIN_INTERVAL_DAYS: 20,
  MAX_INTERVAL_DAYS: 40,
  MAX_AMOUNT_VARIATION_PERCENT: 20,
};

// ============================================================
// GENERAL HELPERS
// ============================================================

const getPeriodMonths = (period) => {
  return PERIODS[period] || PERIODS["12M"];
};

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

// ============================================================
// DATE HELPERS
// ============================================================

const getStartDate = (months) => {
  const date = new Date();

  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - months);

  return date;
};

const getMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
};

const getMonthLabel = (date) => {
  return date.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
};

const getDaysBetween = (date1, date2) => {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return (
    Math.abs(new Date(date2).getTime() - new Date(date1).getTime()) /
    millisecondsPerDay
  );
};

// ============================================================
// SPENDING TREND
// ============================================================

const buildMonthlyTrend = (expenses, startDate, endDate) => {
  const monthlyMap = new Map();

  const cursor = new Date(startDate);

  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= endDate) {
    const key = getMonthKey(cursor);

    monthlyMap.set(key, {
      month: key,
      label: getMonthLabel(cursor),
      totalAmount: 0,
      expenseCount: 0,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const expense of expenses) {
    const expenseDate = new Date(expense.expenseDate);

    const key = getMonthKey(expenseDate);

    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, {
        month: key,
        label: getMonthLabel(expenseDate),
        totalAmount: 0,
        expenseCount: 0,
      });
    }

    const month = monthlyMap.get(key);

    month.totalAmount += Number(expense.amount) || 0;
    month.expenseCount += 1;
  }

  return Array.from(monthlyMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((month) => ({
      ...month,
      totalAmount: round(month.totalAmount),
    }));
};

// ============================================================
// TREND SUMMARY
// ============================================================

const calculateTrendSummary = (monthlyTrend) => {
  if (!monthlyTrend.length) {
    return {
      direction: "STABLE",
      changePercent: 0,
      currentPeriodAmount: 0,
      previousPeriodAmount: 0,
    };
  }

  const nonZeroMonths = monthlyTrend.filter((month) => month.totalAmount > 0);

  if (nonZeroMonths.length < 2) {
    return {
      direction: "STABLE",
      changePercent: 0,
      currentPeriodAmount: monthlyTrend.at(-1)?.totalAmount || 0,
      previousPeriodAmount: 0,
    };
  }

  const current = nonZeroMonths.at(-1).totalAmount;
  const previous = nonZeroMonths.at(-2).totalAmount;

  if (previous === 0) {
    return {
      direction: current > 0 ? "INCREASING" : "STABLE",
      changePercent: current > 0 ? 100 : 0,
      currentPeriodAmount: current,
      previousPeriodAmount: previous,
    };
  }

  const changePercent = round(((current - previous) / previous) * 100);

  let direction = "STABLE";

  if (changePercent > 5) {
    direction = "INCREASING";
  } else if (changePercent < -5) {
    direction = "DECREASING";
  }

  return {
    direction,
    changePercent,
    currentPeriodAmount: round(current),
    previousPeriodAmount: round(previous),
  };
};

// ============================================================
// OVERVIEW
// ============================================================

const calculateOverview = (expenses) => {
  if (!expenses.length) {
    return {
      totalExpenses: 0,
      totalAmount: 0,
      averageExpense: 0,
      highestExpense: 0,
      lowestExpense: 0,
      paidAmount: 0,
      pendingAmount: 0,
    };
  }

  const amounts = expenses.map((expense) => Number(expense.amount) || 0);

  const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);

  const paidAmount = expenses
    .filter((expense) => expense.paymentStatus === "PAID")
    .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

  const pendingAmount = expenses
    .filter((expense) =>
      ["PENDING", "PARTIALLY_PAID"].includes(expense.paymentStatus),
    )
    .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

  return {
    totalExpenses: expenses.length,
    totalAmount: round(totalAmount),
    averageExpense: round(totalAmount / expenses.length),
    highestExpense: round(Math.max(...amounts)),
    lowestExpense: round(Math.min(...amounts)),
    paidAmount: round(paidAmount),
    pendingAmount: round(pendingAmount),
  };
};

// ============================================================
// CATEGORY INTELLIGENCE
// ============================================================

const calculateCategoryAnalysis = (expenses) => {
  if (!expenses.length) {
    return {
      categories: [],
      dominantCategory: null,
      concentrationPercent: 0,
    };
  }

  const categoryMap = new Map();

  for (const expense of expenses) {
    const category = expense.category || "OTHER";
    const amount = Number(expense.amount) || 0;

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category,
        totalAmount: 0,
        expenseCount: 0,
      });
    }

    const categoryData = categoryMap.get(category);

    categoryData.totalAmount += amount;
    categoryData.expenseCount += 1;
  }

  const totalAmount = expenses.reduce(
    (sum, expense) => sum + (Number(expense.amount) || 0),
    0,
  );

  const categories = Array.from(categoryMap.values())
    .map((category) => {
      const percentageOfTotal =
        totalAmount > 0 ? (category.totalAmount / totalAmount) * 100 : 0;

      return {
        category: category.category,
        totalAmount: round(category.totalAmount),
        expenseCount: category.expenseCount,
        averageExpense: round(category.totalAmount / category.expenseCount),
        percentageOfTotal: round(percentageOfTotal),
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const dominantCategory = categories.length ? categories[0] : null;

  return {
    categories,
    dominantCategory,
    concentrationPercent: dominantCategory
      ? dominantCategory.percentageOfTotal
      : 0,
  };
};

// ============================================================
// STATISTICAL HELPERS
// ============================================================

const calculateMean = (values) => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const calculateStandardDeviation = (values, mean) => {
  if (values.length < 2) {
    return 0;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
};

// ============================================================
// ANOMALY SEVERITY
// ============================================================

const getAnomalySeverity = (zScore) => {
  const absoluteZScore = Math.abs(zScore);

  if (absoluteZScore >= ANOMALY_THRESHOLDS.HIGH) {
    return "HIGH";
  }

  if (absoluteZScore >= ANOMALY_THRESHOLDS.MEDIUM) {
    return "MEDIUM";
  }

  return null;
};

// ============================================================
// EXPENSE ANOMALY DETECTION
// ============================================================

const detectExpenseAnomalies = (expenses) => {
  if (expenses.length < MIN_ANOMALY_DATA) {
    return {
      detected: false,
      method: "Z_SCORE",
      meanExpense: 0,
      standardDeviation: 0,
      anomalies: [],
      confidence: "LOW",
      reason: `At least ${MIN_ANOMALY_DATA} expenses are required for statistical anomaly detection.`,
    };
  }

  const amounts = expenses.map((expense) => Number(expense.amount) || 0);

  const meanExpense = calculateMean(amounts);

  const standardDeviation = calculateStandardDeviation(amounts, meanExpense);

  if (standardDeviation === 0) {
    return {
      detected: false,
      method: "Z_SCORE",
      meanExpense: round(meanExpense),
      standardDeviation: 0,
      anomalies: [],
      confidence: "HIGH",
      reason: "No statistical variation exists between expense amounts.",
    };
  }

  const anomalies = [];

  for (const expense of expenses) {
    const amount = Number(expense.amount) || 0;

    const zScore = (amount - meanExpense) / standardDeviation;

    const severity = getAnomalySeverity(zScore);

    if (!severity) {
      continue;
    }

    const percentageAboveMean =
      meanExpense > 0 ? round(((amount - meanExpense) / meanExpense) * 100) : 0;

    anomalies.push({
      expenseId: expense._id,
      title: expense.title,
      category: expense.category,
      amount: round(amount),
      expenseDate: expense.expenseDate,
      zScore: round(zScore, 3),
      severity,
      percentageAboveMean,
      explanation:
        amount > meanExpense
          ? `This expense is ${Math.abs(
              percentageAboveMean,
            )}% above the average expense amount.`
          : "This expense is significantly below the average expense amount.",
    });
  }

  anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

  let confidence = "MEDIUM";

  if (expenses.length >= 10) {
    confidence = "HIGH";
  }

  return {
    detected: anomalies.length > 0,
    method: "Z_SCORE",
    meanExpense: round(meanExpense),
    standardDeviation: round(standardDeviation),
    anomalies,
    confidence,
    reason: anomalies.length
      ? `${anomalies.length} statistically unusual expense(s) detected.`
      : "No statistically significant expense anomalies detected.",
  };
};

// ============================================================
// RECURRING EXPENSE DETECTION
// ============================================================

const normalizeExpenseTitle = (title) => {
  return String(title || "")
    .toLowerCase()
    .replace(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/g,
      "",
    )
    .replace(/\b(jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/g, "")
    .replace(/\b(20\d{2})\b/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const calculateAmountVariationPercent = (firstAmount, secondAmount) => {
  const baseAmount = (firstAmount + secondAmount) / 2;

  if (baseAmount === 0) {
    return 0;
  }

  return Math.abs(((secondAmount - firstAmount) / baseAmount) * 100);
};

const getRecurringConfidence = ({
  occurrences,
  averageInterval,
  amountVariationPercent,
}) => {
  let score = 0;

  if (occurrences >= 3) {
    score += 2;
  } else {
    score += 1;
  }

  if (averageInterval >= 27 && averageInterval <= 33) {
    score += 2;
  } else {
    score += 1;
  }

  if (amountVariationPercent <= 10) {
    score += 2;
  } else if (amountVariationPercent <= 20) {
    score += 1;
  }

  if (score >= 6) {
    return "HIGH";
  }

  if (score >= 4) {
    return "MEDIUM";
  }

  return "LOW";
};

const detectRecurringExpenses = (expenses) => {
  if (expenses.length < MIN_RECURRING_OCCURRENCES) {
    return {
      detected: false,
      patterns: [],
      confidence: "LOW",
      reason:
        "At least two expenses are required for recurring expense analysis.",
    };
  }

  const groups = new Map();

  for (const expense of expenses) {
    const normalizedTitle = normalizeExpenseTitle(expense.title);

    const category = expense.category || "OTHER";

    const groupKey = `${category}:${normalizedTitle}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        category,
        normalizedTitle,
        expenses: [],
      });
    }

    groups.get(groupKey).expenses.push(expense);
  }

  const patterns = [];

  for (const group of groups.values()) {
    if (group.expenses.length < MIN_RECURRING_OCCURRENCES) {
      continue;
    }

    const sortedExpenses = [...group.expenses].sort(
      (a, b) => new Date(a.expenseDate) - new Date(b.expenseDate),
    );

    const intervals = [];

    for (let index = 1; index < sortedExpenses.length; index += 1) {
      const previous = sortedExpenses[index - 1];
      const current = sortedExpenses[index];

      const interval = getDaysBetween(
        previous.expenseDate,
        current.expenseDate,
      );

      intervals.push(interval);
    }

    if (!intervals.length) {
      continue;
    }

    const validIntervals = intervals.filter(
      (interval) =>
        interval >= RECURRING_RULES.MIN_INTERVAL_DAYS &&
        interval <= RECURRING_RULES.MAX_INTERVAL_DAYS,
    );

    if (!validIntervals.length) {
      continue;
    }

    const averageInterval = calculateMean(validIntervals);

    const amounts = sortedExpenses.map(
      (expense) => Number(expense.amount) || 0,
    );

    const averageAmount = calculateMean(amounts);

    const minimumAmount = Math.min(...amounts);
    const maximumAmount = Math.max(...amounts);

    const amountVariationPercent = calculateAmountVariationPercent(
      minimumAmount,
      maximumAmount,
    );

    if (amountVariationPercent > RECURRING_RULES.MAX_AMOUNT_VARIATION_PERCENT) {
      continue;
    }

    const confidence = getRecurringConfidence({
      occurrences: sortedExpenses.length,
      averageInterval,
      amountVariationPercent,
    });

    patterns.push({
      category: group.category,
      titlePattern: group.normalizedTitle,
      occurrences: sortedExpenses.length,
      averageAmount: round(averageAmount),
      minimumAmount: round(minimumAmount),
      maximumAmount: round(maximumAmount),
      amountVariationPercent: round(amountVariationPercent),
      averageIntervalDays: round(averageInterval),
      confidence,
      expenses: sortedExpenses.map((expense) => ({
        expenseId: expense._id,
        title: expense.title,
        amount: round(Number(expense.amount) || 0),
        expenseDate: expense.expenseDate,
      })),
    });
  }

  patterns.sort((a, b) => b.occurrences - a.occurrences);

  return {
    detected: patterns.length > 0,
    patterns,
    confidence: patterns.length
      ? patterns.some((pattern) => pattern.confidence === "HIGH")
        ? "HIGH"
        : "MEDIUM"
      : "LOW",
    reason: patterns.length
      ? `${patterns.length} recurring expense pattern(s) detected.`
      : "No reliable recurring expense patterns detected.",
  };
};

// ============================================================
// MAINTENANCE COST INTELLIGENCE
// ============================================================

const calculateMaintenanceCostAnalysis = async (expenses) => {
  const linkedExpenses = expenses.filter(
    (expense) => expense.maintenanceRequest,
  );

  if (!linkedExpenses.length) {
    return {
      linkedExpenseCount: 0,
      totalMaintenanceExpense: 0,
      maintenanceExpensePercentage: 0,
      requestsAnalyzed: 0,
      requestsWithCostData: 0,
      overruns: [],
      totalEstimatedCost: 0,
      totalActualCost: 0,
      totalVariance: 0,
      variancePercent: 0,
    };
  }

  const maintenanceRequestIds = linkedExpenses.map(
    (expense) => expense.maintenanceRequest,
  );

  const maintenanceRequests = await MaintenanceRequest.find({
    _id: {
      $in: maintenanceRequestIds,
    },
  })
    .select(
      "_id title category priority status estimatedCost actualCost assignedVendor",
    )
    .lean();

  const requestMap = new Map(
    maintenanceRequests.map((request) => [request._id.toString(), request]),
  );

  let totalMaintenanceExpense = 0;
  let totalEstimatedCost = 0;
  let totalActualCost = 0;

  const analyzedRequests = new Map();

  for (const expense of linkedExpenses) {
    totalMaintenanceExpense += Number(expense.amount) || 0;

    const request = requestMap.get(expense.maintenanceRequest.toString());

    if (!request) {
      continue;
    }

    if (!analyzedRequests.has(request._id.toString())) {
      analyzedRequests.set(request._id.toString(), request);
    }
  }

  const overruns = [];
  let requestsWithCostData = 0;

  for (const request of analyzedRequests.values()) {
    const estimatedCost = Number(request.estimatedCost) || 0;

    const actualCost = Number(request.actualCost) || 0;

    const hasEstimatedCost = estimatedCost > 0;
    const hasActualCost = actualCost > 0;

    if (!hasEstimatedCost && !hasActualCost) {
      continue;
    }

    requestsWithCostData += 1;

    totalEstimatedCost += estimatedCost;
    totalActualCost += actualCost;

    if (!hasActualCost) {
      continue;
    }

    const variance = actualCost - estimatedCost;

    const variancePercent =
      estimatedCost > 0 ? round((variance / estimatedCost) * 100) : 0;

    if (variance > 0) {
      overruns.push({
        maintenanceRequestId: request._id,
        title: request.title,
        category: request.category,
        priority: request.priority,
        status: request.status,
        estimatedCost: round(estimatedCost),
        actualCost: round(actualCost),
        variance: round(variance),
        variancePercent,
      });
    }
  }

  const totalExpenseAmount = expenses.reduce(
    (sum, expense) => sum + (Number(expense.amount) || 0),
    0,
  );

  const maintenanceExpensePercentage =
    totalExpenseAmount > 0
      ? round((totalMaintenanceExpense / totalExpenseAmount) * 100)
      : 0;

  const totalVariance =
    totalActualCost > 0 ? totalActualCost - totalEstimatedCost : 0;

  const variancePercent =
    totalEstimatedCost > 0 && totalActualCost > 0
      ? round((totalVariance / totalEstimatedCost) * 100)
      : 0;

  return {
    linkedExpenseCount: linkedExpenses.length,
    totalMaintenanceExpense: round(totalMaintenanceExpense),
    maintenanceExpensePercentage,
    requestsAnalyzed: analyzedRequests.size,
    requestsWithCostData,
    overruns,
    totalEstimatedCost: round(totalEstimatedCost),
    totalActualCost: round(totalActualCost),
    totalVariance: round(totalVariance),
    variancePercent,
  };
};

// ============================================================
// VENDOR COST INTELLIGENCE
// ============================================================

const calculateVendorCostAnalysis = async (expenses) => {
  const linkedExpenses = expenses.filter(
    (expense) => expense.maintenanceRequest,
  );

  if (!linkedExpenses.length) {
    return {
      vendors: [],
      vendorCount: 0,
      totalVendorExpense: 0,
    };
  }

  const maintenanceRequestIds = linkedExpenses.map(
    (expense) => expense.maintenanceRequest,
  );

  const maintenanceRequests = await MaintenanceRequest.find({
    _id: {
      $in: maintenanceRequestIds,
    },
    assignedVendor: {
      $ne: null,
    },
  })
    .select("_id assignedVendor estimatedCost actualCost")
    .lean();

  if (!maintenanceRequests.length) {
    return {
      vendors: [],
      vendorCount: 0,
      totalVendorExpense: 0,
    };
  }

  const requestMap = new Map(
    maintenanceRequests.map((request) => [request._id.toString(), request]),
  );

  const vendorMap = new Map();

  for (const expense of linkedExpenses) {
    const request = requestMap.get(expense.maintenanceRequest.toString());

    if (!request) {
      continue;
    }

    if (!request.assignedVendor) {
      continue;
    }

    const vendorId = request.assignedVendor.toString();

    if (!vendorMap.has(vendorId)) {
      vendorMap.set(vendorId, {
        vendorId: request.assignedVendor,
        totalExpense: 0,
        jobCount: new Set(),
        totalEstimatedCost: 0,
        totalActualCost: 0,
      });
    }

    const vendor = vendorMap.get(vendorId);

    vendor.totalExpense += Number(expense.amount) || 0;

    vendor.jobCount.add(request._id.toString());
  }

  for (const request of maintenanceRequests) {
    const vendorId = request.assignedVendor.toString();

    const vendor = vendorMap.get(vendorId);

    if (!vendor) {
      continue;
    }

    vendor.totalEstimatedCost += Number(request.estimatedCost) || 0;

    vendor.totalActualCost += Number(request.actualCost) || 0;
  }

  const vendors = Array.from(vendorMap.values())
    .map((vendor) => {
      const hasEstimatedCost = vendor.totalEstimatedCost > 0;

      const hasActualCost = vendor.totalActualCost > 0;

      const variance = hasActualCost
        ? vendor.totalActualCost - vendor.totalEstimatedCost
        : 0;

      const variancePercent =
        hasActualCost && hasEstimatedCost
          ? round((variance / vendor.totalEstimatedCost) * 100)
          : 0;

      const jobCount = vendor.jobCount.size;

      return {
        vendorId: vendor.vendorId,
        totalExpense: round(vendor.totalExpense),
        jobCount,
        averageExpensePerJob:
          jobCount > 0 ? round(vendor.totalExpense / jobCount) : 0,
        totalEstimatedCost: round(vendor.totalEstimatedCost),
        totalActualCost: round(vendor.totalActualCost),
        variance: round(variance),
        variancePercent,
      };
    })
    .sort((a, b) => b.totalExpense - a.totalExpense);

  const totalVendorExpense = vendors.reduce(
    (sum, vendor) => sum + vendor.totalExpense,
    0,
  );

  return {
    vendors,
    vendorCount: vendors.length,
    totalVendorExpense: round(totalVendorExpense),
  };
};

// ============================================================
// EXPENSE HEALTH SCORE
// ============================================================

const getHealthLevel = (score) => {
  if (score >= 90) {
    return "EXCELLENT";
  }

  if (score >= 75) {
    return "HEALTHY";
  }

  if (score >= 50) {
    return "MODERATE";
  }

  if (score >= 25) {
    return "CONCERNING";
  }

  return "CRITICAL";
};

const calculateSpendingTrendScore = (trend) => {
  const changePercent = Number(trend?.changePercent) || 0;

  if (trend?.direction === "STABLE") {
    return 25;
  }

  if (changePercent < 0) {
    return 25;
  }

  if (changePercent <= 10) {
    return 22;
  }

  if (changePercent <= 25) {
    return 18;
  }

  if (changePercent <= 50) {
    return 12;
  }

  if (changePercent <= 100) {
    return 6;
  }

  return 0;
};

const calculateAnomalyScore = (anomalyAnalysis) => {
  if (!anomalyAnalysis?.detected) {
    return 25;
  }

  const anomalies = anomalyAnalysis.anomalies || [];

  if (!anomalies.length) {
    return 25;
  }

  const highSeverityCount = anomalies.filter(
    (anomaly) => anomaly.severity === "HIGH",
  ).length;

  const mediumSeverityCount = anomalies.filter(
    (anomaly) => anomaly.severity === "MEDIUM",
  ).length;

  const penalty = highSeverityCount * 10 + mediumSeverityCount * 5;

  return Math.max(0, 25 - penalty);
};

const calculateCategoryConcentrationScore = (categoryAnalysis) => {
  const concentration = Number(categoryAnalysis?.concentrationPercent) || 0;

  if (concentration <= 30) {
    return 15;
  }

  if (concentration <= 40) {
    return 13;
  }

  if (concentration <= 50) {
    return 10;
  }

  if (concentration <= 60) {
    return 7;
  }

  if (concentration <= 75) {
    return 4;
  }

  return 0;
};

const calculateMaintenanceVarianceScore = (maintenanceAnalysis) => {
  const totalEstimatedCost =
    Number(maintenanceAnalysis?.totalEstimatedCost) || 0;

  const totalActualCost = Number(maintenanceAnalysis?.totalActualCost) || 0;

  if (totalActualCost <= 0) {
    return 20;
  }

  if (totalEstimatedCost <= 0) {
    return 20;
  }

  const variancePercent =
    ((totalActualCost - totalEstimatedCost) / totalEstimatedCost) * 100;

  if (variancePercent <= 0) {
    return 20;
  }

  if (variancePercent <= 10) {
    return 17;
  }

  if (variancePercent <= 20) {
    return 13;
  }

  if (variancePercent <= 35) {
    return 9;
  }

  if (variancePercent <= 50) {
    return 5;
  }

  return 0;
};

const calculatePendingPaymentScore = (overview) => {
  const totalAmount = Number(overview?.totalAmount) || 0;

  const pendingAmount = Number(overview?.pendingAmount) || 0;

  if (totalAmount <= 0) {
    return 15;
  }

  const pendingPercentage = (pendingAmount / totalAmount) * 100;

  if (pendingPercentage <= 10) {
    return 15;
  }

  if (pendingPercentage <= 25) {
    return 12;
  }

  if (pendingPercentage <= 40) {
    return 9;
  }

  if (pendingPercentage <= 60) {
    return 5;
  }

  if (pendingPercentage <= 75) {
    return 2;
  }

  return 0;
};

const calculateExpenseHealthScore = ({
  overview,
  trends,
  categories,
  anomalies,
  maintenanceAnalysis,
}) => {
  const spendingTrendScore = calculateSpendingTrendScore(trends);

  const anomalyScore = calculateAnomalyScore(anomalies);

  const categoryConcentrationScore =
    calculateCategoryConcentrationScore(categories);

  const maintenanceVarianceScore =
    calculateMaintenanceVarianceScore(maintenanceAnalysis);

  const pendingPaymentScore = calculatePendingPaymentScore(overview);

  const score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        spendingTrendScore +
          anomalyScore +
          categoryConcentrationScore +
          maintenanceVarianceScore +
          pendingPaymentScore,
      ),
    ),
  );

  return {
    score,
    level: getHealthLevel(score),

    factors: {
      spendingTrend: {
        score: spendingTrendScore,
        maxScore: 25,
      },

      anomalyLevel: {
        score: anomalyScore,
        maxScore: 25,
      },

      categoryConcentration: {
        score: categoryConcentrationScore,
        maxScore: 15,
      },

      maintenanceCostVariance: {
        score: maintenanceVarianceScore,
        maxScore: 20,
      },

      pendingPaymentBurden: {
        score: pendingPaymentScore,
        maxScore: 15,
      },
    },
  };
};

// ============================================================
// EXPENSE DATA CONFIDENCE
// ============================================================

const getConfidenceLevel = (expenseCount) => {
  if (expenseCount >= 30) {
    return "VERY_HIGH";
  }

  if (expenseCount >= 12) {
    return "HIGH";
  }

  if (expenseCount >= 5) {
    return "MEDIUM";
  }

  return "LOW";
};

const calculateExpenseConfidence = ({
  expenseCount,
  anomalyAnalysis,
  recurringAnalysis,
  maintenanceAnalysis,
}) => {
  let score = 0;

  if (expenseCount >= 30) {
    score = 100;
  } else if (expenseCount >= 12) {
    score = 80;
  } else if (expenseCount >= 5) {
    score = 60;
  } else if (expenseCount >= 2) {
    score = 35;
  } else if (expenseCount === 1) {
    score = 15;
  }

  if (anomalyAnalysis?.confidence === "HIGH") {
    score += 5;
  } else if (anomalyAnalysis?.confidence === "MEDIUM") {
    score += 3;
  }

  if (recurringAnalysis?.confidence === "HIGH") {
    score += 5;
  } else if (recurringAnalysis?.confidence === "MEDIUM") {
    score += 3;
  }

  if ((maintenanceAnalysis?.requestsWithCostData || 0) > 0) {
    score += 5;
  }

  score = Math.min(100, score);

  return {
    score,
    level: getConfidenceLevel(expenseCount),

    dataPoints: {
      expenseCount,

      anomalyAnalysisAvailable: expenseCount >= MIN_ANOMALY_DATA,

      recurringAnalysisAvailable: expenseCount >= MIN_RECURRING_OCCURRENCES,

      maintenanceCostDataAvailable:
        (maintenanceAnalysis?.requestsWithCostData || 0) > 0,
    },
  };
};

// ============================================================
// ACTIONABLE EXPENSE INSIGHTS
// ============================================================

const generateActionableExpenseInsights = ({
  overview,
  trends,
  categories,
  anomalies,
  recurringAnalysis,
  maintenanceAnalysis,
  vendorAnalysis,
  healthScore,
  confidence,
}) => {
  const insights = [];

  const addInsight = ({
    type,
    severity,
    title,
    message,
    recommendation,
    metric,
    priority = 3,
  }) => {
    insights.push({
      type,
      severity,
      title,
      message,
      recommendation,
      metric: metric || null,
      priority,
    });
  };

  // --------------------------------------------------------
  // 1. EXPENSE HEALTH
  // --------------------------------------------------------

  if (healthScore?.level === "CRITICAL") {
    addInsight({
      type: "HEALTH_SCORE",
      severity: "CRITICAL",
      title: "Critical expense health",
      message:
        "The property's expense profile shows multiple financial risk indicators.",
      recommendation:
        "Review major expenses, outstanding payments, recurring costs, and maintenance spending immediately.",
      metric: {
        healthScore: healthScore.score,
        healthLevel: healthScore.level,
      },
      priority: 1,
    });
  } else if (healthScore?.level === "CONCERNING") {
    addInsight({
      type: "HEALTH_SCORE",
      severity: "HIGH",
      title: "Expense health requires attention",
      message:
        "The property's expense profile contains several areas that may require financial attention.",
      recommendation:
        "Review spending concentration, unusual expenses, and outstanding payments before approving additional discretionary spending.",
      metric: {
        healthScore: healthScore.score,
        healthLevel: healthScore.level,
      },
      priority: 1,
    });
  } else if (healthScore?.level === "MODERATE") {
    addInsight({
      type: "HEALTH_SCORE",
      severity: "MEDIUM",
      title: "Moderate expense health",
      message:
        "The property's expense profile is generally manageable but contains some areas worth monitoring.",
      recommendation:
        "Continue monitoring spending trends and investigate any categories or expenses that begin increasing significantly.",
      metric: {
        healthScore: healthScore.score,
        healthLevel: healthScore.level,
      },
      priority: 2,
    });
  } else if (
    healthScore?.level === "HEALTHY" ||
    healthScore?.level === "EXCELLENT"
  ) {
    addInsight({
      type: "HEALTH_SCORE",
      severity: "LOW",
      title: "Healthy expense profile",
      message:
        "The property's current expense profile is financially stable based on the available data.",
      recommendation:
        "Continue monitoring expenses regularly and maintain the current spending discipline.",
      metric: {
        healthScore: healthScore.score,
        healthLevel: healthScore.level,
      },
      priority: 4,
    });
  }

  // --------------------------------------------------------
  // 2. SPENDING TREND
  // --------------------------------------------------------

  const changePercent = Number(trends?.changePercent) || 0;

  if (trends?.direction === "INCREASING") {
    if (changePercent > 100) {
      addInsight({
        type: "SPENDING_TREND",
        severity: "HIGH",
        title: "Rapid increase in spending",
        message: `Expense spending has increased by ${changePercent.toFixed(
          2,
        )}% compared with the previous period.`,
        recommendation:
          "Review the largest recent expenses and determine whether the increase is caused by one-time events or an ongoing spending pattern.",
        metric: {
          direction: trends.direction,
          changePercent,
        },
        priority: 1,
      });
    } else if (changePercent > 25) {
      addInsight({
        type: "SPENDING_TREND",
        severity: "MEDIUM",
        title: "Spending is increasing",
        message: `Expense spending has increased by ${changePercent.toFixed(
          2,
        )}% compared with the previous period.`,
        recommendation:
          "Review recent expenses and monitor the next reporting period to determine whether the increase continues.",
        metric: {
          direction: trends.direction,
          changePercent,
        },
        priority: 2,
      });
    } else {
      addInsight({
        type: "SPENDING_TREND",
        severity: "LOW",
        title: "Moderate spending increase",
        message: `Expense spending has increased by ${changePercent.toFixed(
          2,
        )}% compared with the previous period.`,
        recommendation:
          "Continue monitoring spending and investigate the increase if the trend persists.",
        metric: {
          direction: trends.direction,
          changePercent,
        },
        priority: 3,
      });
    }
  } else if (trends?.direction === "DECREASING") {
    addInsight({
      type: "SPENDING_TREND",
      severity: "LOW",
      title: "Spending is decreasing",
      message: `Expense spending has decreased by ${Math.abs(
        changePercent,
      ).toFixed(2)}% compared with the previous period.`,
      recommendation:
        "Maintain the current spending discipline while checking that essential property maintenance remains adequately funded.",
      metric: {
        direction: trends.direction,
        changePercent,
      },
      priority: 4,
    });
  } else if (trends?.direction === "STABLE") {
    addInsight({
      type: "SPENDING_TREND",
      severity: "LOW",
      title: "Spending is stable",
      message:
        "Expense spending is relatively stable compared with the previous period.",
      recommendation:
        "Continue monitoring expenses and maintain the current budget discipline.",
      metric: {
        direction: trends.direction,
        changePercent,
      },
      priority: 4,
    });
  }

  // --------------------------------------------------------
  // 3. CATEGORY CONCENTRATION
  // --------------------------------------------------------

  const concentrationPercent = Number(categories?.concentrationPercent) || 0;

  const dominantCategory =
    categories?.dominantCategory?.category ||
    categories?.dominantCategory ||
    null;

  if (dominantCategory && concentrationPercent > 75) {
    addInsight({
      type: "CATEGORY_CONCENTRATION",
      severity: "HIGH",
      title: "High expense concentration",
      message: `${dominantCategory} accounts for ${concentrationPercent.toFixed(
        2,
      )}% of total property expenses.`,
      recommendation:
        "Review this category carefully and determine whether the concentration is caused by necessary one-time expenses or represents a recurring cost problem.",
      metric: {
        category: dominantCategory,
        concentrationPercent,
      },
      priority: 1,
    });
  } else if (dominantCategory && concentrationPercent > 60) {
    addInsight({
      type: "CATEGORY_CONCENTRATION",
      severity: "MEDIUM",
      title: "Expense concentration detected",
      message: `${dominantCategory} accounts for ${concentrationPercent.toFixed(
        2,
      )}% of total property expenses.`,
      recommendation:
        "Monitor this category and compare future expenses to determine whether the concentration continues.",
      metric: {
        category: dominantCategory,
        concentrationPercent,
      },
      priority: 2,
    });
  }

  // --------------------------------------------------------
  // 4. ANOMALIES
  // --------------------------------------------------------

  if (anomalies?.detected) {
    const anomalyList = anomalies.anomalies || [];

    const highAnomalies = anomalyList.filter(
      (anomaly) => anomaly.severity === "HIGH",
    );

    if (highAnomalies.length > 0) {
      const largestAnomaly = highAnomalies.reduce(
        (largest, current) =>
          Number(current.amount) > Number(largest.amount) ? current : largest,
        highAnomalies[0],
      );

      addInsight({
        type: "ANOMALY",
        severity: "HIGH",
        title: "Unusual expense detected",
        message: `${highAnomalies.length} high-severity unusual expense${
          highAnomalies.length > 1 ? "s were" : " was"
        } detected.`,
        recommendation:
          "Review the unusual expense transaction, receipt, and supporting documents to confirm that the expense is legitimate and necessary.",
        metric: {
          count: highAnomalies.length,
          largestAmount: largestAnomaly?.amount || 0,
          largestExpense:
            largestAnomaly?.title || largestAnomaly?.description || null,
        },
        priority: 1,
      });
    } else if (anomalyList.length > 0) {
      addInsight({
        type: "ANOMALY",
        severity: "MEDIUM",
        title: "Unusual spending detected",
        message: `${anomalyList.length} unusual expense${
          anomalyList.length > 1 ? "s were" : " was"
        } detected in the available expense data.`,
        recommendation:
          "Review the flagged expenses and verify their supporting receipts or documentation.",
        metric: {
          count: anomalyList.length,
        },
        priority: 2,
      });
    }
  }

  // --------------------------------------------------------
  // 5. RECURRING EXPENSES
  // --------------------------------------------------------

  const recurringPatterns = recurringAnalysis?.patterns || [];

  if (recurringPatterns.length > 0) {
    const topRecurring = recurringPatterns[0];

    addInsight({
      type: "RECURRING_EXPENSE",
      severity: "MEDIUM",
      title: "Recurring expense pattern detected",
      message: `${recurringPatterns.length} recurring expense pattern${
        recurringPatterns.length > 1 ? "s were" : " was"
      } identified.`,
      recommendation:
        "Review recurring expenses periodically and compare their amounts with previous periods to identify unnecessary increases.",
      metric: {
        patternCount: recurringPatterns.length,
        topCategory: topRecurring?.category || null,
        topAverageAmount: topRecurring?.averageAmount || 0,
        topOccurrences: topRecurring?.occurrences || 0,
      },
      priority: 3,
    });
  }

  // --------------------------------------------------------
  // 6. PENDING PAYMENTS
  // --------------------------------------------------------

  const totalAmount = Number(overview?.totalAmount) || 0;

  const pendingAmount = Number(overview?.pendingAmount) || 0;

  if (totalAmount > 0 && pendingAmount > 0) {
    const pendingPercentage = (pendingAmount / totalAmount) * 100;

    if (pendingPercentage > 60) {
      addInsight({
        type: "PENDING_PAYMENTS",
        severity: "CRITICAL",
        title: "High outstanding payment burden",
        message: `${pendingPercentage.toFixed(
          2,
        )}% of recorded expenses are currently pending or partially paid.`,
        recommendation:
          "Review outstanding payments immediately and prioritize overdue obligations to avoid service interruptions, penalties, or vendor disputes.",
        metric: {
          pendingAmount,
          totalAmount,
          pendingPercentage,
        },
        priority: 1,
      });
    } else if (pendingPercentage > 40) {
      addInsight({
        type: "PENDING_PAYMENTS",
        severity: "HIGH",
        title: "Significant outstanding payments",
        message: `${pendingPercentage.toFixed(
          2,
        )}% of recorded expenses are currently pending or partially paid.`,
        recommendation:
          "Review outstanding payments and prioritize important vendor, utility, maintenance, and property-related obligations.",
        metric: {
          pendingAmount,
          totalAmount,
          pendingPercentage,
        },
        priority: 2,
      });
    } else if (pendingPercentage > 20) {
      addInsight({
        type: "PENDING_PAYMENTS",
        severity: "MEDIUM",
        title: "Pending payments require monitoring",
        message: `${pendingPercentage.toFixed(
          2,
        )}% of recorded expenses are currently pending or partially paid.`,
        recommendation:
          "Review pending expenses regularly and clear them according to their due dates and business priority.",
        metric: {
          pendingAmount,
          totalAmount,
          pendingPercentage,
        },
        priority: 3,
      });
    }
  }

  // --------------------------------------------------------
  // 7. MAINTENANCE COST
  // --------------------------------------------------------

  const estimatedCost = Number(maintenanceAnalysis?.totalEstimatedCost) || 0;

  const actualCost = Number(maintenanceAnalysis?.totalActualCost) || 0;

  if (estimatedCost > 0 && actualCost > 0 && actualCost > estimatedCost) {
    const variancePercent =
      ((actualCost - estimatedCost) / estimatedCost) * 100;

    addInsight({
      type: "MAINTENANCE_COST",
      severity:
        variancePercent > 50 ? "HIGH" : variancePercent > 20 ? "MEDIUM" : "LOW",
      title: "Maintenance cost overrun",
      message: `Actual maintenance cost is ${variancePercent.toFixed(
        2,
      )}% above the estimated cost.`,
      recommendation:
        "Review the maintenance work, vendor charges, and approval records to determine the reason for the cost overrun.",
      metric: {
        estimatedCost,
        actualCost,
        variancePercent,
      },
      priority: variancePercent > 50 ? 1 : 2,
    });
  } else if (
    estimatedCost > 0 &&
    actualCost > 0 &&
    actualCost <= estimatedCost
  ) {
    const variancePercent =
      ((actualCost - estimatedCost) / estimatedCost) * 100;

    addInsight({
      type: "MAINTENANCE_COST",
      severity: "LOW",
      title: "Maintenance spending is within estimate",
      message: `Actual maintenance cost is ${Math.abs(variancePercent).toFixed(
        2,
      )}% below the estimated cost.`,
      recommendation:
        "Continue monitoring the final maintenance cost against the approved estimate.",
      metric: {
        estimatedCost,
        actualCost,
        variancePercent,
      },
      priority: 4,
    });
  }

  // --------------------------------------------------------
  // 8. VENDOR COST
  // --------------------------------------------------------

  const vendorCount = Number(vendorAnalysis?.vendorCount) || 0;

  const vendorExpense = Number(vendorAnalysis?.totalVendorExpense) || 0;

  if (vendorCount > 0 && vendorExpense > 0) {
    addInsight({
      type: "VENDOR_COST",
      severity: "LOW",
      title: "Vendor expense activity detected",
      message: `${vendorCount} vendor${
        vendorCount > 1 ? "s have" : " has"
      } generated ₹${vendorExpense.toLocaleString(
        "en-IN",
      )} in linked expenses.`,
      recommendation:
        "Compare vendor costs, job frequency, and maintenance estimates over time to identify cost-effective vendors.",
      metric: {
        vendorCount,
        totalVendorExpense: vendorExpense,
      },
      priority: 4,
    });
  }

  // --------------------------------------------------------
  // 9. DATA CONFIDENCE
  // --------------------------------------------------------

  if (confidence?.level === "LOW") {
    addInsight({
      type: "DATA_CONFIDENCE",
      severity: "MEDIUM",
      title: "Limited expense history",
      message:
        "The available expense history is limited, so analytical conclusions may change as more data becomes available.",
      recommendation:
        "Continue recording property expenses consistently to improve the reliability of future insights.",
      metric: {
        confidenceScore: confidence.score,
        confidenceLevel: confidence.level,
      },
      priority: 2,
    });
  } else if (confidence?.level === "MEDIUM") {
    addInsight({
      type: "DATA_CONFIDENCE",
      severity: "LOW",
      title: "Moderate analytical confidence",
      message:
        "The expense dataset is sufficient for useful analysis, but additional historical data would improve confidence.",
      recommendation:
        "Continue maintaining complete expense records to strengthen future trend, anomaly, and recurring-expense analysis.",
      metric: {
        confidenceScore: confidence.score,
        confidenceLevel: confidence.level,
      },
      priority: 4,
    });
  }

  // --------------------------------------------------------
  // SORT BY PRIORITY
  // --------------------------------------------------------

  insights.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    const severityRank = {
      CRITICAL: 1,
      HIGH: 2,
      MEDIUM: 3,
      LOW: 4,
    };

    return (severityRank[a.severity] || 99) - (severityRank[b.severity] || 99);
  });

  return {
    count: insights.length,
    insights,
  };
};

// ============================================================
// MAIN EXPENSE INSIGHT SERVICE
// ============================================================

const getExpenseInsightFoundation = async ({
  ownerId,
  propertyId = null,
  period = "12M",
  isAdmin = false,
}) => {
  // ----------------------------------------------------------
  // VALIDATE OWNER
  // ----------------------------------------------------------

  if (!mongoose.Types.ObjectId.isValid(ownerId)) {
    const error = new Error("Invalid owner ID");
    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // VALIDATE PROPERTY
  // ----------------------------------------------------------

  if (propertyId && !mongoose.Types.ObjectId.isValid(propertyId)) {
    const error = new Error("Invalid property ID");
    error.statusCode = 400;
    throw error;
  }

  // ----------------------------------------------------------
  // PROPERTY ACCESS VALIDATION
  // ----------------------------------------------------------

  if (propertyId) {
    const propertyQuery = {
      _id: propertyId,
      isActive: true,
    };

    // Owners can access only their own properties.
    // Admins can access any active property.
    if (!isAdmin) {
      propertyQuery.owner = ownerId;
    }

    const property = await Property.findOne(propertyQuery)
      .select("_id owner title isActive")
      .lean();

    if (!property) {
      const error = new Error("Property not found");
      error.statusCode = 404;
      throw error;
    }
  }

  // ----------------------------------------------------------
  // PERIOD
  // ----------------------------------------------------------

  const months = getPeriodMonths(period);

  const endDate = new Date();

  const startDate = getStartDate(months);

  // ----------------------------------------------------------
  // EXPENSE QUERY
  // ----------------------------------------------------------

  const match = {
    isActive: true,

    expenseDate: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  // IMPORTANT:
  // When a property is supplied, always restrict
  // analytics to that property.
  if (propertyId) {
    match.property = new mongoose.Types.ObjectId(propertyId);
  }

  // Owners can only see their own expenses.
  // Admins can analyze expenses across owners.
  if (!isAdmin) {
    match.owner = new mongoose.Types.ObjectId(ownerId);
  }

  // ----------------------------------------------------------
  // FETCH EXPENSES
  // ----------------------------------------------------------

  const expenses = await Expense.find(match)
    .select(
      [
        "property",
        "owner",
        "title",
        "category",
        "amount",
        "expenseDate",
        "paymentStatus",
        "maintenanceRequest",
      ].join(" "),
    )
    .sort({
      expenseDate: 1,
    })
    .lean();

  // ----------------------------------------------------------
  // OVERVIEW
  // ----------------------------------------------------------

  const overview = calculateOverview(expenses);

  // ----------------------------------------------------------
  // MONTHLY TREND
  // ----------------------------------------------------------

  const monthlyTrend = buildMonthlyTrend(expenses, startDate, endDate);

  // ----------------------------------------------------------
  // TREND SUMMARY
  // ----------------------------------------------------------

  const trend = calculateTrendSummary(monthlyTrend);

  // ----------------------------------------------------------
  // CATEGORY ANALYSIS
  // ----------------------------------------------------------

  const categoryAnalysis = calculateCategoryAnalysis(expenses);

  // ----------------------------------------------------------
  // ANOMALY ANALYSIS
  // ----------------------------------------------------------

  const anomalyAnalysis = detectExpenseAnomalies(expenses);

  // ----------------------------------------------------------
  // RECURRING EXPENSE ANALYSIS
  // ----------------------------------------------------------

  const recurringAnalysis = detectRecurringExpenses(expenses);

  // ----------------------------------------------------------
  // MAINTENANCE ANALYSIS
  // ----------------------------------------------------------

  const maintenanceAnalysis = await calculateMaintenanceCostAnalysis(expenses);

  // ----------------------------------------------------------
  // VENDOR ANALYSIS
  // ----------------------------------------------------------

  const vendorAnalysis = await calculateVendorCostAnalysis(expenses);

  // ----------------------------------------------------------
  // EXPENSE HEALTH SCORE
  // ----------------------------------------------------------

  const healthScore = calculateExpenseHealthScore({
    overview,
    trends: trend,
    categories: categoryAnalysis,
    anomalies: anomalyAnalysis,
    maintenanceAnalysis,
  });

  // ----------------------------------------------------------
  // EXPENSE CONFIDENCE
  // ----------------------------------------------------------

  const confidence = calculateExpenseConfidence({
    expenseCount: expenses.length,
    anomalyAnalysis,
    recurringAnalysis,
    maintenanceAnalysis,
  });

  // ----------------------------------------------------------
  // ACTIONABLE EXPENSE INSIGHTS
  // ----------------------------------------------------------

  const actionableInsights = generateActionableExpenseInsights({
    overview,
    trends: trend,
    categories: categoryAnalysis,
    anomalies: anomalyAnalysis,
    recurringAnalysis,
    maintenanceAnalysis,
    vendorAnalysis,
    healthScore,
    confidence,
  });

  // ----------------------------------------------------------
  // RETURN ANALYTICS
  // ----------------------------------------------------------

  return {
    period: {
      type: period,
      months,
      startDate,
      endDate,
    },

    overview,

    trends: {
      ...trend,
      monthly: monthlyTrend,
    },

    categories: categoryAnalysis,

    anomalies: anomalyAnalysis,

    recurringExpenses: recurringAnalysis,

    maintenanceAnalysis,

    vendorAnalysis,

    healthScore,

    confidence,

    actionableInsights,

    dataQuality: {
      expenseCount: expenses.length,

      hasSufficientData: expenses.length >= 5,

      hasSufficientAnomalyData: expenses.length >= MIN_ANOMALY_DATA,

      hasSufficientRecurringData: expenses.length >= MIN_RECURRING_OCCURRENCES,
    },
  };
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getExpenseInsightFoundation,

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
};
