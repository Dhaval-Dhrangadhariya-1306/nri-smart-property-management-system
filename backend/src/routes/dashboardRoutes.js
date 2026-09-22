const express = require("express");

const {
  getOwnerDashboard,
  getPropertyIntelligence,
  getFinancialDashboard,
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

module.exports = router;
