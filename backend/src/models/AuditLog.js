const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    // ============================================================
    // ACTOR
    // ============================================================

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    actorRole: {
      type: String,
      enum: ["NRI_OWNER", "CARETAKER", "ADMIN", "VENDOR", "SYSTEM"],
      required: true,
      index: true,
    },

    // ============================================================
    // ACTION
    // ============================================================

    action: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 100,
      index: true,
    },

    // ============================================================
    // RESOURCE
    // ============================================================

    resourceType: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 100,
      index: true,
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    // ============================================================
    // PROPERTY CONTEXT
    // ============================================================

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },

    // ============================================================
    // DESCRIPTION
    // ============================================================

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 1000,
    },

    // ============================================================
    // CHANGE TRACKING
    // ============================================================

    oldValues: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    newValues: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ============================================================
    // REQUEST / SYSTEM METADATA
    // ============================================================

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    // ============================================================
    // TIMESTAMP
    // ============================================================

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  },
);

// ============================================================
// INDEXES
// ============================================================

// Actor activity
auditLogSchema.index({
  actor: 1,
  createdAt: -1,
});

// Property activity timeline
auditLogSchema.index({
  property: 1,
  createdAt: -1,
});

// Resource activity
auditLogSchema.index({
  resourceType: 1,
  resourceId: 1,
  createdAt: -1,
});

// Action history
auditLogSchema.index({
  action: 1,
  createdAt: -1,
});

// General chronological lookup
auditLogSchema.index({
  createdAt: -1,
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
