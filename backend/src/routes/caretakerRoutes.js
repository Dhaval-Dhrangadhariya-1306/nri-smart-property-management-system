const express = require("express");

const {
  createCaretaker,
  assignCaretaker,
  getPropertyCaretakers,
  getCurrentCaretaker,
  getMyAssignedProperties,
  getAssignedPropertyDetails,
  endCaretakerAssignment,
  getCaretakerAssignmentHistory,
} = require("../controllers/caretakerController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(protect);

// ============================================================
// CARETAKER SELF-SERVICE
// ============================================================

// Get all properties assigned to logged-in caretaker
router.get("/my-properties", authorize("CARETAKER"), getMyAssignedProperties);

// Get one property assigned to logged-in caretaker
router.get(
  "/my-properties/:propertyId",
  authorize("CARETAKER"),
  getAssignedPropertyDetails,
);

// ============================================================
// OWNER / ADMIN CARETAKER MANAGEMENT
// ============================================================

// Create a new caretaker
router.post("/create", authorize("NRI_OWNER", "ADMIN"), createCaretaker);

// Assign caretaker to property
router.post("/assign", authorize("NRI_OWNER", "ADMIN"), assignCaretaker);

// Get complete caretaker assignment history for a property
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyCaretakers,
);

// Get currently assigned caretaker
router.get(
  "/property/:propertyId/current",
  authorize("NRI_OWNER", "ADMIN"),
  getCurrentCaretaker,
);

// End current caretaker assignment
router.put(
  "/property/:propertyId/end",
  authorize("NRI_OWNER", "ADMIN"),
  endCaretakerAssignment,
);

// Get caretaker assignment history
router.get(
  "/:caretakerId/history",
  authorize("NRI_OWNER", "ADMIN"),
  getCaretakerAssignmentHistory,
);

module.exports = router;
