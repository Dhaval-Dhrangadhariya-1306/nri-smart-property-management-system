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

/**
 * @swagger
 * tags:
 *   name: Monitoring
 *   description: Property security events, monitoring, acknowledgement, and resolution
 */

// All monitoring routes require authentication
router.use(protect);

// ============================================================
// OWNER / ADMIN ROUTES
// ============================================================

/**
 * @swagger
 * /api/monitoring:
 *   post:
 *     operationId: createMonitoringEvent
 *     summary: Create a monitoring event
 *     description: Creates a security or monitoring event for a property.
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Event fields accepted by the monitoring controller.
 *             additionalProperties: true
 *             properties:
 *               propertyId:
 *                 type: string
 *                 description: MongoDB ID of the property.
 *               eventType:
 *                 type: string
 *                 example: SECURITY_ALERT
 *               title:
 *                 type: string
 *                 example: Unusual activity detected
 *               description:
 *                 type: string
 *               severity:
 *                 type: string
 *                 example: HIGH
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Monitoring event created successfully
 *       400:
 *         description: Invalid or incomplete event data
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions or property access denied
 *       404:
 *         description: Property not found
 */
router.post("/", authorize("NRI_OWNER", "ADMIN"), createMonitoringEvent);

/**
 * @swagger
 * /api/monitoring/my:
 *   get:
 *     operationId: getMyMonitoringEvents
 *     summary: Get my monitoring events
 *     description: Retrieves monitoring events belonging to the authenticated owner.
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monitoring events retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get("/my", authorize("NRI_OWNER", "ADMIN"), getMyMonitoringEvents);

/**
 * @swagger
 * /api/monitoring/property/{propertyId}:
 *   get:
 *     operationId: getPropertyMonitoringEvents
 *     summary: Get monitoring events for a property
 *     description: Retrieves monitoring events associated with a specific property.
 *     tags: [Monitoring]
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
 *         description: Property monitoring events retrieved successfully
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
  getPropertyEvents,
);

/**
 * @swagger
 * /api/monitoring/{eventId}/acknowledge:
 *   patch:
 *     operationId: acknowledgeMonitoringEvent
 *     summary: Acknowledge a monitoring event
 *     description: Acknowledges an event according to the application's business rules.
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the monitoring event.
 *     responses:
 *       200:
 *         description: Event acknowledgement processed successfully
 *       400:
 *         description: Invalid event ID or event cannot be acknowledged
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Monitoring event not found
 */
router.patch(
  "/:eventId/acknowledge",
  authorize("NRI_OWNER", "ADMIN"),
  acknowledgeEvent,
);

/**
 * @swagger
 * /api/monitoring/{eventId}/resolve:
 *   patch:
 *     operationId: resolveMonitoringEvent
 *     summary: Resolve a monitoring event
 *     description: Resolves an event according to the application's business rules.
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the monitoring event.
 *     responses:
 *       200:
 *         description: Event resolution processed successfully
 *       400:
 *         description: Invalid event ID or event cannot be resolved
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Monitoring event not found
 */
router.patch(
  "/:eventId/resolve",
  authorize("NRI_OWNER", "ADMIN"),
  resolveEvent,
);

module.exports = router;