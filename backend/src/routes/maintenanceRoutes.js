const express = require("express");

const {
  createMaintenanceRequest,
  getOwnerMaintenanceRequests,
  getPropertyMaintenanceRequests,
  getCaretakerMaintenanceRequests,
  assignVendorToMaintenance,
  updateMaintenanceStatus,
  getMaintenanceRequestById,
} = require("../controllers/maintenanceController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(protect);

// ============================================================
// OWNER / ADMIN ROUTES
// ============================================================

// Create maintenance request
router.post("/", authorize("NRI_OWNER", "ADMIN"), createMaintenanceRequest);

// Get maintenance requests reported by logged-in owner
router.get("/my", authorize("NRI_OWNER", "ADMIN"), getOwnerMaintenanceRequests);

// Get maintenance requests for a property
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyMaintenanceRequests,
);

// Assign / change vendor
router.patch(
  "/:requestId/vendor",
  authorize("NRI_OWNER", "ADMIN"),
  assignVendorToMaintenance,
);

// ============================================================
// CARETAKER ROUTES
// ============================================================

// Get maintenance requests assigned to logged-in caretaker
router.get(
  "/caretaker/my",
  authorize("CARETAKER"),
  getCaretakerMaintenanceRequests,
);

// Update maintenance request status
router.patch(
  "/:requestId/status",
  authorize("CARETAKER"),
  updateMaintenanceStatus,
);

// ============================================================
// SHARED REQUEST ACCESS
// ============================================================

// Get one maintenance request
// Controller ensures the user is either:
// - the reporter
// - the assigned caretaker
router.get(
  "/:requestId",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getMaintenanceRequestById,
);

module.exports = router;
