const express = require("express");

const {
  getOwnerDashboard,
  getPropertyIntelligence,
} = require("../controllers/dashboardController");

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// Authentication required for all dashboard routes
router.use(authMiddleware);

// Owner dashboard
router.get("/owner", authorize("NRI_OWNER", "ADMIN"), getOwnerDashboard);

// Single property intelligence
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyIntelligence,
);

module.exports = router;
