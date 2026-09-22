const mongoose = require("mongoose");

// ============================================================
// VENDOR SCHEMA
// ============================================================

const vendorSchema = new mongoose.Schema(
  {
    // --------------------------------------------------------
    // OWNER
    // --------------------------------------------------------

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // --------------------------------------------------------
    // BASIC INFORMATION
    // --------------------------------------------------------

    name: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
      minlength: [2, "Vendor name must be at least 2 characters"],
      maxlength: [150, "Vendor name cannot exceed 150 characters"],
    },

    companyName: {
      type: String,
      trim: true,
      maxlength: [150, "Company name cannot exceed 150 characters"],
      default: "",
    },

    // --------------------------------------------------------
    // CATEGORY
    // --------------------------------------------------------

    category: {
      type: String,
      required: [true, "Vendor category is required"],
      enum: [
        "PLUMBING",
        "ELECTRICAL",
        "CLEANING",
        "SECURITY",
        "PAINTING",
        "CARPENTRY",
        "HVAC",
        "PEST_CONTROL",
        "APPLIANCE",
        "LANDSCAPING",
        "CONSTRUCTION",
        "LEGAL",
        "INSURANCE",
        "PROPERTY_TAX",
        "OTHER",
      ],
      index: true,
    },

    // --------------------------------------------------------
    // CONTACT INFORMATION
    // --------------------------------------------------------

    phone: {
      type: String,
      trim: true,
      maxlength: [30, "Phone number cannot exceed 30 characters"],
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [150, "Email cannot exceed 150 characters"],
      default: "",
      validate: {
        validator: function (value) {
          if (!value) return true;

          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: "Please provide a valid vendor email address",
      },
    },

    // --------------------------------------------------------
    // ADDRESS
    // --------------------------------------------------------

    address: {
      addressLine1: {
        type: String,
        trim: true,
        maxlength: 200,
        default: "",
      },

      addressLine2: {
        type: String,
        trim: true,
        maxlength: 200,
        default: "",
      },

      city: {
        type: String,
        trim: true,
        maxlength: 100,
        default: "",
      },

      state: {
        type: String,
        trim: true,
        maxlength: 100,
        default: "",
      },

      country: {
        type: String,
        trim: true,
        maxlength: 100,
        default: "India",
      },

      postalCode: {
        type: String,
        trim: true,
        maxlength: 20,
        default: "",
      },
    },

    // --------------------------------------------------------
    // SERVICES
    // --------------------------------------------------------

    services: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 150,
        },
      ],
      default: [],
    },

    // --------------------------------------------------------
    // VENDOR STATUS
    // --------------------------------------------------------

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
      default: "ACTIVE",
      index: true,
    },

    // --------------------------------------------------------
    // RATING
    // --------------------------------------------------------

    rating: {
      type: Number,
      min: [0, "Rating cannot be less than 0"],
      max: [5, "Rating cannot exceed 5"],
      default: 0,
    },

    totalJobs: {
      type: Number,
      min: [0, "Total jobs cannot be negative"],
      default: 0,
    },

    completedJobs: {
      type: Number,
      min: [0, "Completed jobs cannot be negative"],
      default: 0,
    },

    // --------------------------------------------------------
    // NOTES
    // --------------------------------------------------------

    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
      default: "",
    },

    // --------------------------------------------------------
    // SOFT DELETE
    // --------------------------------------------------------

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

vendorSchema.index({
  owner: 1,
  status: 1,
  createdAt: -1,
});

vendorSchema.index({
  owner: 1,
  category: 1,
  createdAt: -1,
});

vendorSchema.index({
  owner: 1,
  isActive: 1,
  createdAt: -1,
});

// ============================================================
// EXPORT
// ============================================================

module.exports = mongoose.model("Vendor", vendorSchema);
