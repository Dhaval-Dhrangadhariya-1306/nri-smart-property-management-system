const User = require("../models/User");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken } = require("../utils/jwt");

// ============================================================
// HELPER: CREATE AUTH TOKEN
// ============================================================

const createAuthToken = (user) => {
  return generateToken({
    userId: user._id.toString(),
    role: user.role,
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
// ============================================================

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // --------------------------------------------------------
    // Basic validation
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Name validation
    // --------------------------------------------------------

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      const error = new Error("Name must be between 2 and 100 characters");
      error.statusCode = 400;
      return next(error);
    }

    // --------------------------------------------------------
    // Email validation
    // --------------------------------------------------------

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      const error = new Error("Please provide a valid email address");
      error.statusCode = 400;
      return next(error);
    }

    // --------------------------------------------------------
    // Password validation
    // --------------------------------------------------------

    if (password.length < 8) {
      const error = new Error("Password must be at least 8 characters");
      error.statusCode = 400;
      return next(error);
    }

    // --------------------------------------------------------
    // Check existing user
    // --------------------------------------------------------

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      const error = new Error("User with this email already exists");
      error.statusCode = 409;
      return next(error);
    }

    // --------------------------------------------------------
    // Hash password
    // --------------------------------------------------------

    const hashedPassword = await hashPassword(password);

    // --------------------------------------------------------
    // Create user
    //
    // Public registration ALWAYS creates an NRI_OWNER.
    // Other roles must be created through controlled workflows.
    // --------------------------------------------------------

    const user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: "NRI_OWNER",
      isActive: true,
    });

    // --------------------------------------------------------
    // Generate JWT
    // --------------------------------------------------------

    const token = createAuthToken(user);

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: formatUser(user),
        token,
      },
    });
  } catch (error) {
    // --------------------------------------------------------
    // MongoDB duplicate key protection
    // --------------------------------------------------------

    if (error.code === 11000) {
      const duplicateError = new Error("User with this email already exists");

      duplicateError.statusCode = 409;

      return next(duplicateError);
    }

    next(error);
  }
};

// ============================================================
// LOGIN
// ============================================================

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // --------------------------------------------------------
    // Validate input types
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Find user
    // Password is explicitly selected because User.js
    // has select: false.
    // --------------------------------------------------------

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    // --------------------------------------------------------
    // Don't reveal whether email exists
    // --------------------------------------------------------

    if (!user) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      return next(error);
    }

    // --------------------------------------------------------
    // Check account status
    // --------------------------------------------------------

    if (!user.isActive) {
      const error = new Error(
        "Your account is inactive. Please contact the administrator.",
      );
      error.statusCode = 403;
      return next(error);
    }

    // --------------------------------------------------------
    // Compare password
    // --------------------------------------------------------

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      return next(error);
    }

    // --------------------------------------------------------
    // Update last login
    // --------------------------------------------------------

    user.lastLogin = new Date();

    await user.save();

    // --------------------------------------------------------
    // Generate JWT
    // --------------------------------------------------------

    const token = createAuthToken(user);

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: formatUser(user),
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET CURRENT USER
// GET /api/auth/me
// ============================================================

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    // --------------------------------------------------------
    // User no longer exists
    // --------------------------------------------------------

    if (!user) {
      const error = new Error("User account no longer exists");
      error.statusCode = 404;
      return next(error);
    }

    // --------------------------------------------------------
    // User has been deactivated after login
    // --------------------------------------------------------

    if (!user.isActive) {
      const error = new Error("User account is inactive");
      error.statusCode = 403;
      return next(error);
    }

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    res.status(200).json({
      success: true,
      data: {
        user: formatUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// TEMPORARY DEVELOPMENT ONLY
// RESET CARETAKER PASSWORD
//
// IMPORTANT:
// This endpoint should NOT exist in production.
// Keep AUTH_DEV_MODE=true in .env only while developing.
// ============================================================

const resetCaretakerPassword = async (req, res, next) => {
  try {
    // --------------------------------------------------------
    // Development protection
    // --------------------------------------------------------

    if (process.env.AUTH_DEV_MODE !== "true") {
      const error = new Error("This development endpoint is disabled");
      error.statusCode = 404;
      return next(error);
    }

    const { email, newPassword } = req.body;

    // --------------------------------------------------------
    // Validate input
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Find caretaker
    // --------------------------------------------------------

    const user = await User.findOne({
      email: normalizedEmail,
      role: "CARETAKER",
    });

    if (!user) {
      const error = new Error("Caretaker not found");
      error.statusCode = 404;
      return next(error);
    }

    // --------------------------------------------------------
    // Update password
    // --------------------------------------------------------

    user.password = await hashPassword(newPassword);
    user.isActive = true;

    await user.save();

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    res.status(200).json({
      success: true,
      message: "Caretaker password reset successfully",
    });
  } catch (error) {
    next(error);
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
