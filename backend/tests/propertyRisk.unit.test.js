const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculatePropertyConditionRisk,
  calculateInspectionRisk,
  calculateMaintenanceRisk,
  calculateMonitoringRisk,
  calculateDocumentRisk,
  calculateInspectionFreshnessRisk,
  calculateCaretakerRisk,
  calculateConfidence,
  getRiskLevel,
} = require("../src/services/propertyRiskService");

// ============================================================
// RISK LEVEL BOUNDARIES
// ============================================================

test("risk levels classify all boundary values correctly", () => {
  assert.equal(getRiskLevel(0), "LOW");
  assert.equal(getRiskLevel(24), "LOW");
  assert.equal(getRiskLevel(25), "MEDIUM");
  assert.equal(getRiskLevel(49), "MEDIUM");
  assert.equal(getRiskLevel(50), "HIGH");
  assert.equal(getRiskLevel(74), "HIGH");
  assert.equal(getRiskLevel(75), "CRITICAL");
  assert.equal(getRiskLevel(100), "CRITICAL");
});

// ============================================================
// PROPERTY CONDITION
// ============================================================

test("property condition risk scores each supported condition", () => {
  const cases = [
    ["GOOD", 0, "NONE"],
    ["FAIR", 5, "LOW"],
    ["NEEDS_ATTENTION", 10, "MEDIUM"],
    ["CRITICAL", 15, "HIGH"],
  ];

  for (const [condition, expectedImpact, expectedSeverity] of cases) {
    const result = calculatePropertyConditionRisk({ condition });

    assert.equal(result.category, "PROPERTY_CONDITION");
    assert.equal(result.impact, expectedImpact);
    assert.equal(result.maxImpact, 15);
    assert.equal(result.severity, expectedSeverity);
    assert.equal(typeof result.reason, "string");
  }
});

test("unknown property condition defaults to zero risk", () => {
  const result = calculatePropertyConditionRisk({
    condition: "UNKNOWN",
  });

  assert.equal(result.impact, 0);
  assert.equal(result.severity, "NONE");
});

// ============================================================
// INSPECTION RISK
// ============================================================

test("missing inspection contributes zero inspection risk", () => {
  const result = calculateInspectionRisk(null);

  assert.equal(result.category, "INSPECTION");
  assert.equal(result.impact, 0);
  assert.equal(result.maxImpact, 20);
  assert.equal(result.severity, "NONE");
});

test("inspection risk combines condition and safety findings", () => {
  const result = calculateInspectionRisk({
    overallCondition: "CRITICAL",
    securityStatus: "CRITICAL",
    electricalStatus: "CRITICAL",
    plumbingStatus: "CRITICAL",
    cleanliness: "POOR",
    inspectedAt: new Date(),
    issuesFound: ["Electrical", "Plumbing"],
  });

  // 15 + 5 + 4 + 4 + 2 = 30, capped at 20.
  assert.equal(result.impact, 20);
  assert.equal(result.maxImpact, 20);
  assert.equal(result.severity, "HIGH");
  assert.equal(result.details.issuesFound, 2);
});

test("inspection with no concerns contributes zero risk", () => {
  const result = calculateInspectionRisk({
    overallCondition: "EXCELLENT",
    securityStatus: "NORMAL",
    electricalStatus: "NORMAL",
    plumbingStatus: "NORMAL",
    cleanliness: "EXCELLENT",
    inspectedAt: new Date(),
    issuesFound: [],
  });

  assert.equal(result.impact, 0);
  assert.equal(result.severity, "NONE");
  assert.equal(result.details.issuesFound, 0);
});

// ============================================================
// MAINTENANCE RISK
// ============================================================

test("no unresolved maintenance requests contribute zero risk", () => {
  const result = calculateMaintenanceRisk([]);

  assert.equal(result.impact, 0);
  assert.equal(result.maxImpact, 20);
  assert.equal(result.severity, "NONE");
  assert.equal(result.details.totalUnresolved, 0);
});

test("maintenance risk scores priorities and counts requests", () => {
  const result = calculateMaintenanceRisk([
    { priority: "URGENT" },
    { priority: "HIGH" },
    { priority: "MEDIUM" },
    { priority: "LOW" },
  ]);

  // 10 + 7 + 4 + 2 = 23, capped at 20.
  assert.equal(result.impact, 20);
  assert.equal(result.severity, "HIGH");
  assert.equal(result.details.totalUnresolved, 4);
  assert.deepEqual(result.details.counts, {
    URGENT: 1,
    HIGH: 1,
    MEDIUM: 1,
    LOW: 1,
  });
  assert.match(result.reason, /urgent/i);
});

test("maintenance risk ignores unrecognized priorities", () => {
  const result = calculateMaintenanceRisk([{ priority: "UNKNOWN" }]);

  assert.equal(result.impact, 0);
  assert.equal(result.details.totalUnresolved, 1);
});

// ============================================================
// MONITORING RISK
// ============================================================

test("no unresolved monitoring events contribute zero risk", () => {
  const result = calculateMonitoringRisk([]);

  assert.equal(result.impact, 0);
  assert.equal(result.maxImpact, 25);
  assert.equal(result.severity, "NONE");
  assert.equal(result.details.totalUnresolved, 0);
});

test("monitoring risk scores event severity and caps at 25", () => {
  const result = calculateMonitoringRisk([
    { severity: "CRITICAL" },
    { severity: "HIGH" },
    { severity: "MEDIUM" },
    { severity: "LOW" },
    { severity: "INFO" },
  ]);

  // 15 + 10 + 5 + 2 + 0 = 32, capped at 25.
  assert.equal(result.impact, 25);
  assert.equal(result.maxImpact, 25);
  assert.equal(result.severity, "HIGH");
  assert.equal(result.details.totalUnresolved, 5);
  assert.equal(result.details.counts.CRITICAL, 1);
  assert.match(result.reason, /critical/i);
});

