const mongoose = require("mongoose");

const Document = require("../models/Document");
const Property = require("../models/Property");
const createAuditLog = require("../utils/auditLogger");

// ============================================================
// HELPERS
// ============================================================

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// ============================================================
// DOCUMENT AUDIT SNAPSHOT
// ============================================================

const getDocumentAuditValues = (document) => {
  return {
    property: document.property,
    owner: document.owner,

    title: document.title,
    category: document.category,
    description: document.description,

    originalFileName: document.originalFileName,
    fileType: document.fileType,
    fileSize: document.fileSize,

    documentNumber: document.documentNumber,
    issuedBy: document.issuedBy,
    issueDate: document.issueDate,
    expiryDate: document.expiryDate,

    status: document.status,
    isSensitive: document.isSensitive,
    isActive: document.isActive,
  };
};

// ============================================================
// CREATE DOCUMENT
// ============================================================

const createDocument = async (req, res, next) => {
  try {
    const {
      propertyId,
      title,
      category,
      description,
      fileUrl,
      originalFileName,
      fileType,
      fileSize,
      documentNumber,
      issuedBy,
      issueDate,
      expiryDate,
      isSensitive,
    } = req.body;

    // --------------------------------------------------------
    // Validate property ID
    // --------------------------------------------------------

    if (!propertyId || !isValidObjectId(propertyId)) {
      throw createError("Valid property ID is required", 400);
    }

    // --------------------------------------------------------
    // Verify property belongs to logged-in owner
    // --------------------------------------------------------

    const property = await Property.findOne({
      _id: propertyId,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    });

    if (!property) {
      throw createError("Property not found or access denied", 404);
    }

    // --------------------------------------------------------
    // Required fields
    // --------------------------------------------------------

    if (!title || !title.trim()) {
      throw createError("Document title is required", 400);
    }

    if (!category) {
      throw createError("Document category is required", 400);
    }

    if (!fileUrl || !fileUrl.trim()) {
      throw createError("Document file URL is required", 400);
    }

    if (!originalFileName || !originalFileName.trim()) {
      throw createError("Original file name is required", 400);
    }

    if (!fileType) {
      throw createError("File type is required", 400);
    }

    if (fileSize === undefined || fileSize === null) {
      throw createError("File size is required", 400);
    }

    if (Number(fileSize) < 0) {
      throw createError("File size cannot be negative", 400);
    }

    // --------------------------------------------------------
    // Validate dates
    // --------------------------------------------------------

    let parsedIssueDate = null;
    let parsedExpiryDate = null;

    if (issueDate) {
      parsedIssueDate = new Date(issueDate);

      if (Number.isNaN(parsedIssueDate.getTime())) {
        throw createError("Invalid issue date", 400);
      }

      if (parsedIssueDate > new Date()) {
        throw createError("Issue date cannot be in the future", 400);
      }
    }

    if (expiryDate) {
      parsedExpiryDate = new Date(expiryDate);

      if (Number.isNaN(parsedExpiryDate.getTime())) {
        throw createError("Invalid expiry date", 400);
      }

      if (parsedExpiryDate < new Date()) {
        throw createError("Expiry date cannot be in the past", 400);
      }
    }

    // --------------------------------------------------------
    // Cross-date validation
    // --------------------------------------------------------

    if (
      parsedIssueDate &&
      parsedExpiryDate &&
      parsedIssueDate > parsedExpiryDate
    ) {
      throw createError("Issue date cannot be later than expiry date", 400);
    }

    // --------------------------------------------------------
    // Create document
    // --------------------------------------------------------

    const document = await Document.create({
      property: property._id,
      owner: req.user.userId,
      title: title.trim(),
      category,
      description: description?.trim() || "",
      fileUrl: fileUrl.trim(),
      originalFileName: originalFileName.trim(),
      fileType,
      fileSize: Number(fileSize),
      documentNumber: documentNumber?.trim() || "",
      issuedBy: issuedBy?.trim() || "",
      issueDate: parsedIssueDate,
      expiryDate: parsedExpiryDate,
      status: "ACTIVE",
      isSensitive: Boolean(isSensitive),
      isActive: true,
    });

    // --------------------------------------------------------
    // AUDIT LOG
    // --------------------------------------------------------

    await createAuditLog({
      req,
      action: "DOCUMENT_CREATED",
      resourceType: "DOCUMENT",
      resourceId: document._id,
      property: property._id,
      description: `Document "${document.title}" was created for property "${property.title}".`,
      oldValues: null,
      newValues: getDocumentAuditValues(document),
    });

    // --------------------------------------------------------
    // Populate response
    // --------------------------------------------------------

    const populatedDocument = await Document.findById(document._id)
      .populate("property", "title propertyType address")
      .populate("owner", "name email");

    return res.status(201).json({
      success: true,
      message: "Document created successfully",
      document: populatedDocument,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET MY DOCUMENTS
// ============================================================

const getMyDocuments = async (req, res, next) => {
  try {
    const documents = await Document.find({
      owner: req.user.userId,
      isActive: true,
    })
      .populate("property", "title propertyType address")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: documents.length,
      documents,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET PROPERTY DOCUMENTS
// ============================================================

const getPropertyDocuments = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      throw createError("Invalid property ID", 400);
    }

    // Verify ownership
    const property = await Property.findOne({
      _id: propertyId,
      owner: req.user.userId,
      isActive: true,
    });

    if (!property) {
      throw createError("Property not found or access denied", 404);
    }

    const documents = await Document.find({
      property: propertyId,
      owner: req.user.userId,
      isActive: true,
    })
      .populate("property", "title propertyType address")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: documents.length,
      property: {
        id: property._id,
        title: property.title,
      },
      documents,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET SINGLE DOCUMENT
// ============================================================

const getDocumentById = async (req, res, next) => {
  try {
    const { documentId } = req.params;

    if (!isValidObjectId(documentId)) {
      throw createError("Invalid document ID", 400);
    }

    const document = await Document.findOne({
      _id: documentId,
      owner: req.user.userId,
      isActive: true,
    })
      .populate("property", "title propertyType address")
      .populate("owner", "name email");

    if (!document) {
      throw createError("Document not found", 404);
    }

    return res.status(200).json({
      success: true,
      document,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// UPDATE DOCUMENT
// ============================================================

const updateDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;

    if (!isValidObjectId(documentId)) {
      throw createError("Invalid document ID", 400);
    }

    const document = await Document.findOne({
      _id: documentId,
      owner: req.user.userId,
      isActive: true,
    });

    if (!document) {
      throw createError("Document not found", 404);
    }

    // --------------------------------------------------------
    // Capture old values BEFORE modification
    // --------------------------------------------------------

    const oldValues = getDocumentAuditValues(document);

    const allowedFields = [
      "title",
      "category",
      "description",
      "fileUrl",
      "originalFileName",
      "fileType",
      "fileSize",
      "documentNumber",
      "issuedBy",
      "issueDate",
      "expiryDate",
      "isSensitive",
    ];

    // --------------------------------------------------------
    // Update only allowed fields
    // --------------------------------------------------------

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        document[field] = req.body[field];
      }
    });

    // --------------------------------------------------------
    // Validate title
    // --------------------------------------------------------

    if (document.title) {
      document.title = document.title.trim();
    }

    if (!document.title) {
      throw createError("Document title is required", 400);
    }

    // --------------------------------------------------------
    // Validate file size
    // --------------------------------------------------------

    if (document.fileSize < 0) {
      throw createError("File size cannot be negative", 400);
    }

    // --------------------------------------------------------
    // Validate dates
    // --------------------------------------------------------

    if (document.issueDate && document.issueDate > new Date()) {
      throw createError("Issue date cannot be in the future", 400);
    }

    if (document.expiryDate && document.expiryDate < new Date()) {
      throw createError("Expiry date cannot be in the past", 400);
    }

    if (
      document.issueDate &&
      document.expiryDate &&
      document.issueDate > document.expiryDate
    ) {
      throw createError("Issue date cannot be later than expiry date", 400);
    }

    // --------------------------------------------------------
    // Save
    // --------------------------------------------------------

    await document.save();

    // --------------------------------------------------------
    // Capture new values AFTER modification
    // --------------------------------------------------------

    const newValues = getDocumentAuditValues(document);

    // --------------------------------------------------------
    // AUDIT LOG
    // --------------------------------------------------------

    await createAuditLog({
      req,
      action: "DOCUMENT_UPDATED",
      resourceType: "DOCUMENT",
      resourceId: document._id,
      property: document.property,
      description: `Document "${document.title}" was updated.`,
      oldValues,
      newValues,
    });

    // --------------------------------------------------------
    // Populate response
    // --------------------------------------------------------

    const updatedDocument = await Document.findById(document._id)
      .populate("property", "title propertyType address")
      .populate("owner", "name email");

    return res.status(200).json({
      success: true,
      message: "Document updated successfully",
      document: updatedDocument,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ARCHIVE DOCUMENT
// ============================================================

const deleteDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;

    if (!isValidObjectId(documentId)) {
      throw createError("Invalid document ID", 400);
    }

    const document = await Document.findOne({
      _id: documentId,
      owner: req.user.userId,
      isActive: true,
    });

    if (!document) {
      throw createError("Document not found", 404);
    }

    // --------------------------------------------------------
    // Capture old values BEFORE archive
    // --------------------------------------------------------

    const oldValues = getDocumentAuditValues(document);

    document.isActive = false;
    document.status = "ARCHIVED";

    await document.save();

    // --------------------------------------------------------
    // Capture new values AFTER archive
    // --------------------------------------------------------

    const newValues = getDocumentAuditValues(document);

    // --------------------------------------------------------
    // AUDIT LOG
    // --------------------------------------------------------

    await createAuditLog({
      req,
      action: "DOCUMENT_ARCHIVED",
      resourceType: "DOCUMENT",
      resourceId: document._id,
      property: document.property,
      description: `Document "${document.title}" was archived.`,
      oldValues,
      newValues,
    });

    return res.status(200).json({
      success: true,
      message: "Document archived successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DOCUMENT STATISTICS
// ============================================================

const getDocumentStats = async (req, res, next) => {
  try {
    const { propertyId } = req.query;

    const match = {
      owner: new mongoose.Types.ObjectId(req.user.userId),
      isActive: true,
    };

    // --------------------------------------------------------
    // Optional property filter
    // --------------------------------------------------------

    if (propertyId) {
      if (!isValidObjectId(propertyId)) {
        throw createError("Invalid property ID", 400);
      }

      const property = await Property.findOne({
        _id: propertyId,
        owner: req.user.userId,
        isActive: true,
      });

      if (!property) {
        throw createError("Property not found or access denied", 404);
      }

      match.property = new mongoose.Types.ObjectId(propertyId);
    }

    // --------------------------------------------------------
    // Total documents
    // --------------------------------------------------------

    const totalDocuments = await Document.countDocuments(match);

    // --------------------------------------------------------
    // Category statistics
    // --------------------------------------------------------

    const byCategory = await Document.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
    ]);

    // --------------------------------------------------------
    // Status statistics
    // --------------------------------------------------------

    const byStatus = await Document.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
    ]);

    // --------------------------------------------------------
    // Sensitive documents
    // --------------------------------------------------------

    const sensitiveDocuments = await Document.countDocuments({
      ...match,
      isSensitive: true,
    });

    // --------------------------------------------------------
    // Expiring soon — next 30 days
    // --------------------------------------------------------

    const now = new Date();

    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const expiringSoon = await Document.countDocuments({
      ...match,
      expiryDate: {
        $gte: now,
        $lte: thirtyDaysLater,
      },
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalDocuments,
        sensitiveDocuments,
        expiringSoon,
        byCategory,
        byStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createDocument,
  getMyDocuments,
  getPropertyDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDocumentStats,
};
