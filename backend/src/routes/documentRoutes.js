const express = require("express");

const {
  createDocument,
  uploadDocument,
  downloadDocument,
  getMyDocuments,
  getPropertyDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDocumentStats,
} = require("../controllers/documentController");

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const { handleDocumentUpload } = require("../middleware/documentUpload");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Documents
 *   description: Document Vault management, file uploads, downloads, and statistics
 */

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authMiddleware);

// ============================================================
// CREATE DOCUMENT RECORD
// ============================================================

/**
 * @swagger
 * /api/documents:
 *   post:
 *     summary: Create a document record using an existing file URL
 *     operationId: createDocument
 *     tags: [Documents]
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
 *               - category
 *               - fileUrl
 *               - originalFileName
 *               - fileType
 *               - fileSize
 *             properties:
 *               propertyId:
 *                 type: string
 *               title:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum:
 *                   - PROPERTY_DEED
 *                   - TAX_RECEIPT
 *                   - INSURANCE
 *                   - ELECTRICITY_BILL
 *                   - WATER_BILL
 *                   - MAINTENANCE_INVOICE
 *                   - RENTAL_AGREEMENT
 *                   - LEGAL_DOCUMENT
 *                   - IDENTITY_DOCUMENT
 *                   - OTHER
 *               description:
 *                 type: string
 *               fileUrl:
 *                 type: string
 *               originalFileName:
 *                 type: string
 *               fileType:
 *                 type: string
 *               fileSize:
 *                 type: number
 *               documentNumber:
 *                 type: string
 *               issuedBy:
 *                 type: string
 *               issueDate:
 *                 type: string
 *                 format: date
 *               expiryDate:
 *                 type: string
 *                 format: date
 *               isSensitive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Document record created successfully
 *       400:
 *         description: Invalid or incomplete document data
 *       401:
 *         description: Authentication required or token invalid
 *       404:
 *         description: Property not found or access denied
 */
router.post("/", authorize("NRI_OWNER", "ADMIN"), createDocument);

// ============================================================
// UPLOAD DOCUMENT FILE
// ============================================================

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Upload a document file for a property
 *     operationId: uploadDocument
 *     description: Uploads a PDF or supported image file and saves its metadata.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - propertyId
 *               - title
 *               - category
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               propertyId:
 *                 type: string
 *               title:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum:
 *                   - PROPERTY_DEED
 *                   - TAX_RECEIPT
 *                   - INSURANCE
 *                   - ELECTRICITY_BILL
 *                   - WATER_BILL
 *                   - MAINTENANCE_INVOICE
 *                   - RENTAL_AGREEMENT
 *                   - LEGAL_DOCUMENT
 *                   - IDENTITY_DOCUMENT
 *                   - OTHER
 *               description:
 *                 type: string
 *               documentNumber:
 *                 type: string
 *               issuedBy:
 *                 type: string
 *               issueDate:
 *                 type: string
 *                 format: date
 *               expiryDate:
 *                 type: string
 *                 format: date
 *               isSensitive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *       400:
 *         description: Invalid input or unsupported file
 *       401:
 *         description: Authentication required or token invalid
 *       404:
 *         description: Property not found or access denied
 *       413:
 *         description: File exceeds the 10 MB upload limit
 */
router.post(
  "/upload",
  authorize("NRI_OWNER", "ADMIN"),
  handleDocumentUpload,
  uploadDocument,
);

// ============================================================
// MY DOCUMENTS
// ============================================================

/**
 * @swagger
 * /api/documents/my:
 *   get:
 *     summary: Get my documents
 *     operationId: getMyDocuments
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 */
router.get("/my", authorize("NRI_OWNER", "ADMIN"), getMyDocuments);

// ============================================================
// DOCUMENT STATISTICS
// ============================================================

/**
 * @swagger
 * /api/documents/stats:
 *   get:
 *     summary: Get document statistics
 *     operationId: getDocumentStats
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: propertyId
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional property ID to filter statistics.
 *     responses:
 *       200:
 *         description: Document statistics retrieved successfully
 *       400:
 *         description: Invalid property ID
 *       401:
 *         description: Authentication required or token invalid
 *       404:
 *         description: Property not found or access denied
 */
router.get("/stats", authorize("NRI_OWNER", "ADMIN"), getDocumentStats);

// ============================================================
// PROPERTY DOCUMENTS
// ============================================================

/**
 * @swagger
 * /api/documents/property/{propertyId}:
 *   get:
 *     summary: Get documents for a property
 *     operationId: getPropertyDocuments
 *     tags: [Documents]
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
 *         description: Property documents retrieved successfully
 *       400:
 *         description: Invalid property ID
 *       401:
 *         description: Authentication required or token invalid
 *       404:
 *         description: Property not found or access denied
 */
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyDocuments,
);

// ============================================================
// DOWNLOAD DOCUMENT FILE
// ============================================================

/**
 * @swagger
 * /api/documents/{documentId}/download:
 *   get:
 *     summary: Download a stored document file
 *     operationId: downloadDocument
 *     description: Downloads a document belonging to the authenticated owner.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document file downloaded successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid document ID
 *       401:
 *         description: Authentication required or token invalid
 *       404:
 *         description: Document or stored file not found
 */
router.get(
  "/:documentId/download",
  authorize("NRI_OWNER", "ADMIN"),
  downloadDocument,
);

// ============================================================
// GET SINGLE DOCUMENT RECORD
// ============================================================

/**
 * @swagger
 * /api/documents/{documentId}:
 *   get:
 *     summary: Get a document record by ID
 *     operationId: getDocumentById
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document retrieved successfully
 *       400:
 *         description: Invalid document ID
 *       401:
 *         description: Authentication required or token invalid
 *       404:
 *         description: Document not found
 */
router.get("/:documentId", authorize("NRI_OWNER", "ADMIN"), getDocumentById);

// ============================================================
// UPDATE DOCUMENT RECORD
// ============================================================

/**
 * @swagger
 * /api/documents/{documentId}:
 *   put:
 *     summary: Update document metadata
 *     operationId: updateDocument
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
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
 *               title:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               documentNumber:
 *                 type: string
 *               issuedBy:
 *                 type: string
 *               issueDate:
 *                 type: string
 *                 format: date
 *               expiryDate:
 *                 type: string
 *                 format: date
 *               isSensitive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Document updated successfully
 *       400:
 *         description: Invalid document ID or update data
 *       401:
 *         description: Authentication required or token invalid
 *       404:
 *         description: Document not found
 */
router.put("/:documentId", authorize("NRI_OWNER", "ADMIN"), updateDocument);

// ============================================================
// ARCHIVE DOCUMENT
// ============================================================

/**
 * @swagger
 * /api/documents/{documentId}:
 *   delete:
 *     summary: Archive a document
 *     operationId: deleteDocument
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document archived successfully
 *       400:
 *         description: Invalid document ID
 *       401:
 *         description: Authentication required or token invalid
 *       404:
 *         description: Document not found
 */
router.delete("/:documentId", authorize("NRI_OWNER", "ADMIN"), deleteDocument);

module.exports = router;
