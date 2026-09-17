const express = require("express");

const {
  createInspection,
  getMyInspections,
  getPropertyInspections,
  getInspectionById,
} = require("../controllers/inspectionController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(protect);

// ============================================================
// CARETAKER INSPECTION ROUTES
// ============================================================

// Create inspection
router.post("/", authorize("CARETAKER"), createInspection);

// Get inspections created by logged-in caretaker
router.get("/my", authorize("CARETAKER"), getMyInspections);

// Get inspection history for assigned property
router.get(
  "/property/:propertyId",
  authorize("CARETAKER"),
  getPropertyInspections,
);

// Get one inspection created by logged-in caretaker
router.get("/:inspectionId", authorize("CARETAKER"), getInspectionById);

module.exports = router;
