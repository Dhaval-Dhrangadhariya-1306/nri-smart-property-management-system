const mongoose = require("mongoose");

const monitoringEventSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property is required"],
      index: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Property owner is required"],
      index: true,
    },

    eventType: {
      type: String,
      enum: {
        values: [
          "UNAUTHORIZED_ACCESS",
          "SUSPICIOUS_ACTIVITY",
          "SECURITY_INCIDENT",
          "FIRE_ALERT",
          "WATER_LEAK",
          "PROPERTY_DAMAGE",
          "ACCESS_ISSUE",
          "MAINTENANCE_ALERT",
          "CARETAKER_ALERT",
          "SYSTEM_WARNING",
          "SYSTEM_ERROR",
          "OTHER",
        ],
        message: "Invalid monitoring event type",
      },
      required: [true, "Event type is required"],
      index: true,
    },

    severity: {
      type: String,
      enum: {
        values: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
        message: "Invalid event severity",
      },
      default: "INFO",
      index: true,
    },

    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      minlength: [3, "Event title must be at least 3 characters"],
      maxlength: [150, "Event title cannot exceed 150 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Event description cannot exceed 2000 characters"],
      default: "",
    },

    source: {
      type: String,
      enum: {
        values: ["OWNER", "CARETAKER", "SYSTEM", "MAINTENANCE", "INSPECTION"],
        message: "Invalid monitoring event source",
      },
      default: "OWNER",
      index: true,
    },

    location: {
      room: {
        type: String,
        trim: true,
        maxlength: [100, "Room name cannot exceed 100 characters"],
      },

      area: {
        type: String,
        trim: true,
        maxlength: [100, "Area name cannot exceed 100 characters"],
      },
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    isAcknowledged: {
      type: Boolean,
      default: false,
      index: true,
    },

    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    acknowledgedAt: {
      type: Date,
      default: null,
    },

    isResolved: {
      type: Boolean,
      default: false,
      index: true,
    },

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Property event timeline
monitoringEventSchema.index({
  property: 1,
  occurredAt: -1,
});

// Owner event timeline
monitoringEventSchema.index({
  owner: 1,
  occurredAt: -1,
});

// Security dashboard queries
monitoringEventSchema.index({
  property: 1,
  severity: 1,
  isResolved: 1,
});

// Unacknowledged events
monitoringEventSchema.index({
  property: 1,
  isAcknowledged: 1,
  occurredAt: -1,
});

const MonitoringEvent = mongoose.model(
  "MonitoringEvent",
  monitoringEventSchema,
);

module.exports = MonitoringEvent;
