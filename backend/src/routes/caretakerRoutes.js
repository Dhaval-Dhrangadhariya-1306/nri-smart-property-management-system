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
// SWAGGER TAG
// ============================================================

/**
 * @swagger
 * tags:
 *   name: Caretakers
 *   description: Caretaker management, property assignments, and assignment history
 */

// ============================================================
// OWNER / ADMIN
// ============================================================

/**
 * @swagger
 * /api/caretakers/create:
 *   post:
 *     summary: Create a caretaker account
 *     operationId: createCaretaker
 *     description: Creates an active caretaker account. The password is hashed before storage and is never returned in the response.
 *     tags: [Caretakers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: Rajesh Patel
 *               email:
 *                 type: string
 *                 format: email
 *                 example: rajesh.caretaker@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: ChangeMe123!
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *                 nullable: true
 *                 example: "+919876543210"
 *     responses:
 *       '201':
 *         description: Caretaker created successfully.
 *       '400':
 *         description: Required fields are missing or one or more fields are invalid.
 *       '401':
 *         description: Authentication required or token invalid.
 *       '403':
 *         description: Insufficient permissions.
 *       '409':
 *         description: A user with this email already exists.
 *       '500':
 *         description: Internal server error.
 */
router.post("/create", authorize("NRI_OWNER", "ADMIN"), createCaretaker);

/**
 * @swagger
 * /api/caretakers/assign:
 *   post:
 *     summary: Assign a caretaker to a property
 *     operationId: assignCaretaker
 *     description: Assigns an active caretaker to an active property owned by the authenticated owner. A property can have only one active caretaker assignment at a time.
 *     tags: [Caretakers]
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
 *               - caretakerId
 *             properties:
 *               propertyId:
 *                 type: string
 *                 description: MongoDB ObjectId of the property.
 *                 example: 6ae233319d6bcf4a1147e2be
 *               caretakerId:
 *                 type: string
 *                 description: MongoDB ObjectId of an active caretaker account.
 *                 example: 64f000000000000000000002
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Assignment start date. Defaults to the current date and time when omitted.
 *                 example: '2026-10-29T10:00:00.000Z'
 *               responsibilities:
 *                 type: array
 *                 description: Responsibilities assigned to the caretaker. Each entry must be a non-empty string of at most 200 characters.
 *                 items:
 *                   type: string
 *                   maxLength: 200
 *                 example:
 *                   - Property inspections
 *                   - Maintenance coordination
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional assignment notes.
 *                 example: Contact the owner before arranging major repairs.
 *     responses:
 *       '201':
 *         description: Caretaker assigned successfully.
 *       '400':
 *         description: Missing required fields, invalid IDs, invalid responsibilities, invalid notes, or invalid start date.
 *       '401':
 *         description: Authentication required or token invalid.
 *       '403':
 *         description: Insufficient permissions.
 *       '404':
 *         description: Property not found, permission to manage it denied, or active caretaker not found.
 *       '409':
 *         description: The property already has an active caretaker assignment.
 *       '500':
 *         description: Internal server error.
 */
router.post("/assign", authorize("NRI_OWNER", "ADMIN"), assignCaretaker);

/**
 * @swagger
 * /api/caretakers/property/{propertyId}:
 *   get:
 *     summary: Get caretaker assignments for a property
 *     operationId: getPropertyCaretakers
 *     description: Retrieves the assignment history for a property owned by the authenticated user.
 *     tags: [Caretakers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property MongoDB ObjectId.
 *     responses:
 *       '200':
 *         description: Caretaker assignments retrieved successfully. The response includes the count, property information, and assignments.
 *       '400':
 *         description: Invalid property ID.
 *       '401':
 *         description: Authentication required or token invalid.
 *       '403':
 *         description: Insufficient permissions.
 *       '404':
 *         description: Property not found or the user does not have permission to view it.
 *       '500':
 *         description: Internal server error.
 */
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyCaretakers,
);

