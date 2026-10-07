const mongoose = require("mongoose");

const Property = require("../models/Property");
const Inspection = require("../models/Inspection");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const MonitoringEvent = require("../models/MonitoringEvent");
const Document = require("../models/Document");
const CaretakerAssignment = require("../models/CaretakerAssignment");

// ============================================================
// RISK CONFIGURATION
// ============================================================

const RISK_LEVELS = {
  LOW: {
    min: 0,
    max: 24,
  },
  MEDIUM: {
    min: 25,
    max: 49,
  },
  HIGH: {
    min: 50,
    max: 74,
  },
  CRITICAL: {
    min: 75,
    max: 100,
  },
};

const MAX_RISK_SCORE = 100;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

const getRiskLevel = (score) => {
  if (score <= RISK_LEVELS.LOW.max) {
    return "LOW";
  }

  if (score <= RISK_LEVELS.MEDIUM.max) {
    return "MEDIUM";
  }

  if (score <= RISK_LEVELS.HIGH.max) {
    return "HIGH";
  }

  return "CRITICAL";
};

const getSeverityFromImpact = (impact, maxImpact) => {
  const percentage = maxImpact === 0 ? 0 : impact / maxImpact;

  if (percentage >= 0.75) {
    return "HIGH";
  }

  if (percentage >= 0.4) {
    return "MEDIUM";
  }

  if (percentage > 0) {
    return "LOW";
  }

  return "NONE";
};

const startOfDay = (date) => {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
};

const getDaysSince = (date) => {
  if (!date) {
    return null;
  }

  const now = startOfDay(new Date());
  const target = startOfDay(new Date(date));

  const difference = now.getTime() - target.getTime();

  return Math.floor(difference / (1000 * 60 * 60 * 24));
};

const getDaysUntil = (date) => {
  if (!date) {
    return null;
  }

  const now = startOfDay(new Date());
  const target = startOfDay(new Date(date));

  const difference = target.getTime() - now.getTime();

  return Math.ceil(difference / (1000 * 60 * 60 * 24));
};

// ============================================================
// PROPERTY CONDITION
// MAX: 15
// ============================================================

const calculatePropertyConditionRisk = (property) => {
  const scores = {
    GOOD: 0,
    FAIR: 5,
    NEEDS_ATTENTION: 10,
    CRITICAL: 15,
  };

  const impact = scores[property.condition] ?? 0;

  let reason = "The property condition is currently good.";

  if (property.condition === "FAIR") {
    reason = "The property is currently in fair condition.";
  }

  if (property.condition === "NEEDS_ATTENTION") {
    reason = "The property condition indicates that attention is required.";
  }

  if (property.condition === "CRITICAL") {
    reason = "The property is currently marked as being in critical condition.";
  }

  return {
    category: "PROPERTY_CONDITION",
    impact,
    maxImpact: 15,
    severity: getSeverityFromImpact(impact, 15),
    reason,
  };
};

// ============================================================
// LATEST INSPECTION
// MAX: 20
// ============================================================

const calculateInspectionRisk = (inspection) => {
  if (!inspection) {
    return {
      category: "INSPECTION",
      impact: 0,
      maxImpact: 20,
      severity: "NONE",
      reason: "No completed inspection data is available.",
    };
  }

  const overallConditionScores = {
    EXCELLENT: 0,
    GOOD: 2,
    FAIR: 6,
    POOR: 12,
    CRITICAL: 15,
  };

  const securityScores = {
    NORMAL: 0,
    WARNING: 3,
    CRITICAL: 5,
  };

  const electricalScores = {
    NORMAL: 0,
    WARNING: 2,
    CRITICAL: 4,
    NOT_CHECKED: 0,
  };

  const plumbingScores = {
    NORMAL: 0,
    WARNING: 2,
    CRITICAL: 4,
    NOT_CHECKED: 0,
  };

  const cleanlinessScores = {
    EXCELLENT: 0,
    GOOD: 0,
    FAIR: 1,
    POOR: 2,
  };

  const overallRisk = overallConditionScores[inspection.overallCondition] ?? 0;

  const securityRisk = securityScores[inspection.securityStatus] ?? 0;

  const electricalRisk = electricalScores[inspection.electricalStatus] ?? 0;

  const plumbingRisk = plumbingScores[inspection.plumbingStatus] ?? 0;

  const cleanlinessRisk = cleanlinessScores[inspection.cleanliness] ?? 0;

  const impact = clamp(
    overallRisk +
      securityRisk +
      electricalRisk +
      plumbingRisk +
      cleanlinessRisk,
    0,
    20,
  );

  let reason = "The latest inspection shows no major condition concerns.";

  if (impact > 0 && impact < 8) {
    reason =
      "The latest inspection contains some minor property condition concerns.";
  }

  if (impact >= 8 && impact < 15) {
    reason =
      "The latest inspection indicates several operational or condition concerns.";
  }

  if (impact >= 15) {
    reason =
      "The latest inspection indicates significant property condition or security concerns.";
  }

  return {
    category: "INSPECTION",
    impact,
    maxImpact: 20,
    severity: getSeverityFromImpact(impact, 20),
    reason,
    details: {
      inspectedAt: inspection.inspectedAt,
      overallCondition: inspection.overallCondition,
      securityStatus: inspection.securityStatus,
      electricalStatus: inspection.electricalStatus,
      plumbingStatus: inspection.plumbingStatus,
      cleanliness: inspection.cleanliness,
      issuesFound: Array.isArray(inspection.issuesFound)
        ? inspection.issuesFound.length
        : 0,
    },
  };
};

