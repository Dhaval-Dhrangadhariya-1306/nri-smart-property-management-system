const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    // ============================================================
    // PROPERTY & OWNERSHIP
    // ============================================================

    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property is required"],
      index: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner is required"],
      index: true,
    },

    // Optional link to maintenance request
    maintenanceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaintenanceRequest",
      default: null,
      index: true,
    },

    // Optional link to inspection
    inspection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inspection",
      default: null,
      index: true,
    },

    // ============================================================
    // EXPENSE DETAILS
    // ============================================================

    title: {
      type: String,
      required: [true, "Expense title is required"],
      trim: true,
      minlength: [3, "Expense title must be at least 3 characters"],
      maxlength: [150, "Expense title cannot exceed 150 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
      default: "",
    },

    category: {
      type: String,
      enum: [
        "MAINTENANCE",
        "ELECTRICITY",
        "WATER",
        "PROPERTY_TAX",
        "INSURANCE",
        "SECURITY",
        "CLEANING",
        "REPAIR",
        "RENOVATION",
        "LEGAL",
        "UTILITY",
        "OTHER",
      ],
      required: [true, "Expense category is required"],
      index: true,
    },

    amount: {
      type: Number,
      required: [true, "Expense amount is required"],
      min: [0, "Expense amount cannot be negative"],
    },

    expenseDate: {
      type: Date,
      required: [true, "Expense date is required"],
      index: true,
      validate: {
        validator: function (value) {
          return value <= new Date();
        },
        message: "Expense date cannot be in the future",
      },
    },

    // ============================================================
    // PAYMENT
    // ============================================================

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED"],
      default: "PENDING",
      index: true,
    },

    paidBy: {
      type: String,
      enum: ["OWNER", "CARETAKER", "ADMIN", "OTHER"],
      default: "OWNER",
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "OTHER"],
      default: "BANK_TRANSFER",
    },

    // ============================================================
    // DOCUMENT / RECEIPT
    // ============================================================

    receiptUrl: {
      type: String,
      trim: true,
      maxlength: [2000, "Receipt URL cannot exceed 2000 characters"],
      default: "",
    },

    // ============================================================
    // NOTES & SOFT DELETE
    // ============================================================

    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
      default: "",
    },

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

expenseSchema.index({ property: 1, expenseDate: -1 });
expenseSchema.index({ owner: 1, expenseDate: -1 });
expenseSchema.index({ property: 1, category: 1 });
expenseSchema.index({ property: 1, paymentStatus: 1 });
expenseSchema.index({ maintenanceRequest: 1, expenseDate: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
