const mongoose = require("mongoose");

const Document = require("../models/Document");
const Property = require("../models/Property");
const createAuditLog = require("../utils/auditLogger");
const documentStorage = require("../services/documentStorage");

// ============================================================
// HELPERS
// ============================================================

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (id) => {
  return (
    typeof id === "string" &&
    mongoose.Types.ObjectId.isValid(id) &&
    String(new mongoose.Types.ObjectId(id)) === id
  );
};

const parseBoolean = (value, fieldName = "Value") => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;

  throw createError(`${fieldName} must be true or false`, 400);
};

const parseOptionalDate = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError(`Invalid ${fieldName}`, 400);
  }

  return date;
};

const validateDocumentDates = (issueDate, expiryDate) => {
  const now = new Date();

  if (issueDate && issueDate > now) {
    throw createError("Issue date cannot be in the future", 400);
  }

  if (expiryDate && expiryDate < now) {
    throw createError("Expiry date cannot be in the past", 400);
  }

  if (issueDate && expiryDate && issueDate > expiryDate) {
    throw createError("Issue date cannot be later than expiry date", 400);
  }
};

const getDocumentAuditValues = (document) => ({
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
});

const populateDocument = (query) =>
  query
    .populate("property", "title propertyType address")
    .populate("owner", "name email");

// ============================================================
// CREATE DOCUMENT RECORD
// Existing JSON-based endpoint; does not upload a physical file.
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

    if (!propertyId || !isValidObjectId(propertyId)) {
      throw createError("Valid property ID is required", 400);
    }

    if (typeof title !== "string" || !title.trim()) {
      throw createError("Document title is required", 400);
    }

    if (typeof category !== "string" || !category.trim()) {
      throw createError("Document category is required", 400);
    }

    if (typeof fileUrl !== "string" || !fileUrl.trim()) {
      throw createError("Document file URL is required", 400);
    }

    if (typeof originalFileName !== "string" || !originalFileName.trim()) {
      throw createError("Original file name is required", 400);
    }

    if (typeof fileType !== "string" || !fileType.trim()) {
      throw createError("File type is required", 400);
    }

    if (
      fileSize === undefined ||
      fileSize === null ||
      fileSize === "" ||
      !Number.isFinite(Number(fileSize)) ||
      Number(fileSize) < 0
    ) {
      throw createError("A valid non-negative file size is required", 400);
    }

    const property = await Property.findOne({
      _id: propertyId,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    });

    if (!property) {
      throw createError("Property not found or access denied", 404);
    }

    const parsedIssueDate = parseOptionalDate(issueDate, "issue date");
    const parsedExpiryDate = parseOptionalDate(expiryDate, "expiry date");

    validateDocumentDates(parsedIssueDate, parsedExpiryDate);

    const parsedIsSensitive =
      isSensitive === undefined
        ? false
        : parseBoolean(isSensitive, "isSensitive");

    const document = await Document.create({
      property: property._id,
      owner: req.user.userId,
      title: title.trim(),
      category: category.trim(),
      description: typeof description === "string" ? description.trim() : "",
      fileUrl: fileUrl.trim(),
      originalFileName: originalFileName.trim(),
      fileType: fileType.trim(),
      fileSize: Number(fileSize),
      documentNumber:
        typeof documentNumber === "string" ? documentNumber.trim() : "",
      issuedBy: typeof issuedBy === "string" ? issuedBy.trim() : "",
      issueDate: parsedIssueDate,
      expiryDate: parsedExpiryDate,
      status: "ACTIVE",
      isSensitive: parsedIsSensitive,
      isActive: true,
    });

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

    const populatedDocument = await populateDocument(
      Document.findById(document._id),
    );

    return res.status(201).json({
      success: true,
      message: "Document created successfully",
      document: populatedDocument,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// UPLOAD DOCUMENT FILE
// Requires documentUpload middleware to populate req.documentUpload.
// ============================================================

const uploadDocument = async (req, res, next) => {
  let storageKey;
  let createdDocumentId;

  try {
    const {
      propertyId,
      title,
      category,
      description,
      documentNumber,
      issuedBy,
      issueDate,
      expiryDate,
      isSensitive,
    } = req.body;

    const uploadedFile = req.documentUpload;

    if (!uploadedFile || !uploadedFile.storageKey) {
      throw createError("A document file is required", 400);
    }

    storageKey = uploadedFile.storageKey;

    if (!propertyId || !isValidObjectId(propertyId)) {
      throw createError("Valid property ID is required", 400);
    }

    if (typeof title !== "string" || !title.trim()) {
      throw createError("Document title is required", 400);
    }

    if (typeof category !== "string" || !category.trim()) {
      throw createError("Document category is required", 400);
    }

    const property = await Property.findOne({
      _id: propertyId,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    });

    if (!property) {
      throw createError("Property not found or access denied", 404);
    }

    const parsedIssueDate = parseOptionalDate(issueDate, "issue date");
    const parsedExpiryDate = parseOptionalDate(expiryDate, "expiry date");

    validateDocumentDates(parsedIssueDate, parsedExpiryDate);

    const parsedIsSensitive =
      isSensitive === undefined
        ? false
        : parseBoolean(isSensitive, "isSensitive");

    const documentId = new mongoose.Types.ObjectId();

    const document = await Document.create({
      _id: documentId,
      property: property._id,
      owner: req.user.userId,
      title: title.trim(),
      category: category.trim(),
      description: typeof description === "string" ? description.trim() : "",
      fileUrl: `/api/documents/${documentId}/download`,
      originalFileName: uploadedFile.originalFileName,
      fileType: uploadedFile.fileType,
      fileSize: uploadedFile.fileSize,
      storageKey: uploadedFile.storageKey,
      storageProvider: "LOCAL",
      documentNumber:
        typeof documentNumber === "string" ? documentNumber.trim() : "",
      issuedBy: typeof issuedBy === "string" ? issuedBy.trim() : "",
      issueDate: parsedIssueDate,
      expiryDate: parsedExpiryDate,
      status: "ACTIVE",
      isSensitive: parsedIsSensitive,
      isActive: true,
    });

    createdDocumentId = document._id;

    const populatedDocument = await populateDocument(
      Document.findById(document._id),
    );

    await createAuditLog({
      req,
      action: "DOCUMENT_CREATED",
      resourceType: "DOCUMENT",
      resourceId: document._id,
      property: property._id,
      description: `Document "${document.title}" was uploaded for property "${property.title}".`,
      oldValues: null,
      newValues: getDocumentAuditValues(document),
    });

    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      document: populatedDocument,
    });
  } catch (error) {
    // Roll back the new record if a later upload operation fails.
    if (createdDocumentId) {
      await Document.deleteOne({ _id: createdDocumentId }).catch(() => {});
    }

    // Remove the physical upload when the operation does not complete.
    if (storageKey) {
      await documentStorage.deleteFile(storageKey).catch(() => {});
    }

    return next(error);
  }
};

