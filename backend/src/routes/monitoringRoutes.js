const express = require("express");

const {
  createMonitoringEvent,
  getPropertyEvents,
  getMyMonitoringEvents,
  acknowledgeEvent,
  resolveEvent,
} = require("../controllers/monitoringController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// All monitoring routes require authentication
router.use(protect);

// ============================================================
// OWNER / ADMIN ROUTES
// ============================================================

// Create a security/monitoring event
router.post("/", authorize("NRI_OWNER", "ADMIN"), createMonitoringEvent);

// Get all monitoring events belonging to logged-in owner
router.get("/my", authorize("NRI_OWNER", "ADMIN"), getMyMonitoringEvents);

// Get events for a specific property
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyEvents,
);

// Acknowledge an event
router.patch(
  "/:eventId/acknowledge",
  authorize("NRI_OWNER", "ADMIN"),
  acknowledgeEvent,
);

// Resolve an event
router.patch(
  "/:eventId/resolve",
  authorize("NRI_OWNER", "ADMIN"),
  resolveEvent,
);

module.exports = router;
