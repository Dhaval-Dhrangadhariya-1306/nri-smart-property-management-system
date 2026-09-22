const mongoose = require("mongoose");

const maintenanceRequestSchema = new mongoose.Schema(
  {
    // ==========================================================
    // PROPERTY
    // ==========================================================

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property is required"],
      index: true,
    },

    // ==========================================================
    // REPORTER
    // ==========================================================

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reporter is required"],
      index: true,
    },

    // ==========================================================
    // ASSIGNED CARETAKER
    // ==========================================================

    assignedCaretaker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // ==========================================================
    // ASSIGNED VENDOR
    // ==========================================================

    assignedVendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },

    vendorAssignedAt: {
      type: Date,
      default: null,
    },

    vendorCompletedAt: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // INSPECTION
    // ==========================================================

    inspection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inspection",
      default: null,
      index: true,
    },

    // ==========================================================
    // BASIC INFORMATION
    // ==========================================================

    title: {
      type: String,
      required: [true, "Maintenance title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [150, "Title cannot exceed 150 characters"],
    },

    description: {
      type: String,
      required: [true, "Maintenance description is required"],
      trim: true,
      minlength: [5, "Description must be at least 5 characters"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    // ==========================================================
    // CATEGORY
    // ==========================================================

    category: {
      type: String,
      enum: {
        values: [
          "ELECTRICAL",
          "PLUMBING",
          "SECURITY",
          "STRUCTURAL",
          "CLEANING",
          "APPLIANCE",
          "HVAC",
          "PEST_CONTROL",
          "OTHER",
        ],
        message: "Invalid maintenance category",
      },
      required: [true, "Maintenance category is required"],
    },

    // ==========================================================
    // PRIORITY
    // ==========================================================

    priority: {
      type: String,
      enum: {
        values: ["LOW", "MEDIUM", "HIGH", "URGENT"],
        message: "Invalid maintenance priority",
      },
      default: "MEDIUM",
      index: true,
    },

    // ==========================================================
    // STATUS
    // ==========================================================

    status: {
      type: String,
      enum: {
        values: [
          "OPEN",
          "ASSIGNED",
          "IN_PROGRESS",
          "ON_HOLD",
          "COMPLETED",
          "CANCELLED",
        ],
        message: "Invalid maintenance status",
      },
      default: "OPEN",
      index: true,
    },

    // ==========================================================
    // COSTS
    // ==========================================================

    estimatedCost: {
      type: Number,
      min: [0, "Estimated cost cannot be negative"],
      default: 0,
    },

    actualCost: {
      type: Number,
      min: [0, "Actual cost cannot be negative"],
      default: 0,
    },

    // ==========================================================
    // IMAGES
    // ==========================================================

    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (images) {
          return images.every(
            (image) =>
              typeof image === "string" &&
              image.trim().length > 0 &&
              image.trim().length <= 2000,
          );
        },
        message: "Each maintenance image must be a valid non-empty path or URL",
      },
    },

    // ==========================================================
    // NOTES
    // ==========================================================

    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
      default: "",
    },

    // ==========================================================
    // TIMESTAMPS
    // ==========================================================

    reportedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================
// INDEXES
// ============================================================

// Property maintenance dashboard queries
maintenanceRequestSchema.index({
  property: 1,
  status: 1,
  priority: 1,
});

// Caretaker workload queries
maintenanceRequestSchema.index({
  assignedCaretaker: 1,
  status: 1,
  priority: 1,
});

// Vendor workload queries
maintenanceRequestSchema.index({
  assignedVendor: 1,
  status: 1,
  priority: 1,
});

// Vendor history
maintenanceRequestSchema.index({
  assignedVendor: 1,
  createdAt: -1,
});

// Owner maintenance history
maintenanceRequestSchema.index({
  reportedBy: 1,
  createdAt: -1,
});

// Inspection → maintenance relationship
maintenanceRequestSchema.index({
  inspection: 1,
  createdAt: -1,
});

// Recent maintenance requests
maintenanceRequestSchema.index({
  createdAt: -1,
});

const MaintenanceRequest = mongoose.model(
  "MaintenanceRequest",
  maintenanceRequestSchema,
);

module.exports = MaintenanceRequest;
