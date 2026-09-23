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

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authMiddleware);

// ============================================================
// OWNER / ADMIN
// ============================================================

// Create caretaker
router.post("/create", authorize("NRI_OWNER", "ADMIN"), createCaretaker);

// Assign caretaker to property
router.post("/assign", authorize("NRI_OWNER", "ADMIN"), assignCaretaker);

// Get all caretaker assignments for a property
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyCaretakers,
);

// Get current caretaker of a property
router.get(
  "/property/:propertyId/current",
  authorize("NRI_OWNER", "ADMIN"),
  getCurrentCaretaker,
);

// End active caretaker assignment
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

// ============================================================
// CARETAKER
// ============================================================

// Get properties currently assigned to logged-in caretaker
router.get("/my-properties", authorize("CARETAKER"), getMyAssignedProperties);

// Get details of one assigned property
router.get(
  "/my-properties/:propertyId",
  authorize("CARETAKER"),
  getAssignedPropertyDetails,
);

module.exports = router;