// ============================================================
// MAINTENANCE
// MAX: 20
// ============================================================

const calculateMaintenanceRisk = (maintenanceRequests) => {
  const priorityScores = {
    URGENT: 10,
    HIGH: 7,
    MEDIUM: 4,
    LOW: 2,
  };

  let impact = 0;

  const counts = {
    URGENT: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  maintenanceRequests.forEach((request) => {
    const priority = request.priority;

    if (priorityScores[priority] !== undefined) {
      impact += priorityScores[priority];

      counts[priority] += 1;
    }
  });

  impact = clamp(impact, 0, 20);

  let reason = "There are no unresolved maintenance requests.";

  if (maintenanceRequests.length > 0) {
    reason = `${maintenanceRequests.length} unresolved maintenance request${
      maintenanceRequests.length === 1 ? "" : "s"
    } require attention.`;
  }

  if (counts.URGENT > 0) {
    reason = `${counts.URGENT} urgent maintenance request${
      counts.URGENT === 1 ? "" : "s"
    } remain unresolved.`;
  } else if (counts.HIGH > 0) {
    reason = `${counts.HIGH} high-priority maintenance request${
      counts.HIGH === 1 ? "" : "s"
    } remain unresolved.`;
  }

  return {
    category: "MAINTENANCE",
    impact,
    maxImpact: 20,
    severity: getSeverityFromImpact(impact, 20),
    reason,
    details: {
      totalUnresolved: maintenanceRequests.length,
      counts,
    },
  };
};

// ============================================================
// MONITORING & SECURITY
// MAX: 25
// ============================================================

const calculateMonitoringRisk = (monitoringEvents) => {
  const severityScores = {
    CRITICAL: 15,
    HIGH: 10,
    MEDIUM: 5,
    LOW: 2,
    INFO: 0,
  };

  let impact = 0;

  const counts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };

  monitoringEvents.forEach((event) => {
    const severity = event.severity;

    if (severityScores[severity] !== undefined) {
      impact += severityScores[severity];

      counts[severity] += 1;
    }
  });

  impact = clamp(impact, 0, 25);

  let reason = "There are no unresolved monitoring events.";

  if (monitoringEvents.length > 0) {
    reason = `${monitoringEvents.length} unresolved monitoring event${
      monitoringEvents.length === 1 ? "" : "s"
    } require attention.`;
  }

  if (counts.CRITICAL > 0) {
    reason = `${counts.CRITICAL} unresolved critical monitoring event${
      counts.CRITICAL === 1 ? "" : "s"
    } require immediate attention.`;
  } else if (counts.HIGH > 0) {
    reason = `${counts.HIGH} unresolved high-severity monitoring event${
      counts.HIGH === 1 ? "" : "s"
    } require attention.`;
  }

  return {
    category: "MONITORING",
    impact,
    maxImpact: 25,
    severity: getSeverityFromImpact(impact, 25),
    reason,
    details: {
      totalUnresolved: monitoringEvents.length,
      counts,
    },
  };
};

// ============================================================
// DOCUMENTS
// MAX: 10
// ============================================================

