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

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Account registration, login, and current-user information
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     operationId: registerOwner
 *     summary: Register a new owner account
 *     description: Public registration always creates an NRI_OWNER account.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: Rahul Sharma
 *               email:
 *                 type: string
 *                 format: email
 *                 example: rahul@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 format: password
 *                 example: SecurePass123
 *     responses:
 *       201:
 *         description: Account registered successfully
 *       400:
 *         description: Invalid input or validation failure
 *       409:
 *         description: An account with this email already exists
 *       429:
 *         description: Registration rate limit exceeded
 */
router.post("/register", registerLimiter, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     operationId: loginUser
 *     summary: Log in to an existing account
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: rahul@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123
 *     responses:
 *       200:
 *         description: Login successful; returns the user and JWT token
 *       400:
 *         description: Email and password are required
 *       401:
 *         description: Invalid email or password
 *       403:
 *         description: Account is inactive
 *       423:
 *         description: Account temporarily locked after failed login attempts
 *       429:
 *         description: Login rate limit exceeded
 */
router.post("/login", loginLimiter, login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     operationId: getCurrentUser
 *     summary: Get the currently authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information retrieved successfully
 *       401:
 *         description: Authentication token is missing or invalid
 *       403:
 *         description: User account is inactive
 *       404:
 *         description: User account no longer exists
 */
router.get("/me", protect, getMe);

// ============================================================
// DEVELOPMENT-ONLY ROUTE
// ============================================================

// This route is registered only when development mode is explicitly enabled.
if (
  process.env.NODE_ENV !== "production" &&
  process.env.AUTH_DEV_MODE === "true"
) {
  router.post("/dev/reset-caretaker-password", resetCaretakerPassword);
}

module.exports = router;
