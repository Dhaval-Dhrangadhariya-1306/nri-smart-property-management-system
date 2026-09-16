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

router.post("/", authorize("NRI_OWNER", "ADMIN"), createProperty);

router.get("/my", authorize("NRI_OWNER", "ADMIN"), getMyProperties);

router.get(
  "/:id/inspections",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyInspectionHistory,
);

// RESTORE
router.patch("/:id/restore", authorize("NRI_OWNER", "ADMIN"), restoreProperty);

router.get("/:id", authorize("NRI_OWNER", "ADMIN"), getPropertyById);

router.put("/:id", authorize("NRI_OWNER", "ADMIN"), updateProperty);

router.delete("/:id", authorize("NRI_OWNER", "ADMIN"), deleteProperty);
// ============================================================
// EXPORT
// ============================================================

module.exports = router;
