const express = require("express");

const {
  register,
  login,
  getMe,
  resetCaretakerPassword,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

// =========================
// PUBLIC AUTHENTICATION ROUTES
// =========================

router.post("/register", register);

router.post("/login", login);

// =========================
// PROTECTED AUTHENTICATION ROUTES
// =========================

router.get("/me", protect, getMe);

// =========================
// TEMPORARY DEVELOPMENT ROUTE
// =========================
// Used only for development/testing.
// REMOVE THIS ROUTE BEFORE PRODUCTION.

router.post("/dev/reset-caretaker-password", resetCaretakerPassword);

module.exports = router;
