const mongoose = require("mongoose");

// ============================================================
// NOTIFICATION & ALERT SCHEMA
// ============================================================

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Notification recipient is required"],
      index: true,
    },

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },

    type: {
      type: String,
      required: [true, "Notification type is required"],
      enum: {
        values: [
          "MAINTENANCE",
          "INSPECTION",
          "MONITORING",
          "EXPENSE",
          "DOCUMENT_EXPIRY",
          "CARETAKER",
          "PROPERTY",
          "SYSTEM",
          "OTHER",
        ],
        message: "Invalid notification type",
      },
      index: true,
    },

    priority: {
      type: String,
      enum: {
        values: ["LOW", "MEDIUM", "HIGH", "URGENT"],
        message: "Invalid notification priority",
      },
      default: "MEDIUM",
      index: true,
    },

    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      minlength: [3, "Notification title must be at least 3 characters"],
      maxlength: [150, "Notification title cannot exceed 150 characters"],
    },

    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      minlength: [3, "Notification message must be at least 3 characters"],
      maxlength: [2000, "Notification message cannot exceed 2000 characters"],
    },

    relatedEntity: {
      entityType: {
        type: String,
        enum: [
          "PROPERTY",
          "MAINTENANCE",
          "INSPECTION",
          "MONITORING",
          "EXPENSE",
          "DOCUMENT",
          "CARETAKER",
          "OTHER",
        ],
        default: null,
      },

      entityId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    actionUrl: {
      type: String,
      trim: true,
      maxlength: [2000, "Action URL cannot exceed 2000 characters"],
      default: "",
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================
// INDEXES
// ============================================================

notificationSchema.index({
  recipient: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipient: 1,
  isRead: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipient: 1,
  priority: 1,
  createdAt: -1,
});

notificationSchema.index({
  property: 1,
  createdAt: -1,
});

notificationSchema.index({
  expiresAt: 1,
});

// ============================================================
// MODEL
// ============================================================

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
