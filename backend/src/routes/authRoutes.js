const express = require("express");

const {
  register,
  login,
  getMe,
  resetCaretakerPassword,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

const {
  loginLimiter,
  registerLimiter,
} = require("../middleware/authRateLimiters");

const router = express.Router();

// =========================
// PUBLIC AUTHENTICATION ROUTES
// =========================

router.post("/register", registerLimiter, register);

router.post("/login", loginLimiter, login);

// =========================
// PROTECTED AUTHENTICATION ROUTES
// =========================

router.get("/me", protect, getMe);

// =========================
// DEVELOPMENT-ONLY ROUTE
// Register only when explicitly enabled outside production.
// =========================

if (
  process.env.NODE_ENV !== "production" &&
  process.env.AUTH_DEV_MODE === "true"
) {
  router.post("/dev/reset-caretaker-password", resetCaretakerPassword);
}

module.exports = router;
