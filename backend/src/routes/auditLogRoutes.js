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

/**
 * @swagger
 * tags:
 *   name: Audit Logs
 *   description: Audit records and property activity timelines
 */

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authMiddleware);

// ============================================================
// MY AUDIT LOGS
// ============================================================

/**
 * @swagger
 * /api/audit-logs/my:
 *   get:
 *     summary: Get my audit logs
 *     operationId: getMyAuditLogs
 *     description: Retrieves audit log records available to the authenticated user.
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get("/my", authorize("NRI_OWNER", "ADMIN", "CARETAKER"), getMyAuditLogs);

// ============================================================
// PROPERTY AUDIT LOGS
// ============================================================

/**
 * @swagger
 * /api/audit-logs/property/{propertyId}:
 *   get:
 *     summary: Get property audit logs
 *     operationId: getPropertyAuditLogs
 *     description: Retrieves audit records associated with a specific property.
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the property.
 *     responses:
 *       200:
 *         description: Property audit logs retrieved successfully
 *       400:
 *         description: Invalid property ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions or property access denied
 *       404:
 *         description: Property not found
 */
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyAuditLogs,
);

// ============================================================
// PROPERTY ACTIVITY TIMELINE
// ============================================================

/**
 * @swagger
 * /api/audit-logs/timeline/property/{propertyId}:
 *   get:
 *     summary: Get property activity timeline
 *     operationId: getPropertyActivityTimeline
 *     description: Retrieves the activity timeline associated with a specific property.
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the property.
 *     responses:
 *       200:
 *         description: Property activity timeline retrieved successfully
 *       400:
 *         description: Invalid property ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions or property access denied
 *       404:
 *         description: Property not found
 */
router.get(
  "/timeline/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyActivityTimeline,
);

// ============================================================
// SINGLE AUDIT LOG
// ============================================================

/**
 * @swagger
 * /api/audit-logs/{id}:
 *   get:
 *     summary: Get an audit log by ID
 *     operationId: getAuditLogById
 *     description: Retrieves a specific audit log record.
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the audit log.
 *     responses:
 *       200:
 *         description: Audit log retrieved successfully
 *       400:
 *         description: Invalid audit log ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Audit log not found
 */
router.get(
  "/:id",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getAuditLogById,
);

module.exports = router;