// ============================================================
// DOCUMENT EXPIRY RISK
// ============================================================

test("documents without expiry dates contribute no expiry risk", () => {
  const result = calculateDocumentRisk([
    { status: "ACTIVE" },
    { status: "ACTIVE", expiryDate: null },
  ]);

  assert.equal(result.impact, 0);
  assert.deepEqual(result.details, {
    expired: 0,
    expiringWithin7Days: 0,
    expiringWithin30Days: 0,
  });
});

test("expired documents contribute six points each, capped at ten", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const result = calculateDocumentRisk([
    { status: "EXPIRED", expiryDate: yesterday },
    { status: "ACTIVE", expiryDate: yesterday },
  ]);

  assert.equal(result.impact, 10);
  assert.equal(result.maxImpact, 10);
  assert.equal(result.details.expired, 2);
  assert.equal(result.severity, "HIGH");
});

test("document expiring within seven days contributes four points", () => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 5);

  const result = calculateDocumentRisk([{ status: "ACTIVE", expiryDate }]);

  assert.equal(result.impact, 4);
  assert.equal(result.details.expiringWithin7Days, 1);
  assert.equal(result.details.expired, 0);
});

test("document expiring within thirty days contributes two points", () => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 20);

  const result = calculateDocumentRisk([{ status: "ACTIVE", expiryDate }]);

  assert.equal(result.impact, 2);
  assert.equal(result.details.expiringWithin30Days, 1);
});

test("document expiry risk stays within its maximum", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 2);

  const documents = Array.from({ length: 10 }, () => ({
    status: "EXPIRED",
    expiryDate: yesterday,
  }));

  const result = calculateDocumentRisk(documents);

  assert.equal(result.impact, 10);
  assert.ok(result.impact <= result.maxImpact);
});

// ============================================================
// INSPECTION FRESHNESS
// ============================================================

test("missing inspection receives maximum freshness risk", () => {
  const result = calculateInspectionFreshnessRisk(null);

  assert.equal(result.impact, 5);
  assert.equal(result.maxImpact, 5);
  assert.equal(result.severity, "HIGH");
});

test("recent inspection has zero freshness risk", () => {
  const inspectedAt = new Date();
  inspectedAt.setDate(inspectedAt.getDate() - 10);

  const result = calculateInspectionFreshnessRisk({ inspectedAt });

  assert.equal(result.impact, 0);
  assert.equal(result.severity, "NONE");
});

test("inspection 45 days old receives two freshness points", () => {
  const inspectedAt = new Date();
  inspectedAt.setDate(inspectedAt.getDate() - 45);

  const result = calculateInspectionFreshnessRisk({ inspectedAt });

  assert.equal(result.impact, 2);
  assert.equal(result.severity, "MEDIUM");
});

test("inspection 75 days old receives three freshness points", () => {
  const inspectedAt = new Date();
  inspectedAt.setDate(inspectedAt.getDate() - 75);

  const result = calculateInspectionFreshnessRisk({ inspectedAt });

  assert.equal(result.impact, 3);
  assert.equal(result.severity, "MEDIUM");
});

test("inspection over 90 days old receives maximum freshness risk", () => {
  const inspectedAt = new Date();
  inspectedAt.setDate(inspectedAt.getDate() - 100);

  const result = calculateInspectionFreshnessRisk({ inspectedAt });

  assert.equal(result.impact, 5);
  assert.equal(result.severity, "HIGH");
});

// ============================================================
// CARETAKER COVERAGE
// ============================================================

test("active caretaker assignment contributes zero risk", () => {
  const result = calculateCaretakerRisk({
    status: "ACTIVE",
  });

  assert.equal(result.impact, 0);
  assert.equal(result.maxImpact, 5);
  assert.equal(result.severity, "NONE");
});

test("missing caretaker assignment contributes five risk points", () => {
  const result = calculateCaretakerRisk(null);

  assert.equal(result.impact, 5);
  assert.equal(result.maxImpact, 5);
  assert.equal(result.severity, "HIGH");
});

// ============================================================
// CONFIDENCE
// ============================================================

test("confidence is LOW when only basic property evidence exists", () => {
  const result = calculateConfidence({
    property: {},
    inspection: null,
    maintenanceRequests: [],
    monitoringEvents: [],
    documents: [],
    activeAssignment: null,
  });

  assert.equal(result, "LOW");
});

test("confidence is MEDIUM when evidence points reach three", () => {
  const result = calculateConfidence({
    property: {},
    inspection: {},
    maintenanceRequests: [],
    monitoringEvents: [],
    documents: [],
    activeAssignment: null,
  });

  // Property = 1 point; inspection = 2 points.
  assert.equal(result, "MEDIUM");
});

test("confidence is HIGH when evidence points reach six", () => {
  const result = calculateConfidence({
    property: {},
    inspection: {},
    maintenanceRequests: [{}],
    monitoringEvents: [{}],
    documents: [{}],
    activeAssignment: {},
  });

  // 1 + 2 + 1 + 1 + 1 + 1 = 7 points.
  assert.equal(result, "HIGH");
});

test("non-empty evidence collections increase confidence", () => {
  const result = calculateConfidence({
    property: {},
    inspection: null,
    maintenanceRequests: [{}],
    monitoringEvents: [{}],
    documents: [],
    activeAssignment: null,
  });

  // Property = 1, maintenance = 1, monitoring = 1.
  assert.equal(result, "MEDIUM");
});
