const User = require("../models/User");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");

// ============================================================
// AUTHENTICATION SECURITY CONFIGURATION
// ============================================================

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

// ============================================================
// HELPER: CREATE AUTH TOKEN
// ============================================================

const createAuthToken = (user) => {
  return generateToken({
    userId: user._id.toString(),
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0,
  });
};

// ============================================================
// HELPER: SAFE USER RESPONSE
// Never return password or sensitive fields.
// ============================================================

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
});

// ============================================================
// REGISTER
// POST /api/auth/register
// Public registration always creates an NRI_OWNER.
// ============================================================

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate input types.
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      const error = new Error(
        "Name, email, and password must be valid strings",
      );
      error.statusCode = 400;
      return next(error);
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName || !normalizedEmail || !password) {
      const error = new Error("Name, email, and password are required");
      error.statusCode = 400;
      return next(error);
    }

    // Validate name.
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      const error = new Error("Name must be between 2 and 100 characters");
      error.statusCode = 400;
      return next(error);
    }

    // Validate email.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      const error = new Error("Please provide a valid email address");
      error.statusCode = 400;
      return next(error);
    }

    // Validate password.
    if (password.length < 8) {
      const error = new Error("Password must be at least 8 characters");
      error.statusCode = 400;
      return next(error);
    }

    // Check for an existing account.
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      const error = new Error("User with this email already exists");
      error.statusCode = 409;
      return next(error);
    }

    // Hash password before storing it.
    const hashedPassword = await hashPassword(password);

    // Public registration must never choose privileged roles.
    const user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: "NRI_OWNER",
      isActive: true,
      failedLoginAttempts: 0,
      lockUntil: null,
      tokenVersion: 0,
    });

    const token = createAuthToken(user);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: formatUser(user),
        token,
      },
    });
  } catch (error) {
    // Handle duplicate email races using the database unique index.
    if (error.code === 11000) {
      const duplicateError = new Error("User with this email already exists");
      duplicateError.statusCode = 409;
      return next(duplicateError);
    }

    return next(error);
  }
};

// ============================================================
// LOGIN
// POST /api/auth/login
// ============================================================

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input types.
    if (typeof email !== "string" || typeof password !== "string") {
      const error = new Error("Email and password are required");
      error.statusCode = 400;
      return next(error);
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      const error = new Error("Email and password are required");
      error.statusCode = 400;
      return next(error);
    }

    // Password is select:false in the User model, so select it explicitly.
    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    // Do not reveal whether an account exists.
    if (!user) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      return next(error);
    }

    // Reject inactive accounts.
    if (!user.isActive) {
      const error = new Error(
        "Your account is inactive. Please contact the administrator.",
      );
      error.statusCode = 403;
      return next(error);
    }

    const now = new Date();
    const lockUntil = user.lockUntil ? new Date(user.lockUntil) : null;

    // Reject login attempts while the account is locked.
    if (lockUntil && lockUntil > now) {
      const error = new Error(
        "Too many failed login attempts. Please try again later.",
      );
      error.statusCode = 423;
      return next(error);
    }

    // Clear an expired lock before checking the password.
    if (lockUntil && lockUntil <= now) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOGIN_LOCK_DURATION_MS);
      }

      await user.save();

      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      return next(error);
    }

    // Successful authentication resets lockout state.
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();

    await user.save();

    const token = createAuthToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: formatUser(user),
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// GET CURRENT USER
// GET /api/auth/me
// Requires authentication.
// ============================================================

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      const error = new Error("User account no longer exists");
      error.statusCode = 404;
      return next(error);
    }

    if (!user.isActive) {
      const error = new Error("User account is inactive");
      error.statusCode = 403;
      return next(error);
    }

    return res.status(200).json({
      success: true,
      data: {
        user: formatUser(user),
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// DEVELOPMENT-ONLY CARETAKER PASSWORD RESET
// POST /api/auth/dev/reset-caretaker-password
//
// This endpoint must not be registered in production.
// ============================================================

const resetCaretakerPassword = async (req, res, next) => {
  try {
    // Defense in depth: routes should also exclude this in production.
    if (
      process.env.NODE_ENV === "production" ||
      process.env.AUTH_DEV_MODE !== "true"
    ) {
      const error = new Error("This development endpoint is disabled");
      error.statusCode = 404;
      return next(error);
    }

    const { email, newPassword } = req.body;

    if (typeof email !== "string" || typeof newPassword !== "string") {
      const error = new Error("Email and new password are required");
      error.statusCode = 400;
      return next(error);
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !newPassword) {
      const error = new Error("Email and new password are required");
      error.statusCode = 400;
      return next(error);
    }

    if (newPassword.length < 8) {
      const error = new Error("New password must be at least 8 characters");
      error.statusCode = 400;
      return next(error);
    }

    const user = await User.findOne({
      email: normalizedEmail,
      role: "CARETAKER",
    });

    if (!user) {
      const error = new Error("Caretaker not found");
      error.statusCode = 404;
      return next(error);
    }

    // Change the password and invalidate previously issued tokens.
    user.password = await hashPassword(newPassword);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;

    // Restore the account and clear its lockout state.
    user.isActive = true;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Caretaker password reset successfully",
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  register,
  login,
  getMe,
  resetCaretakerPassword,
};
