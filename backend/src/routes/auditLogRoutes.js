const express = require("express");

const {
  getMyAuditLogs,
  getPropertyAuditLogs,
  getPropertyActivityTimeline,
  getAuditLogById,
} = require("../controllers/auditLogController");

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authMiddleware);

// ============================================================
// MY AUDIT LOGS
// ============================================================

router.get("/my", authorize("NRI_OWNER", "ADMIN", "CARETAKER"), getMyAuditLogs);

// ============================================================
// PROPERTY AUDIT LOGS
// ============================================================

router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyAuditLogs,
);

// ============================================================
// PROPERTY ACTIVITY TIMELINE
// ============================================================

router.get(
  "/timeline/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyActivityTimeline,
);

// ============================================================
// SINGLE AUDIT LOG
// ============================================================

router.get(
  "/:id",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getAuditLogById,
);

module.exports = router;
