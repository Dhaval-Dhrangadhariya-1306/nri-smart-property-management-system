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
// CREATE MAINTENANCE REQUEST
// ============================================================

/**
 * @swagger
 * /api/maintenance:
 *   post:
 *     operationId: createMaintenanceRequest
 *     summary: Create a maintenance request
 *     description: >
 *       Creates a maintenance request for an authorized property.
 *       NRI owners and administrators can create requests according
 *       to their existing permissions. Caretakers can create requests
 *       only for properties to which they have an active assignment.
 *       Caretaker identity and assignment information must be derived
 *       and validated by the backend.
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - propertyId
 *               - title
 *               - description
 *               - category
 *             properties:
 *               propertyId:
 *                 type: string
 *                 description: MongoDB ID of the property.
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 150
 *               description:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 2000
 *               category:
 *                 type: string
 *                 enum:
 *                   - ELECTRICAL
 *                   - PLUMBING
 *                   - SECURITY
 *                   - STRUCTURAL
 *                   - CLEANING
 *                   - APPLIANCE
 *                   - HVAC
 *                   - PEST_CONTROL
 *                   - OTHER
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 default: MEDIUM
 *               notes:
 *                 type: string
 *                 maxLength: 2000
 *           example:
 *             propertyId: "6aa97840f532befd1c175245"
 *             title: "Bathroom Water Leakage"
 *             description: "Water is leaking from the bathroom pipe."
 *             category: "PLUMBING"
 *             priority: "HIGH"
 *             notes: "Reported during property inspection."
 *     responses:
 *       201:
 *         description: Maintenance request created successfully.
 *       400:
 *         description: Invalid or incomplete request data.
 *       401:
 *         description: Authentication required or token invalid.
 *       403:
 *         description: User is not authorized for the selected property.
 *       404:
 *         description: Property not found.
 */
router.post(
  "/",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  createMaintenanceRequest,
);

// ============================================================
// OWNER / ADMIN ROUTES
// ============================================================

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
 *         description: Maintenance requests retrieved successfully.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Owner or administrator role required.
 */
router.get(
  "/my",
  authorize("NRI_OWNER", "ADMIN"),
  getOwnerMaintenanceRequests,
);

/**
 * @swagger
 * /api/maintenance/property/{propertyId}:
 *   get:
 *     operationId: getPropertyMaintenanceRequests
 *     summary: Get maintenance requests for a property
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property maintenance requests retrieved successfully.
 *       400:
 *         description: Invalid property ID.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Owner or administrator role required.
 *       404:
 *         description: Property not found.
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
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Vendor assignment updated successfully.
 *       400:
 *         description: Invalid request or vendor ID.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Owner or administrator role required.
 *       404:
 *         description: Maintenance request or vendor not found.
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
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Maintenance request cancellation processed successfully.
 *       400:
 *         description: Request cannot be cancelled.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Owner or administrator role required.
 *       404:
 *         description: Maintenance request not found.
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
 *         description: Caretaker maintenance requests retrieved successfully.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Caretaker role required.
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
 *     description: Updates the status of a maintenance request according to caretaker authorization rules.
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [IN_PROGRESS, ON_HOLD, COMPLETED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Maintenance status updated successfully.
 *       400:
 *         description: Invalid status or request data.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: Caretaker is not authorized for this request.
 *       404:
 *         description: Maintenance request not found.
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
 *     description: Retrieves a maintenance request after backend authorization checks.
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Maintenance request retrieved successfully.
 *       400:
 *         description: Invalid request ID.
 *       401:
 *         description: Authentication required.
 *       403:
 *         description: User is not authorized to view this request.
 *       404:
 *         description: Maintenance request not found.
 */
router.get(
  "/:requestId",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getMaintenanceRequestById,
);

module.exports = router;