/**
 * @swagger
 * /api/caretakers/property/{propertyId}/current:
 *   get:
 *     summary: Get the current caretaker of a property
 *     operationId: getCurrentCaretaker
 *     description: Retrieves the active caretaker assignment for a property. If no active assignment exists, the endpoint returns HTTP 200 with data.assignment set to null.
 *     tags: [Caretakers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property MongoDB ObjectId.
 *     responses:
 *       '200':
 *         description: Current caretaker retrieved, or no active caretaker assignment exists.
 *       '400':
 *         description: Invalid property ID.
 *       '401':
 *         description: Authentication required or token invalid.
 *       '403':
 *         description: Insufficient permissions.
 *       '404':
 *         description: Property not found or the user does not have permission to view it.
 *       '500':
 *         description: Internal server error.
 */
router.get(
  "/property/:propertyId/current",
  authorize("NRI_OWNER", "ADMIN"),
  getCurrentCaretaker,
);

/**
 * @swagger
 * /api/caretakers/property/{propertyId}/end:
 *   put:
 *     summary: End an active caretaker assignment
 *     operationId: endCaretakerAssignment
 *     description: Completes the active assignment and clears the caretaker reference on the property.
 *     tags: [Caretakers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property MongoDB ObjectId.
 *     responses:
 *       '200':
 *         description: Caretaker assignment ended successfully.
 *       '400':
 *         description: Invalid property ID.
 *       '401':
 *         description: Authentication required or token invalid.
 *       '403':
 *         description: Insufficient permissions.
 *       '404':
 *         description: Property not found or no active caretaker assignment exists.
 *       '500':
 *         description: Internal server error.
 */
router.put(
  "/property/:propertyId/end",
  authorize("NRI_OWNER", "ADMIN"),
  endCaretakerAssignment,
);

/**
 * @swagger
 * /api/caretakers/{caretakerId}/history:
 *   get:
 *     summary: Get caretaker assignment history
 *     operationId: getCaretakerAssignmentHistory
 *     description: Retrieves assignment history for a caretaker, restricted to active properties owned by the authenticated user.
 *     tags: [Caretakers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caretakerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caretaker MongoDB ObjectId.
 *     responses:
 *       '200':
 *         description: Caretaker details and assignment history retrieved successfully.
 *       '400':
 *         description: Invalid caretaker ID.
 *       '401':
 *         description: Authentication required or token invalid.
 *       '403':
 *         description: Insufficient permissions.
 *       '404':
 *         description: Caretaker not found.
 *       '500':
 *         description: Internal server error.
 */
router.get(
  "/:caretakerId/history",
  authorize("NRI_OWNER", "ADMIN"),
  getCaretakerAssignmentHistory,
);

// ============================================================
// CARETAKER
// ============================================================

/**
 * @swagger
 * /api/caretakers/my-properties:
 *   get:
 *     summary: Get properties assigned to the logged-in caretaker
 *     operationId: getMyAssignedProperties
 *     description: Retrieves the authenticated caretaker's active assignments and their active properties. Returns an empty assignments array when there are no active assignments.
 *     tags: [Caretakers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Assigned properties retrieved successfully.
 *       '401':
 *         description: Authentication required or token invalid.
 *       '403':
 *         description: The authenticated user is not authorized as a caretaker.
 *       '500':
 *         description: Internal server error.
 */
router.get("/my-properties", authorize("CARETAKER"), getMyAssignedProperties);

/**
 * @swagger
 * /api/caretakers/my-properties/{propertyId}:
 *   get:
 *     summary: Get details of an assigned property
 *     operationId: getAssignedPropertyDetails
 *     description: Retrieves property and assignment details when the authenticated caretaker has an active assignment for the property.
 *     tags: [Caretakers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: Property MongoDB ObjectId.
 *     responses:
 *       '200':
 *         description: Assigned property details retrieved successfully.
 *       '400':
 *         description: Invalid property ID.
 *       '401':
 *         description: Authentication required or token invalid.
 *       '403':
 *         description: The caretaker does not have an active assignment for this property.
 *       '404':
 *         description: The property is no longer active or available.
 *       '500':
 *         description: Internal server error.
 */
router.get(
  "/my-properties/:propertyId",
  authorize("CARETAKER"),
  getAssignedPropertyDetails,
);

module.exports = router;
