const mongoose = require("mongoose");

const caretakerAssignmentSchema = new mongoose.Schema(
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

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Assigned by user is required"],
      index: true,
    },

    assignedAt: {
      type: Date,
      default: Date.now,
    },

    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      default: Date.now,
    },

    endDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "COMPLETED", "CANCELLED"],
        message: "Invalid caretaker assignment status",
      },
      default: "ACTIVE",
      index: true,
    },

    responsibilities: {
      type: [String],
      default: [],

      validate: {
        validator: function (value) {
          if (!Array.isArray(value)) {
            return false;
          }

          return value.every(
            (item) =>
              typeof item === "string" &&
              item.trim().length > 0 &&
              item.trim().length <= 200,
          );
        },

        message:
          "Each responsibility must be a non-empty string of maximum 200 characters",
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

/*
 * Only ONE ACTIVE assignment can exist
 * for a property/caretaker combination.
 */
caretakerAssignmentSchema.index(
  {
    property: 1,
    caretaker: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: "ACTIVE",
    },
  },
);

/*
 * Quickly find the active caretaker
 * for a property.
 */
caretakerAssignmentSchema.index({
  property: 1,
  status: 1,
});

/*
 * Quickly find properties assigned
 * to a caretaker.
 */
caretakerAssignmentSchema.index({
  caretaker: 1,
  status: 1,
});

/*
 * Assignment history.
 */
caretakerAssignmentSchema.index({
  property: 1,
  createdAt: -1,
});

caretakerAssignmentSchema.index({
  caretaker: 1,
  createdAt: -1,
});

/*
 * Validate assignment dates.
 */
caretakerAssignmentSchema.pre("validate", function () {
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    throw new Error("End date cannot be before start date");
  }

  if (this.status === "ACTIVE" && this.endDate) {
    throw new Error("An active assignment cannot have an end date");
  }

  if (this.status !== "ACTIVE" && !this.endDate) {
    throw new Error("Completed or cancelled assignments must have an end date");
  }
});

const CaretakerAssignment = mongoose.model(
  "CaretakerAssignment",
  caretakerAssignmentSchema,
);

module.exports = CaretakerAssignment;
