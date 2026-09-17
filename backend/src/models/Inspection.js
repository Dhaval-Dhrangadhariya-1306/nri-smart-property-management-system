const mongoose = require("mongoose");

const inspectionSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property is required"],
      index: true,
    },

    caretaker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Caretaker is required"],
      index: true,
    },

    overallCondition: {
      type: String,
      enum: {
        values: ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"],
        message: "Invalid overall condition",
      },
      required: [true, "Overall condition is required"],
    },

    securityStatus: {
      type: String,
      enum: {
        values: ["NORMAL", "WARNING", "CRITICAL"],
        message: "Invalid security status",
      },
      required: [true, "Security status is required"],
    },

    electricalStatus: {
      type: String,
      enum: {
        values: ["NORMAL", "WARNING", "CRITICAL", "NOT_CHECKED"],
        message: "Invalid electrical status",
      },
      default: "NOT_CHECKED",
    },

    plumbingStatus: {
      type: String,
      enum: {
        values: ["NORMAL", "WARNING", "CRITICAL", "NOT_CHECKED"],
        message: "Invalid plumbing status",
      },
      default: "NOT_CHECKED",
    },

    cleanliness: {
      type: String,
      enum: {
        values: ["EXCELLENT", "GOOD", "FAIR", "POOR"],
        message: "Invalid cleanliness status",
      },
      default: "GOOD",
    },

    issuesFound: {
      type: [String],
      default: [],
      validate: {
        validator: function (issues) {
          return issues.every(
            (issue) =>
              typeof issue === "string" &&
              issue.trim().length > 0 &&
              issue.trim().length <= 500,
          );
        },
        message:
          "Each issue must be a non-empty string of maximum 500 characters",
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Inspection notes cannot exceed 2000 characters"],
      default: "",
    },

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
        message: "Each inspection image must be a valid non-empty URL/path",
      },
    },

    inspectedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    status: {
      type: String,
      enum: {
        values: ["COMPLETED", "DRAFT"],
        message: "Invalid inspection status",
      },
      default: "COMPLETED",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

inspectionSchema.index({
  property: 1,
  inspectedAt: -1,
});

inspectionSchema.index({
  caretaker: 1,
  inspectedAt: -1,
});

inspectionSchema.index({
  property: 1,
  status: 1,
});

const Inspection = mongoose.model("Inspection", inspectionSchema);

module.exports = Inspection;
