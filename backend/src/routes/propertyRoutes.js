const express = require("express");

const {
  createProperty,
  getMyProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  restoreProperty,
  getPropertyInspectionHistory,
  getPropertyStats,
  getPropertyRisk,
} = require("../controllers/propertyController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// SWAGGER DOCUMENTATION
// ============================================================

/**
 * @swagger
 * tags:
 *   name: Properties
 *   description: Property management, statistics, inspections, and risk assessment
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PropertyAddress:
 *       type: object
 *       required:
 *         - addressLine1
 *         - city
 *         - state
 *         - postalCode
 *       properties:
 *         addressLine1:
 *           type: string
 *           example: 25 Green Avenue
 *         addressLine2:
 *           type: string
 *           example: Near City Mall
 *         city:
 *           type: string
 *           example: Ahmedabad
 *         state:
 *           type: string
 *           example: Gujarat
 *         country:
 *           type: string
 *           default: India
 *           example: India
 *         postalCode:
 *           type: string
 *           example: "380001"
 *
 *     Property:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 65f123456789abcdef123456
 *         owner:
 *           type: string
 *           description: ID of the property owner
 *         title:
 *           type: string
 *           example: Ahmedabad Family Home
 *         propertyType:
 *           type: string
 *           enum:
 *             - APARTMENT
 *             - HOUSE
 *             - VILLA
 *             - PLOT
 *             - COMMERCIAL
 *             - OFFICE
 *             - OTHER
 *         address:
 *           $ref: '#/components/schemas/PropertyAddress'
 *         status:
 *           type: string
 *           enum: [ACTIVE, ARCHIVED]
 *         occupancy:
 *           type: string
 *           enum: [VACANT, OCCUPIED]
 *         condition:
 *           type: string
 *           enum: [GOOD, FAIR, NEEDS_ATTENTION, CRITICAL]
 *         description:
 *           type: string
 *         area:
 *           type: object
 *           properties:
 *             value:
 *               type: number
 *               minimum: 0
 *               example: 1500
 *             unit:
 *               type: string
 *               enum: [SQ_FT, SQ_M, SQ_YD]
 *         structure:
 *           type: object
 *           properties:
 *             bedrooms:
 *               type: integer
 *               minimum: 0
 *             bathrooms:
 *               type: integer
 *               minimum: 0
 *             floors:
 *               type: integer
 *               minimum: 0
 *             parkingSpaces:
 *               type: integer
 *               minimum: 0
 *         caretaker:
 *           type: string
 *           nullable: true
 *         security:
 *           type: object
 *           properties:
 *             securityLevel:
 *               type: string
 *               enum: [LOW, MEDIUM, HIGH]
 *             accessNotes:
 *               type: string
 *             emergencyContact:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 relationship:
 *                   type: string
 *         health:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               minimum: 0
 *               maximum: 100
 *             lastCalculatedAt:
 *               type: string
 *               format: date-time
 *         lastInspectionAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         nextInspectionAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         lastMaintenanceAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         imageUrl:
 *           type: string
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     PropertyInput:
 *       type: object
 *       required:
 *         - title
 *         - propertyType
 *         - address
 *       properties:
 *         title:
 *           type: string
 *           minLength: 3
 *           maxLength: 150
 *           example: Ahmedabad Family Home
 *         propertyType:
 *           type: string
 *           enum:
 *             - APARTMENT
 *             - HOUSE
 *             - VILLA
 *             - PLOT
 *             - COMMERCIAL
 *             - OFFICE
 *             - OTHER
 *           example: APARTMENT
 *         address:
 *           $ref: '#/components/schemas/PropertyAddress'
 *         occupancy:
 *           type: string
 *           enum: [VACANT, OCCUPIED]
 *           default: VACANT
 *         condition:
 *           type: string
 *           enum: [GOOD, FAIR, NEEDS_ATTENTION, CRITICAL]
 *           default: GOOD
 *         description:
 *           type: string
 *           maxLength: 2000
 *         area:
 *           type: object
 *           properties:
 *             value:
 *               type: number
 *               minimum: 0
 *               example: 1500
 *             unit:
 *               type: string
 *               enum: [SQ_FT, SQ_M, SQ_YD]
 *               default: SQ_FT
 *         structure:
 *           type: object
 *           properties:
 *             bedrooms:
 *               type: integer
 *               minimum: 0
 *               example: 3
 *             bathrooms:
 *               type: integer
 *               minimum: 0
 *               example: 2
 *             floors:
 *               type: integer
 *               minimum: 0
 *               example: 2
 *             parkingSpaces:
 *               type: integer
 *               minimum: 0
 *               example: 1
 *         security:
 *           type: object
 *           properties:
 *             securityLevel:
 *               type: string
 *               enum: [LOW, MEDIUM, HIGH]
 *               default: MEDIUM
 *             accessNotes:
 *               type: string
 *             emergencyContact:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 relationship:
 *                   type: string
 *         imageUrl:
 *           type: string
 *           example: https://example.com/property.jpg
 *
 *     ApiError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: An error occurred
 */

// ============================================================
// ALL PROPERTY ROUTES REQUIRE AUTHENTICATION
// ============================================================

router.use(protect);

// ============================================================
// PROPERTY STATISTICS
// ============================================================

/**
 * @swagger
 * /api/properties/stats:
 *   get:
 *     operationId: getPropertyStats
 *     summary: Get property statistics
 *     description: Retrieves property statistics for the authenticated owner or an authorized administrator.
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Property statistics retrieved successfully
 *       401:
 *         description: Authentication token is missing or invalid
 *       403:
 *         description: User is not authorized to access property statistics
 */
router.get("/stats", authorize("NRI_OWNER", "ADMIN"), getPropertyStats);

// ============================================================
// CREATE PROPERTY
// ============================================================

/**
 * @swagger
 * /api/properties:
 *   post:
 *     operationId: createProperty
 *     summary: Create a property
 *     description: Creates a property for the authenticated owner. Only NRI_OWNER and ADMIN roles are allowed.
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PropertyInput'
 *     responses:
 *       201:
 *         description: Property created successfully
 *       400:
 *         description: Invalid property data or validation error
 *       401:
 *         description: Authentication token is missing or invalid
 *       403:
 *         description: User is not authorized to create a property
 */
router.post("/", authorize("NRI_OWNER", "ADMIN"), createProperty);

// ============================================================
// GET MY PROPERTIES
// ============================================================

/**
 * @swagger
 * /api/properties/my:
 *   get:
 *     operationId: getMyProperties
 *     summary: Get my properties
 *     description: Retrieves properties belonging to the authenticated owner.
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Properties retrieved successfully
 *       401:
 *         description: Authentication token is missing or invalid
 *       403:
 *         description: User is not authorized to access these properties
 */
router.get("/my", authorize("NRI_OWNER", "ADMIN"), getMyProperties);

// ============================================================
// PROPERTY INSPECTION HISTORY
// ============================================================

/**
 * @swagger
 * /api/properties/{id}/inspections:
 *   get:
 *     operationId: getPropertyInspectionHistory
 *     summary: Get property inspection history
 *     description: Retrieves inspection history associated with a property.
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB property ID
 *     responses:
 *       200:
 *         description: Inspection history retrieved successfully
 *       400:
 *         description: Invalid property ID
 *       401:
 *         description: Authentication token is missing or invalid
 *       403:
 *         description: User is not authorized to access this property
 *       404:
 *         description: Property not found
 */
router.get(
  "/:id/inspections",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyInspectionHistory,
);

// ============================================================
// AI PROPERTY RISK SCORE
// IMPORTANT: Must come before /:id
// ============================================================

/**
 * @swagger
 * /api/properties/{id}/risk-score:
 *   get:
 *     operationId: getPropertyRisk
 *     summary: Get property risk score
 *     description: Retrieves the risk assessment for a property.
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB property ID
 *     responses:
 *       200:
 *         description: Property risk assessment retrieved successfully
 *       400:
 *         description: Invalid property ID
 *       401:
 *         description: Authentication token is missing or invalid
 *       403:
 *         description: User is not authorized to access this property
 *       404:
 *         description: Property not found
 */
router.get("/:id/risk-score", authorize("NRI_OWNER", "ADMIN"), getPropertyRisk);

// ============================================================
// RESTORE PROPERTY
// ============================================================

/**
 * @swagger
 * /api/properties/{id}/restore:
 *   patch:
 *     operationId: restoreProperty
 *     summary: Restore an archived property
 *     description: Restores an archived property when the authenticated user has permission.
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB property ID
 *     responses:
 *       200:
 *         description: Property restored successfully
 *       400:
 *         description: Invalid property ID or property cannot be restored
 *       401:
 *         description: Authentication token is missing or invalid
 *       403:
 *         description: User is not authorized to restore this property
 *       404:
 *         description: Property not found
 */
router.patch("/:id/restore", authorize("NRI_OWNER", "ADMIN"), restoreProperty);

// ============================================================
// GET PROPERTY BY ID
// ============================================================

/**
 * @swagger
 * /api/properties/{id}:
 *   get:
 *     operationId: getPropertyById
 *     summary: Get property by ID
 *     description: Retrieves the details of a specific property.
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB property ID
 *     responses:
 *       200:
 *         description: Property retrieved successfully
 *       400:
 *         description: Invalid property ID
 *       401:
 *         description: Authentication token is missing or invalid
 *       403:
 *         description: User is not authorized to access this property
 *       404:
 *         description: Property not found
 */
router.get("/:id", authorize("NRI_OWNER", "ADMIN"), getPropertyById);

// ============================================================
// UPDATE PROPERTY
// ============================================================

/**
 * @swagger
 * /api/properties/{id}:
 *   put:
 *     operationId: updateProperty
 *     summary: Update a property
 *     description: Updates an existing property's information.
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB property ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PropertyInput'
 *     responses:
 *       200:
 *         description: Property updated successfully
 *       400:
 *         description: Invalid property data or property ID
 *       401:
 *         description: Authentication token is missing or invalid
 *       403:
 *         description: User is not authorized to update this property
 *       404:
 *         description: Property not found
 */
router.put("/:id", authorize("NRI_OWNER", "ADMIN"), updateProperty);

// ============================================================
// ARCHIVE PROPERTY
// ============================================================

/**
 * @swagger
 * /api/properties/{id}:
 *   delete:
 *     operationId: deleteProperty
 *     summary: Archive a property
 *     description: Archives a property. This endpoint is documented as an archive operation, not permanent deletion.
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB property ID
 *     responses:
 *       200:
 *         description: Property archived successfully
 *       400:
 *         description: Invalid property ID
 *       401:
 *         description: Authentication token is missing or invalid
 *       403:
 *         description: User is not authorized to archive this property
 *       404:
 *         description: Property not found
 */
router.delete("/:id", authorize("NRI_OWNER", "ADMIN"), deleteProperty);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;