const calculateDocumentRisk = (documents) => {
  let impact = 0;

  const counts = {
    expired: 0,
    expiringWithin7Days: 0,
    expiringWithin30Days: 0,
  };

  documents.forEach((document) => {
    if (!document.expiryDate) {
      return;
    }

    const daysUntilExpiry = getDaysUntil(document.expiryDate);

    if (document.status === "EXPIRED" || daysUntilExpiry < 0) {
      impact += 6;
      counts.expired += 1;

      return;
    }

    if (daysUntilExpiry <= 7) {
      impact += 4;
      counts.expiringWithin7Days += 1;

      return;
    }

    if (daysUntilExpiry <= 30) {
      impact += 2;
      counts.expiringWithin30Days += 1;
    }
  });

  impact = clamp(impact, 0, 10);

  let reason = "No document expiry risks were identified.";

  if (counts.expired > 0) {
    reason = `${counts.expired} active document${
      counts.expired === 1 ? "" : "s"
    } ${counts.expired === 1 ? "has" : "have"} expired.`;
  } else if (counts.expiringWithin7Days > 0) {
    reason = `${counts.expiringWithin7Days} document${
      counts.expiringWithin7Days === 1 ? "" : "s"
    } ${counts.expiringWithin7Days === 1 ? "is" : "are"} expiring within 7 days.`;
  } else if (counts.expiringWithin30Days > 0) {
    reason = `${counts.expiringWithin30Days} document${
      counts.expiringWithin30Days === 1 ? "" : "s"
    } ${counts.expiringWithin30Days === 1 ? "is" : "are"} expiring within 30 days.`;
  }

  return {
    category: "DOCUMENTS",
    impact,
    maxImpact: 10,
    severity: getSeverityFromImpact(impact, 10),
    reason,
    details: counts,
  };
};

// ============================================================
// INSPECTION FRESHNESS
// MAX: 5
// ============================================================

const calculateInspectionFreshnessRisk = (inspection) => {
  if (!inspection) {
    return {
      category: "INSPECTION_FRESHNESS",
      impact: 5,
      maxImpact: 5,
      severity: "HIGH",
      reason: "No completed inspection is available for the property.",
    };
  }

  const daysSinceInspection = getDaysSince(inspection.inspectedAt);

  let impact = 0;

  if (daysSinceInspection <= 30) {
    impact = 0;
  } else if (daysSinceInspection <= 60) {
    impact = 2;
  } else if (daysSinceInspection <= 90) {
    impact = 3;
  } else {
    impact = 5;
  }

  let reason = "The property was inspected within the last 30 days.";

  if (impact === 2) {
    reason = "The latest inspection is between 31 and 60 days old.";
  }

  if (impact === 3) {
    reason = "The latest inspection is between 61 and 90 days old.";
  }

  if (impact === 5) {
    reason = "The latest inspection is more than 90 days old.";
  }

  return {
    category: "INSPECTION_FRESHNESS",
    impact,
    maxImpact: 5,
    severity: getSeverityFromImpact(impact, 5),
    reason,
    details: {
      inspectedAt: inspection.inspectedAt,
      daysSinceInspection,
    },
  };
};

// ============================================================
// CARETAKER COVERAGE
// MAX: 5
// ============================================================

const calculateCaretakerRisk = (activeAssignment) => {
  if (activeAssignment) {
    return {
      category: "CARETAKER_COVERAGE",
      impact: 0,
      maxImpact: 5,
      severity: "NONE",
      reason: "The property has an active caretaker assignment.",
    };
  }

  return {
    category: "CARETAKER_COVERAGE",
    impact: 5,
    maxImpact: 5,
    severity: "HIGH",
    reason: "The property currently has no active caretaker assignment.",
  };
};

// ============================================================
// CONFIDENCE
// ============================================================

const calculateConfidence = ({
  property,
  inspection,
  maintenanceRequests,
  monitoringEvents,
  documents,
  activeAssignment,
}) => {
  let evidencePoints = 0;

  // Property itself always contributes basic evidence.
  if (property) {
    evidencePoints += 1;
  }

  if (inspection) {
    evidencePoints += 2;
  }

  if (maintenanceRequests.length > 0) {
    evidencePoints += 1;
  }

  if (monitoringEvents.length > 0) {
    evidencePoints += 1;
  }

  if (documents.length > 0) {
    evidencePoints += 1;
  }

  if (activeAssignment) {
    evidencePoints += 1;
  }

  if (evidencePoints >= 6) {
    return "HIGH";
  }

  if (evidencePoints >= 3) {
    return "MEDIUM";
  }

  return "LOW";
};

// ============================================================
// SUMMARY
// ============================================================

