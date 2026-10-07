const {
  calculatePropertyConditionRisk,
  calculateInspectionRisk,
  calculateMaintenanceRisk,
  calculateMonitoringRisk,
  calculateDocumentRisk,
  calculateInspectionFreshnessRisk,
  calculateCaretakerRisk,
  getRiskLevel,
} = require("./src/services/propertyRiskService");

console.log("\n========================================");
console.log("PROPERTY RISK CALCULATION TEST");
console.log("========================================\n");

// ============================================================
// 1. PROPERTY CONDITION
// ============================================================

console.log("1. PROPERTY CONDITION");
console.log("----------------------------------------");

["GOOD", "FAIR", "NEEDS_ATTENTION", "CRITICAL"].forEach((condition) => {
  const result = calculatePropertyConditionRisk({ condition });

  console.log(
    `${condition.padEnd(18)} → ${result.impact}/15 | ${result.severity}`,
  );
});

// ============================================================
// 2. MAINTENANCE
// ============================================================

console.log("\n2. MAINTENANCE");
console.log("----------------------------------------");

const maintenanceCases = [
  [],
  [{ priority: "LOW" }],
  [{ priority: "MEDIUM" }],
  [{ priority: "HIGH" }],
  [{ priority: "URGENT" }],
  [
    { priority: "URGENT" },
    { priority: "HIGH" },
    { priority: "MEDIUM" },
  ],
];

maintenanceCases.forEach((requests, index) => {
  const result = calculateMaintenanceRisk(requests);

  console.log(
    `Case ${index + 1}: ${requests.length} request(s) → ${result.impact}/20 | ${result.severity}`,
  );
});

// ============================================================
// 3. MONITORING
// ============================================================

console.log("\n3. MONITORING");
console.log("----------------------------------------");

const monitoringCases = [
  [],
  [{ severity: "LOW" }],
  [{ severity: "MEDIUM" }],
  [{ severity: "HIGH" }],
  [{ severity: "CRITICAL" }],
  [
    { severity: "CRITICAL" },
    { severity: "HIGH" },
    { severity: "MEDIUM" },
  ],
];

monitoringCases.forEach((events, index) => {
  const result = calculateMonitoringRisk(events);

  console.log(
    `Case ${index + 1}: ${events.length} event(s) → ${result.impact}/25 | ${result.severity}`,
  );
});

// ============================================================
// 4. CARETAKER
// ============================================================

console.log("\n4. CARETAKER COVERAGE");
console.log("----------------------------------------");

console.log(
  "Active caretaker →",
  calculateCaretakerRisk({ _id: "test" }),
);

console.log(
  "No caretaker →",
  calculateCaretakerRisk(null),
);

// ============================================================
// 5. RISK LEVEL BOUNDARIES
// ============================================================

console.log("\n5. RISK LEVEL BOUNDARIES");
console.log("----------------------------------------");

[0, 24, 25, 49, 50, 74, 75, 100].forEach((score) => {
  console.log(`${score}/100 → ${getRiskLevel(score)}`);
});

// ============================================================
// 6. INSPECTION ABSENCE
// ============================================================

console.log("\n6. INSPECTION ABSENCE");
console.log("----------------------------------------");

console.log(
  "No inspection:",
  calculateInspectionRisk(null),
);

console.log(
  "Inspection freshness without inspection:",
  calculateInspectionFreshnessRisk(null),
);

// ============================================================
// 7. DOCUMENT EXPIRY
// ============================================================

console.log("\n7. DOCUMENT EXPIRY");
console.log("----------------------------------------");

const now = new Date();

const daysFromNow = (days) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date;
};

const documentCases = [
  [],
  [{ expiryDate: daysFromNow(60), status: "ACTIVE" }],
  [{ expiryDate: daysFromNow(30), status: "ACTIVE" }],
  [{ expiryDate: daysFromNow(7), status: "ACTIVE" }],
  [{ expiryDate: daysFromNow(-1), status: "EXPIRED" }],
];

documentCases.forEach((documents, index) => {
  const result = calculateDocumentRisk(documents);

  console.log(
    `Case ${index + 1}: ${documents.length} document(s) → ${result.impact}/10 | ${result.severity}`,
  );
});

// ============================================================

console.log("\n========================================");
console.log("TEST COMPLETE");
console.log("========================================\n");