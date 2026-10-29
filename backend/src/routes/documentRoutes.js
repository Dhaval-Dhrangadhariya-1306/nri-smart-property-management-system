const express = require("express");

const {
  createDocument,
  getMyDocuments,
  getPropertyDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDocumentStats,
} = require("../controllers/documentController");

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Documents
 *   description: Document Vault management, property documents, and statistics
 */

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authMiddleware);

// ============================================================
// DOCUMENT VAULT ROUTES
// ============================================================

/**
 * @swagger
 * /api/documents:
 *   post:
 *     summary: Create a document record
 *     operationId: createDocument
 *     description: Creates a document record in the Document Vault.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Document fields accepted by the document controller.
 *             additionalProperties: true
 *             properties:
 *               propertyId:
 *                 type: string
 *                 description: MongoDB ID of the associated property.
 *               title:
 *                 type: string
 *                 example: Property Ownership Document
 *               documentType:
 *                 type: string
 *                 example: OWNERSHIP
 *               description:
 *                 type: string
 *               fileUrl:
 *                 type: string
 *                 format: uri
 *               fileName:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document created successfully
 *       400:
 *         description: Invalid or incomplete document data
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions or property access denied
 *       404:
 *         description: Property not found
 */
router.post("/", authorize("NRI_OWNER", "ADMIN"), createDocument);

/**
 * @swagger
 * /api/documents/my:
 *   get:
 *     summary: Get my documents
 *     operationId: getMyDocuments
 *     description: Retrieves documents accessible to the authenticated owner.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get("/my", authorize("NRI_OWNER", "ADMIN"), getMyDocuments);

/**
 * @swagger
 * /api/documents/stats:
 *   get:
 *     summary: Get document statistics
 *     operationId: getDocumentStats
 *     description: Retrieves document statistics for the authenticated owner.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Document statistics retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get("/stats", authorize("NRI_OWNER", "ADMIN"), getDocumentStats);

/**
 * @swagger
 * /api/documents/property/{propertyId}:
 *   get:
 *     summary: Get documents for a property
 *     operationId: getPropertyDocuments
 *     description: Retrieves documents associated with a specific property.
 *     tags: [Documents]
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
 *         description: Property documents retrieved successfully
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
  getPropertyDocuments,
);

/**
 * @swagger
 * /api/documents/{documentId}:
 *   get:
 *     summary: Get a document by ID
 *     operationId: getDocumentById
 *     description: Retrieves a single document record.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the document.
 *     responses:
 *       200:
 *         description: Document retrieved successfully
 *       400:
 *         description: Invalid document ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Document not found
 */
router.get("/:documentId", authorize("NRI_OWNER", "ADMIN"), getDocumentById);

/**
 * @swagger
 * /api/documents/{documentId}:
 *   put:
 *     summary: Update a document
 *     operationId: updateDocument
 *     description: Updates an existing document record.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the document.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Document fields accepted by the update controller.
 *             additionalProperties: true
 *             properties:
 *               title:
 *                 type: string
 *               documentType:
 *                 type: string
 *               description:
 *                 type: string
 *               fileUrl:
 *                 type: string
 *                 format: uri
 *               fileName:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document updated successfully
 *       400:
 *         description: Invalid document ID or update data
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Document not found
 */
router.put("/:documentId", authorize("NRI_OWNER", "ADMIN"), updateDocument);

/**
 * @swagger
 * /api/documents/{documentId}:
 *   delete:
 *     summary: Archive a document
 *     operationId: deleteDocument
 *     description: Archives or deletes a document according to the application's implementation.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the document.
 *     responses:
 *       200:
 *         description: Document archived successfully
 *       400:
 *         description: Invalid document ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Document not found
 */
router.delete("/:documentId", authorize("NRI_OWNER", "ADMIN"), deleteDocument);

module.exports = router;
