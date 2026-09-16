const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ============================================================
    // BASIC USER INFORMATION
    // ============================================================

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    // ============================================================
    // AUTHENTICATION
    // ============================================================

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },

    // ============================================================
    // ROLE / ACCESS CONTROL
    // ============================================================

    role: {
      type: String,
      enum: {
        values: ["NRI_OWNER", "ADMIN", "CARETAKER", "SECURITY_GUARD", "VENDOR"],
        message: "Invalid user role",
      },
      default: "NRI_OWNER",
      index: true,
    },

    // ============================================================
    // ACCOUNT STATUS
    // ============================================================

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Whether the user's email has been verified.
    // Useful when we later add email verification.
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // ============================================================
    // LOGIN / SECURITY INFORMATION
    // ============================================================

    lastLogin: {
      type: Date,
      default: null,
    },

    // Track failed login attempts.
    // Useful for account security and future lockout logic.
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Temporary account lock.
    // null means the account is not locked.
    lockUntil: {
      type: Date,
      default: null,
    },

    // Used later for token/session invalidation.
    // Incrementing this value can invalidate old tokens.
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ============================================================
    // PROFILE
    // ============================================================

    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone number cannot exceed 20 characters"],
      default: null,
    },

    profileImage: {
      type: String,
      trim: true,
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

userSchema.index({
  role: 1,
  isActive: 1,
});

userSchema.index({
  email: 1,
  isActive: 1,
});

// ============================================================
// MODEL
// ============================================================

const User = mongoose.model("User", userSchema);

module.exports = User;
