const express = require("express");

const {
  createInspection,
  getMyInspections,
  getPropertyInspections,
  getInspectionById,
} = require("../controllers/inspectionController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Inspections
 *   description: Property inspections created and managed by caretakers
 */

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(protect);

// ============================================================
// CARETAKER ROUTES
// ============================================================

/**
 * @swagger
 * /api/inspections:
 *   post:
 *     summary: Create an inspection
 *     operationId: createInspection
 *     description: Creates an inspection for a property managed by the caretaker.
 *     tags: [Inspections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Inspection data accepted by the inspection controller.
 *             additionalProperties: true
 *             properties:
 *               propertyId:
 *                 type: string
 *                 description: MongoDB ID of the property being inspected.
 *               notes:
 *                 type: string
 *                 description: Inspection notes, if supported by the controller.
 *               findings:
 *                 type: string
 *                 description: Inspection findings, if supported by the controller.
 *     responses:
 *       201:
 *         description: Inspection created successfully
 *       400:
 *         description: Invalid or incomplete inspection data
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Caretaker role required or property access denied
 *       404:
 *         description: Property not found
 */
router.post("/", authorize("CARETAKER"), createInspection);

/**
 * @swagger
 * /api/inspections/my:
 *   get:
 *     summary: Get my inspections
 *     operationId: getMyInspections
 *     description: Retrieves inspections created by the authenticated caretaker.
 *     tags: [Inspections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inspections retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Caretaker role required
 */
router.get("/my", authorize("CARETAKER"), getMyInspections);

/**
 * @swagger
 * /api/inspections/property/{propertyId}:
 *   get:
 *     summary: Get inspections for a property
 *     operationId: getPropertyInspections
 *     description: Retrieves inspection records for the specified property.
 *     tags: [Inspections]
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
 *         description: Property inspections retrieved successfully
 *       400:
 *         description: Invalid property ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Caretaker role required or property access denied
 *       404:
 *         description: Property not found
 */
router.get(
  "/property/:propertyId",
  authorize("CARETAKER"),
  getPropertyInspections,
);

/**
 * @swagger
 * /api/inspections/{inspectionId}:
 *   get:
 *     summary: Get an inspection by ID
 *     operationId: getInspectionById
 *     description: Retrieves a single inspection record.
 *     tags: [Inspections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inspectionId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the inspection.
 *     responses:
 *       200:
 *         description: Inspection retrieved successfully
 *       400:
 *         description: Invalid inspection ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Caretaker role required or inspection access denied
 *       404:
 *         description: Inspection not found
 */
router.get("/:inspectionId", authorize("CARETAKER"), getInspectionById);

module.exports = router;
