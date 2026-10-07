const express = require("express");

const {
  createProperty,
  getMyProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  restoreProperty,
  getPropertyInspectionHistory,
  getPropertyStats,
  getPropertyRisk,
} = require("../controllers/propertyController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// ALL PROPERTY ROUTES REQUIRE AUTHENTICATION
// ============================================================

router.use(protect);

// ============================================================
// PROPERTY STATISTICS
// ============================================================

router.get("/stats", authorize("NRI_OWNER", "ADMIN"), getPropertyStats);

// ============================================================
// CREATE PROPERTY
// ============================================================

router.post("/", authorize("NRI_OWNER", "ADMIN"), createProperty);

// ============================================================
// GET MY PROPERTIES
// ============================================================

router.get("/my", authorize("NRI_OWNER", "ADMIN"), getMyProperties);

// ============================================================
// PROPERTY INSPECTION HISTORY
// ============================================================

router.get(
  "/:id/inspections",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyInspectionHistory,
);

// ============================================================
// AI PROPERTY RISK SCORE
// IMPORTANT: Must come before /:id
// ============================================================

router.get("/:id/risk-score", authorize("NRI_OWNER", "ADMIN"), getPropertyRisk);

// ============================================================
// RESTORE PROPERTY
// ============================================================

router.patch("/:id/restore", authorize("NRI_OWNER", "ADMIN"), restoreProperty);

// ============================================================
// GET PROPERTY BY ID
// ============================================================

router.get("/:id", authorize("NRI_OWNER", "ADMIN"), getPropertyById);

// ============================================================
// UPDATE PROPERTY
// ============================================================

router.put("/:id", authorize("NRI_OWNER", "ADMIN"), updateProperty);

// ============================================================
// ARCHIVE PROPERTY
// ============================================================

router.delete("/:id", authorize("NRI_OWNER", "ADMIN"), deleteProperty);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;
