const express = require("express");

const {
  createVendor,
  getMyVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  getVendorStats,
} = require("../controllers/vendorController");

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Vendors
 *   description: Vendor management, statistics, updates, and archiving
 */

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authMiddleware);

// ============================================================
// VENDOR STATISTICS
// ============================================================

/**
 * @swagger
 * /api/vendors/stats:
 *   get:
 *     operationId: getVendorStats
 *     summary: Get vendor statistics
 *     description: Returns vendor statistics for the authenticated owner.
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor statistics retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get("/stats", authorize("NRI_OWNER", "ADMIN"), getVendorStats);

// ============================================================
// CREATE VENDOR
// ============================================================

/**
 * @swagger
 * /api/vendors:
 *   post:
 *     operationId: createVendor
 *     summary: Create a vendor
 *     description: Creates a vendor associated with the authenticated owner.
 *     tags: [Vendors]
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
 *               - category
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 example: Apex Plumbing Services
 *               companyName:
 *                 type: string
 *                 example: Apex Services
 *               category:
 *                 type: string
 *                 example: PLUMBING
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: apex@example.com
 *               address:
 *                 type: object
 *                 description: Vendor address fields supported by the application.
 *                 additionalProperties: true
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example:
 *                   - Pipe repair
 *                   - Leak detection
 *               notes:
 *                 type: string
 *                 example: Available for emergency repairs
 *     responses:
 *       201:
 *         description: Vendor created successfully
 *       400:
 *         description: Invalid or missing vendor data
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.post("/", authorize("NRI_OWNER", "ADMIN"), createVendor);

// ============================================================
// GET MY VENDORS
// ============================================================

/**
 * @swagger
 * /api/vendors/my:
 *   get:
 *     operationId: getMyVendors
 *     summary: Get my vendors
 *     description: Returns vendors associated with the authenticated owner.
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter vendors by category.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter vendors by status.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search using supported vendor fields.
 *     responses:
 *       200:
 *         description: Vendors retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get("/my", authorize("NRI_OWNER", "ADMIN"), getMyVendors);

// ============================================================
// GET VENDOR BY ID
// ============================================================

/**
 * @swagger
 * /api/vendors/{vendorId}:
 *   get:
 *     operationId: getVendorById
 *     summary: Get a vendor by ID
 *     description: Retrieves a vendor by its identifier.
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the vendor.
 *     responses:
 *       200:
 *         description: Vendor retrieved successfully
 *       400:
 *         description: Invalid vendor ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Vendor not found
 */
router.get("/:vendorId", authorize("NRI_OWNER", "ADMIN"), getVendorById);

// ============================================================
// UPDATE VENDOR
// ============================================================

/**
 * @swagger
 * /api/vendors/{vendorId}:
 *   put:
 *     operationId: updateVendor
 *     summary: Update a vendor
 *     description: Updates vendor information using the supplied fields.
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the vendor.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Vendor fields supported by the update controller.
 *             additionalProperties: true
 *             properties:
 *               name:
 *                 type: string
 *               companyName:
 *                 type: string
 *               category:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               services:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vendor updated successfully
 *       400:
 *         description: Invalid vendor ID or update data
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Vendor not found
 */
router.put("/:vendorId", authorize("NRI_OWNER", "ADMIN"), updateVendor);

// ============================================================
// ARCHIVE VENDOR
// ============================================================

/**
 * @swagger
 * /api/vendors/{vendorId}:
 *   delete:
 *     operationId: deleteVendor
 *     summary: Archive a vendor
 *     description: Archives a vendor rather than permanently deleting its record.
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the vendor.
 *     responses:
 *       200:
 *         description: Vendor archived successfully
 *       400:
 *         description: Invalid vendor ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Vendor not found
 */
router.delete("/:vendorId", authorize("NRI_OWNER", "ADMIN"), deleteVendor);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;
