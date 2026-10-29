const express = require("express");

const {
  createMaintenanceRequest,
  getOwnerMaintenanceRequests,
  getPropertyMaintenanceRequests,
  getCaretakerMaintenanceRequests,
  assignVendorToMaintenance,
  updateMaintenanceStatus,
  cancelMaintenanceRequest,
  getMaintenanceRequestById,
} = require("../controllers/maintenanceController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Maintenance
 *   description: Maintenance requests, vendor assignments, and status tracking
 */

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(protect);

// ============================================================
// OWNER / ADMIN ROUTES
// ============================================================

/**
 * @swagger
 * /api/maintenance:
 *   post:
 *     operationId: createMaintenanceRequest
 *     summary: Create a maintenance request
 *     description: Creates a maintenance request for a property.
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Maintenance request data accepted by the controller.
 *             additionalProperties: true
 *             properties:
 *               propertyId:
 *                 type: string
 *                 description: MongoDB ID of the property.
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               priority:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Maintenance request created successfully
 *       400:
 *         description: Invalid or incomplete request data
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.post("/", authorize("NRI_OWNER", "ADMIN"), createMaintenanceRequest);

/**
 * @swagger
 * /api/maintenance/my:
 *   get:
 *     operationId: getOwnerMaintenanceRequests
 *     summary: Get my maintenance requests
 *     description: Retrieves maintenance requests associated with the authenticated owner.
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Maintenance requests retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get("/my", authorize("NRI_OWNER", "ADMIN"), getOwnerMaintenanceRequests);

/**
 * @swagger
 * /api/maintenance/property/{propertyId}:
 *   get:
 *     operationId: getPropertyMaintenanceRequests
 *     summary: Get maintenance requests for a property
 *     description: Retrieves maintenance requests associated with the specified property.
 *     tags: [Maintenance]
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
 *         description: Property maintenance requests retrieved successfully
 *       400:
 *         description: Invalid property ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Property not found
 */
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyMaintenanceRequests,
);

/**
 * @swagger
 * /api/maintenance/{requestId}/vendor:
 *   patch:
 *     operationId: assignVendorToMaintenance
 *     summary: Assign or change a maintenance vendor
 *     description: Assigns a vendor to a maintenance request or changes its vendor.
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the maintenance request.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vendorId
 *             properties:
 *               vendorId:
 *                 type: string
 *                 description: MongoDB ID of the vendor.
 *     responses:
 *       200:
 *         description: Vendor assignment updated successfully
 *       400:
 *         description: Invalid request or vendor ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Maintenance request or vendor not found
 */
router.patch(
  "/:requestId/vendor",
  authorize("NRI_OWNER", "ADMIN"),
  assignVendorToMaintenance,
);

/**
 * @swagger
 * /api/maintenance/{requestId}/cancel:
 *   patch:
 *     operationId: cancelMaintenanceRequest
 *     summary: Cancel a maintenance request
 *     description: Cancels a maintenance request according to the application's business rules.
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the maintenance request.
 *     responses:
 *       200:
 *         description: Maintenance request cancellation processed successfully
 *       400:
 *         description: Request cannot be cancelled or data is invalid
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Maintenance request not found
 */
router.patch(
  "/:requestId/cancel",
  authorize("NRI_OWNER", "ADMIN"),
  cancelMaintenanceRequest,
);

// ============================================================
// CARETAKER ROUTES
// ============================================================

/**
 * @swagger
 * /api/maintenance/caretaker/my:
 *   get:
 *     operationId: getCaretakerMaintenanceRequests
 *     summary: Get my assigned maintenance requests
 *     description: Retrieves maintenance requests assigned to the authenticated caretaker.
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Caretaker maintenance requests retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Caretaker role required
 */
router.get(
  "/caretaker/my",
  authorize("CARETAKER"),
  getCaretakerMaintenanceRequests,
);

/**
 * @swagger
 * /api/maintenance/{requestId}/status:
 *   patch:
 *     operationId: updateMaintenanceStatus
 *     summary: Update maintenance status
 *     description: Updates the status of a maintenance request.
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the maintenance request.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Status update data accepted by the controller.
 *             additionalProperties: true
 *             properties:
 *               status:
 *                 type: string
 *                 example: IN_PROGRESS
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Maintenance status updated successfully
 *       400:
 *         description: Invalid status or request data
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Caretaker role required or operation not permitted
 *       404:
 *         description: Maintenance request not found
 */
router.patch(
  "/:requestId/status",
  authorize("CARETAKER"),
  updateMaintenanceStatus,
);

// ============================================================
// SHARED DETAIL ROUTE
// ============================================================

/**
 * @swagger
 * /api/maintenance/{requestId}:
 *   get:
 *     operationId: getMaintenanceRequestById
 *     summary: Get a maintenance request by ID
 *     description: Retrieves the details of a maintenance request.
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the maintenance request.
 *     responses:
 *       200:
 *         description: Maintenance request retrieved successfully
 *       400:
 *         description: Invalid request ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Maintenance request not found
 */
router.get(
  "/:requestId",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getMaintenanceRequestById,
);

module.exports = router;