const generateSummary = (score, level, factors) => {
  const contributingFactors = factors
    .filter((factor) => factor.impact > 0)
    .sort((a, b) => b.impact - a.impact);

  if (contributingFactors.length === 0) {
    return "No significant operational or security risk signals were identified.";
  }

  const topFactor = contributingFactors[0];

  const factorNames = {
    PROPERTY_CONDITION: "property condition",
    INSPECTION: "inspection findings",
    MAINTENANCE: "maintenance activity",
    MONITORING: "monitoring and security events",
    DOCUMENTS: "document expiry",
    INSPECTION_FRESHNESS: "inspection freshness",
    CARETAKER_COVERAGE: "caretaker coverage",
  };

  const factorName = factorNames[topFactor.category] || "operational activity";

  if (level === "CRITICAL") {
    return `The property has critical observed risk, primarily influenced by ${factorName}.`;
  }

  if (level === "HIGH") {
    return `The property has elevated observed risk, primarily influenced by ${factorName}.`;
  }

  if (level === "MEDIUM") {
    return `The property has moderate observed risk, with ${factorName} being a significant contributing factor.`;
  }

  return `The property currently shows relatively low observed risk, with ${factorName} being the main contributing signal.`;
};

// ============================================================
// MAIN RISK CALCULATION
// ============================================================

const getPropertyRiskScore = async (propertyId) => {
  if (!mongoose.Types.ObjectId.isValid(propertyId)) {
    const error = new Error("Invalid property ID");

    error.statusCode = 400;

    throw error;
  }

  const property = await Property.findOne({
    _id: propertyId,
    isActive: true,
    status: "ACTIVE",
  }).lean();

  if (!property) {
    const error = new Error("Active property not found");

    error.statusCode = 404;

    throw error;
  }

  // ==========================================================
  // LOAD DATA IN PARALLEL
  // ==========================================================

  const [
    latestInspection,
    unresolvedMaintenance,
    unresolvedMonitoring,
    activeDocuments,
    activeCaretakerAssignment,
  ] = await Promise.all([
    Inspection.findOne({
      property: propertyId,
      status: "COMPLETED",
    })
      .sort({ inspectedAt: -1 })
      .lean(),

    MaintenanceRequest.find({
      property: propertyId,
      status: {
        $in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD"],
      },
    })
      .sort({ priority: -1, reportedAt: -1 })
      .lean(),

    MonitoringEvent.find({
      property: propertyId,
      isResolved: false,
    })
      .sort({ severity: -1, occurredAt: -1 })
      .lean(),

    Document.find({
      property: propertyId,
      isActive: true,
      status: {
        $in: ["ACTIVE", "EXPIRED"],
      },
      expiryDate: {
        $ne: null,
      },
    }).lean(),

    CaretakerAssignment.findOne({
      property: propertyId,
      status: "ACTIVE",
    })
      .sort({ startDate: -1 })
      .lean(),
  ]);

  // ==========================================================
  // CALCULATE FACTORS
  // ==========================================================

  const factors = [
    calculatePropertyConditionRisk(property),

    calculateInspectionRisk(latestInspection),

    calculateMaintenanceRisk(unresolvedMaintenance),

    calculateMonitoringRisk(unresolvedMonitoring),

    calculateDocumentRisk(activeDocuments),

    calculateInspectionFreshnessRisk(latestInspection),

    calculateCaretakerRisk(activeCaretakerAssignment),
  ];

  // ==========================================================
  // TOTAL SCORE
  // ==========================================================

  const score = clamp(
    factors.reduce((total, factor) => {
      return total + factor.impact;
    }, 0),
    0,
    MAX_RISK_SCORE,
  );

  const level = getRiskLevel(score);

  const confidence = calculateConfidence({
    property,
    inspection: latestInspection,
    maintenanceRequests: unresolvedMaintenance,
    monitoringEvents: unresolvedMonitoring,
    documents: activeDocuments,
    activeAssignment: activeCaretakerAssignment,
  });

  const summary = generateSummary(score, level, factors);

  // ==========================================================
  // RESPONSE
  // ==========================================================

  return {
    propertyId: property._id,
    propertyTitle: property.title,

    score,

    level,

    confidence,

    summary,

    factors,

    calculatedAt: new Date(),

    dataSnapshot: {
      latestInspectionAt: latestInspection
        ? latestInspection.inspectedAt
        : null,

      unresolvedMaintenanceCount: unresolvedMaintenance.length,

      unresolvedMonitoringCount: unresolvedMonitoring.length,

      activeDocumentCount: activeDocuments.length,

      hasActiveCaretaker: Boolean(activeCaretakerAssignment),
    },
  };
};

module.exports = {
  getPropertyRiskScore,

  // Exported separately so we can unit-test
  // individual calculations before building the API.
  calculatePropertyConditionRisk,
  calculateInspectionRisk,
  calculateMaintenanceRisk,
  calculateMonitoringRisk,
  calculateDocumentRisk,
  calculateInspectionFreshnessRisk,
  calculateCaretakerRisk,
  calculateConfidence,
  getRiskLevel,
};
