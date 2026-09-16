const mongoose = require("mongoose");

// ============================================================
// PROPERTY SCHEMA
// ============================================================

const propertySchema = new mongoose.Schema(
  {
    // ========================================================
    // OWNER
    // ========================================================

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Property owner is required"],
      index: true,
    },

    // ========================================================
    // BASIC PROPERTY INFORMATION
    // ========================================================

    title: {
      type: String,
      required: [true, "Property title is required"],
      trim: true,
      minlength: [3, "Property title must be at least 3 characters"],
      maxlength: [150, "Property title cannot exceed 150 characters"],
    },

    propertyType: {
      type: String,
      required: [true, "Property type is required"],
      enum: {
        values: [
          "APARTMENT",
          "HOUSE",
          "VILLA",
          "PLOT",
          "COMMERCIAL",
          "OFFICE",
          "OTHER",
        ],
        message: "Invalid property type",
      },
      index: true,
    },

    // ========================================================
    // ADDRESS
    // ========================================================

    address: {
      addressLine1: {
        type: String,
        required: [true, "Address is required"],
        trim: true,
        minlength: [3, "Address must be at least 3 characters"],
        maxlength: [200, "Address cannot exceed 200 characters"],
      },

      addressLine2: {
        type: String,
        trim: true,
        maxlength: [200, "Address cannot exceed 200 characters"],
        default: "",
      },

      city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
        maxlength: [100, "City cannot exceed 100 characters"],
      },

      state: {
        type: String,
        required: [true, "State is required"],
        trim: true,
        maxlength: [100, "State cannot exceed 100 characters"],
      },

      country: {
        type: String,
        required: [true, "Country is required"],
        trim: true,
        maxlength: [100, "Country cannot exceed 100 characters"],
        default: "India",
      },

      postalCode: {
        type: String,
        required: [true, "Postal code is required"],
        trim: true,
        maxlength: [20, "Postal code cannot exceed 20 characters"],
      },
    },

    // ========================================================
    // PROPERTY LIFECYCLE STATUS
    // ========================================================

    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "ARCHIVED"],
        message: "Invalid property status",
      },
      default: "ACTIVE",
      index: true,
    },

    // ========================================================
    // OCCUPANCY
    // ========================================================

    occupancy: {
      type: String,
      enum: {
        values: ["VACANT", "OCCUPIED"],
        message: "Invalid occupancy status",
      },
      default: "VACANT",
      index: true,
    },

    // ========================================================
    // PROPERTY CONDITION
    // ========================================================

    condition: {
      type: String,
      enum: {
        values: [
          "GOOD",
          "FAIR",
          "NEEDS_ATTENTION",
          "CRITICAL",
        ],
        message: "Invalid property condition",
      },
      default: "GOOD",
      index: true,
    },

    // ========================================================
    // DESCRIPTION
    // ========================================================

    description: {
      type: String,
      trim: true,
      maxlength: [
        2000,
        "Description cannot exceed 2000 characters",
      ],
      default: "",
    },

    // ========================================================
    // PROPERTY AREA
    // ========================================================

    area: {
      value: {
        type: Number,
        min: [0, "Area cannot be negative"],
        default: null,
      },

      unit: {
        type: String,
        enum: {
          values: ["SQ_FT", "SQ_M", "SQ_YD"],
          message: "Invalid area unit",
        },
        default: "SQ_FT",
      },
    },

    // ========================================================
    // PROPERTY STRUCTURE
    // ========================================================

    structure: {
      bedrooms: {
        type: Number,
        min: [0, "Bedrooms cannot be negative"],
        default: 0,
      },

      bathrooms: {
        type: Number,
        min: [0, "Bathrooms cannot be negative"],
        default: 0,
      },

      floors: {
        type: Number,
        min: [0, "Floors cannot be negative"],
        default: 1,
      },

      parkingSpaces: {
        type: Number,
        min: [0, "Parking spaces cannot be negative"],
        default: 0,
      },
    },

    // ========================================================
    // CARETAKER
    // ========================================================

    caretaker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // ========================================================
    // SECURITY
    // ========================================================

    security: {
      securityLevel: {
        type: String,
        enum: {
          values: ["LOW", "MEDIUM", "HIGH"],
          message: "Invalid security level",
        },
        default: "MEDIUM",
      },

      accessNotes: {
        type: String,
        trim: true,
        maxlength: [
          1000,
          "Access notes cannot exceed 1000 characters",
        ],
        default: "",
      },

      emergencyContact: {
        name: {
          type: String,
          trim: true,
          maxlength: [100, "Contact name cannot exceed 100 characters"],
          default: "",
        },

        phone: {
          type: String,
          trim: true,
          maxlength: [30, "Phone number cannot exceed 30 characters"],
          default: "",
        },

        relationship: {
          type: String,
          trim: true,
          maxlength: [50, "Relationship cannot exceed 50 characters"],
          default: "",
        },
      },
    },

    // ========================================================
    // PROPERTY HEALTH
    // ========================================================

    health: {
      score: {
        type: Number,
        min: [0, "Health score cannot be below 0"],
        max: [100, "Health score cannot exceed 100"],
        default: 100,
      },

      lastCalculatedAt: {
        type: Date,
        default: null,
      },
    },

    // ========================================================
    // LAST INSPECTION
    // ========================================================

    lastInspectionAt: {
      type: Date,
      default: null,
      index: true,
    },

    // ========================================================
    // NEXT INSPECTION
    // ========================================================

    nextInspectionAt: {
      type: Date,
      default: null,
      index: true,
    },

    // ========================================================
    // LAST MAINTENANCE
    // ========================================================

    lastMaintenanceAt: {
      type: Date,
      default: null,
    },

    // ========================================================
    // PROPERTY IMAGE
    // ========================================================

    imageUrl: {
      type: String,
      trim: true,
      default: null,
    },

    // ========================================================
    // SOFT DELETE / ARCHIVE SUPPORT
    // ========================================================

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

// Owner + newest properties
propertySchema.index({
  owner: 1,
  createdAt: -1,
});

// Owner + active properties
propertySchema.index({
  owner: 1,
  isActive: 1,
});

// Owner + property status
propertySchema.index({
  owner: 1,
  status: 1,
});

// Owner + occupancy
propertySchema.index({
  owner: 1,
  occupancy: 1,
});

// Owner + condition
propertySchema.index({
  owner: 1,
  condition: 1,
});

// Owner + health score
propertySchema.index({
  owner: 1,
  "health.score": 1,
});

// Caretaker + active properties
propertySchema.index({
  caretaker: 1,
  isActive: 1,
});

// City search
propertySchema.index({
  "address.city": 1,
});

// State search
propertySchema.index({
  "address.state": 1,
});

// Country search
propertySchema.index({
  "address.country": 1,
});

// Upcoming inspections
propertySchema.index({
  nextInspectionAt: 1,
  isActive: 1,
});

// ============================================================
// MODEL
// ============================================================

const Property = mongoose.model("Property", propertySchema);

module.exports = Property;