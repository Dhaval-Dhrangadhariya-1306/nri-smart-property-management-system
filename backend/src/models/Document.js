const mongoose = require("mongoose");

// ============================================================
// DOCUMENT VAULT SCHEMA
// ============================================================

const documentSchema = new mongoose.Schema(
  {
    // ==========================================================
    // PROPERTY & OWNERSHIP
    // ==========================================================

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property is required"],
      index: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Document owner is required"],
      index: true,
    },

    // ==========================================================
    // DOCUMENT INFORMATION
    // ==========================================================

    title: {
      type: String,
      required: [true, "Document title is required"],
      trim: true,
      minlength: [3, "Document title must be at least 3 characters"],
      maxlength: [150, "Document title cannot exceed 150 characters"],
    },

    category: {
      type: String,
      required: [true, "Document category is required"],
      enum: {
        values: [
          "PROPERTY_DEED",
          "TAX_RECEIPT",
          "INSURANCE",
          "ELECTRICITY_BILL",
          "WATER_BILL",
          "MAINTENANCE_INVOICE",
          "RENTAL_AGREEMENT",
          "LEGAL_DOCUMENT",
          "IDENTITY_DOCUMENT",
          "OTHER",
        ],
        message: "Invalid document category",
      },
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Document description cannot exceed 2000 characters"],
      default: "",
    },

    // ==========================================================
    // FILE INFORMATION
    // ==========================================================

    fileUrl: {
      type: String,
      required: [true, "Document file URL is required"],
      trim: true,
      maxlength: [2000, "File URL cannot exceed 2000 characters"],
    },

    originalFileName: {
      type: String,
      required: [true, "Original file name is required"],
      trim: true,
      maxlength: [255, "Original file name cannot exceed 255 characters"],
    },

    fileType: {
      type: String,
      required: [true, "File type is required"],
      enum: {
        values: [
          "PDF",
          "JPG",
          "JPEG",
          "PNG",
          "WEBP",
          "DOC",
          "DOCX",
          "XLS",
          "XLSX",
          "OTHER",
        ],
        message: "Invalid file type",
      },
    },

    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [0, "File size cannot be negative"],
    },

    // ==========================================================
    // DOCUMENT METADATA
    // ==========================================================

    documentNumber: {
      type: String,
      trim: true,
      maxlength: [150, "Document number cannot exceed 150 characters"],
      default: "",
    },

    issuedBy: {
      type: String,
      trim: true,
      maxlength: [200, "Issued by cannot exceed 200 characters"],
      default: "",
    },

    issueDate: {
      type: Date,
      default: null,
      validate: {
        validator: function (value) {
          return !value || value <= new Date();
        },
        message: "Issue date cannot be in the future",
      },
    },

    expiryDate: {
      type: Date,
      default: null,
      validate: {
        validator: function (value) {
          return !value || value >= new Date();
        },
        message: "Expiry date cannot be in the past",
      },
    },

    // ==========================================================
    // DOCUMENT STATUS
    // ==========================================================

    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "EXPIRED", "ARCHIVED"],
        message: "Invalid document status",
      },
      default: "ACTIVE",
      index: true,
    },

    // ==========================================================
    // SECURITY
    // ==========================================================

    isSensitive: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ==========================================================
    // SOFT DELETE
    // ==========================================================

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================
// INDEXES
// ============================================================

// Property document listing
documentSchema.index({
  property: 1,
  createdAt: -1,
});

// Owner document listing
documentSchema.index({
  owner: 1,
  createdAt: -1,
});

// Category filtering
documentSchema.index({
  property: 1,
  category: 1,
});

// Status filtering
documentSchema.index({
  property: 1,
  status: 1,
});

// Expiry tracking
documentSchema.index({
  expiryDate: 1,
  status: 1,
});

// Active documents
documentSchema.index({
  property: 1,
  isActive: 1,
});

// ============================================================
// MODEL
// ============================================================

const Document = mongoose.model("Document", documentSchema);

module.exports = Document;