// ============================================================
// DOWNLOAD DOCUMENT FILE
// ============================================================

const downloadDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;

    if (!isValidObjectId(documentId)) {
      throw createError("Invalid document ID", 400);
    }

    const document = await Document.findOne({
      _id: documentId,
      owner: req.user.userId,
      isActive: true,
      status: { $ne: "ARCHIVED" },
    });

    if (!document) {
      throw createError("Document not found", 404);
    }

    if (document.storageProvider !== "LOCAL" || !document.storageKey) {
      throw createError("This document has no locally stored file", 404);
    }

    const filePath = documentStorage.getFilePath(document.storageKey);

    const contentTypes = {
      PDF: "application/pdf",
      JPG: "image/jpeg",
      JPEG: "image/jpeg",
      PNG: "image/png",
      WEBP: "image/webp",
    };

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Type",
      contentTypes[document.fileType] || "application/octet-stream",
    );

    const safeDownloadName = String(document.originalFileName || "document")
      .replace(/[\/\\]/g, "_")
      .replace(/[\r\n"]/g, "_");

    return res.download(filePath, safeDownloadName, (error) => {
      if (!error) return;

      if (res.headersSent) {
        return;
      }

      if (error.code === "ENOENT") {
        return next(createError("Stored document file was not found", 404));
      }

      return next(error);
    });
  } catch (error) {
    return next(error);
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
    return next(error);
  }
};

// ============================================================
// GET DOCUMENTS FOR A PROPERTY
// ============================================================

const getPropertyDocuments = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

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
    return next(error);
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
    return next(error);
  }
};

// ============================================================
// UPDATE DOCUMENT METADATA
// File metadata cannot be changed through this endpoint.
// Upload a new file through the upload endpoint instead.
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

    const oldValues = getDocumentAuditValues(document);

    const allowedFields = [
      "title",
      "category",
      "description",
      "documentNumber",
      "issuedBy",
      "issueDate",
      "expiryDate",
      "isSensitive",
    ];

    for (const field of allowedFields) {
      if (req.body[field] === undefined) continue;

      if (field === "isSensitive") {
        document.isSensitive = parseBoolean(req.body[field], "isSensitive");
      } else if (field === "issueDate" || field === "expiryDate") {
        document[field] = parseOptionalDate(req.body[field], field);
      } else if (typeof req.body[field] === "string") {
        document[field] = req.body[field].trim();
      } else {
        throw createError(`Invalid value for ${field}`, 400);
      }
    }

    if (!document.title || !document.title.trim()) {
      throw createError("Document title is required", 400);
    }

    validateDocumentDates(document.issueDate, document.expiryDate);

    await document.save();

    const updatedDocument = await populateDocument(
      Document.findById(document._id),
    );

    await createAuditLog({
      req,
      action: "DOCUMENT_UPDATED",
      resourceType: "DOCUMENT",
      resourceId: document._id,
      property: document.property,
      description: `Document "${document.title}" was updated.`,
      oldValues,
      newValues: getDocumentAuditValues(document),
    });

    return res.status(200).json({
      success: true,
      message: "Document updated successfully",
      document: updatedDocument,
    });
  } catch (error) {
    return next(error);
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

    const oldValues = getDocumentAuditValues(document);

    document.isActive = false;
    document.status = "ARCHIVED";

    await document.save();

    await createAuditLog({
      req,
      action: "DOCUMENT_ARCHIVED",
      resourceType: "DOCUMENT",
      resourceId: document._id,
      property: document.property,
      description: `Document "${document.title}" was archived.`,
      oldValues,
      newValues: getDocumentAuditValues(document),
    });

    return res.status(200).json({
      success: true,
      message: "Document archived successfully",
    });
  } catch (error) {
    return next(error);
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

    const [
      totalDocuments,
      byCategory,
      byStatus,
      sensitiveDocuments,
      expiringSoon,
    ] = await Promise.all([
      Document.countDocuments(match),

      Document.aggregate([
        { $match: match },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Document.aggregate([
        { $match: match },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Document.countDocuments({
        ...match,
        isSensitive: true,
      }),

      (() => {
        const now = new Date();
        const thirtyDaysLater = new Date(now);
        thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

        return Document.countDocuments({
          ...match,
          expiryDate: {
            $gte: now,
            $lte: thirtyDaysLater,
          },
        });
      })(),
    ]);

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
    return next(error);
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createDocument,
  uploadDocument,
  downloadDocument,
  getMyDocuments,
  getPropertyDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDocumentStats,
};
