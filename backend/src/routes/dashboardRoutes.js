const express = require("express");

const {
  getOwnerDashboard,
  getPropertyIntelligence,
  getFinancialDashboard,
  getPropertyHealthDashboard,
  getCaretakerPerformanceDashboard,
} = require("../controllers/dashboardController");

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authMiddleware);

// ============================================================
// OWNER DASHBOARD
// ============================================================

router.get("/owner", authorize("NRI_OWNER", "ADMIN"), getOwnerDashboard);

// ============================================================
// PROPERTY INTELLIGENCE
// ============================================================

router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyIntelligence,
);

// ============================================================
// FINANCIAL DASHBOARD
// ============================================================

router.get(
  "/financial",
  authorize("NRI_OWNER", "ADMIN"),
  getFinancialDashboard,
);

// ============================================================
// PROPERTY HEALTH DASHBOARD
// ============================================================

router.get(
  "/property-health",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyHealthDashboard,
);

// ============================================================
// CARETAKER PERFORMANCE DASHBOARD
// ============================================================

router.get(
  "/caretaker-performance",
  authorize("NRI_OWNER", "ADMIN"),
  getCaretakerPerformanceDashboard,
);

module.exports = router;
