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

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authMiddleware);

// ============================================================
// DOCUMENT VAULT ROUTES
// ============================================================

// Create document
router.post("/", authorize("NRI_OWNER", "ADMIN"), createDocument);

// Get my documents
router.get("/my", authorize("NRI_OWNER", "ADMIN"), getMyDocuments);

// Document statistics
router.get("/stats", authorize("NRI_OWNER", "ADMIN"), getDocumentStats);

// Get documents for a property
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyDocuments,
);

// Get single document
router.get("/:documentId", authorize("NRI_OWNER", "ADMIN"), getDocumentById);

// Update document
router.put("/:documentId", authorize("NRI_OWNER", "ADMIN"), updateDocument);

// Archive document
router.delete("/:documentId", authorize("NRI_OWNER", "ADMIN"), deleteDocument);

module.exports = router;
