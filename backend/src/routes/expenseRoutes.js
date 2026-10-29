const express = require("express");

const {
  createExpense,
  getMyExpenses,
  getPropertyExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseStats,
} = require("../controllers/expenseController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Expenses
 *   description: Property expense management, statistics, and records
 */

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(protect);

// ============================================================
// OWNER / ADMIN ROUTES
// ============================================================

/**
 * @swagger
 * /api/expenses:
 *   post:
 *     summary: Create an expense
 *     operationId: createExpense
 *     description: Creates an expense record for a property.
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Expense fields accepted by the expense controller.
 *             additionalProperties: true
 *             properties:
 *               propertyId:
 *                 type: string
 *                 description: MongoDB ID of the property.
 *               category:
 *                 type: string
 *                 example: MAINTENANCE
 *               amount:
 *                 type: number
 *                 example: 2500
 *               description:
 *                 type: string
 *                 example: Plumbing repair
 *               date:
 *                 type: string
 *                 format: date-time
 *               vendor:
 *                 type: string
 *                 description: Vendor ID, if supported by the controller.
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Expense created successfully
 *       400:
 *         description: Invalid or incomplete expense data
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions or property access denied
 *       404:
 *         description: Property not found
 */
router.post("/", authorize("NRI_OWNER", "ADMIN"), createExpense);

/**
 * @swagger
 * /api/expenses/my:
 *   get:
 *     summary: Get my expenses
 *     operationId: getMyExpenses
 *     description: Retrieves expense records associated with the authenticated owner.
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expenses retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get("/my", authorize("NRI_OWNER", "ADMIN"), getMyExpenses);

/**
 * @swagger
 * /api/expenses/stats:
 *   get:
 *     summary: Get expense statistics
 *     operationId: getExpenseStats
 *     description: Retrieves expense statistics for the authenticated owner.
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: propertyId
 *         schema:
 *           type: string
 *         description: Optional property ID for property-specific statistics, if supported.
 *     responses:
 *       200:
 *         description: Expense statistics retrieved successfully
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get("/stats", authorize("NRI_OWNER", "ADMIN"), getExpenseStats);

/**
 * @swagger
 * /api/expenses/property/{propertyId}:
 *   get:
 *     summary: Get expenses for a property
 *     operationId: getPropertyExpenses
 *     description: Retrieves expense records associated with a specific property.
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the property.
 *     responses:
 *       200:
 *         description: Property expenses retrieved successfully
 *       400:
 *         description: Invalid property ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions or property access denied
 *       404:
 *         description: Property not found
 */
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyExpenses,
);

/**
 * @swagger
 * /api/expenses/{expenseId}:
 *   get:
 *     summary: Get an expense by ID
 *     operationId: getExpenseById
 *     description: Retrieves a single expense record.
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the expense.
 *     responses:
 *       200:
 *         description: Expense retrieved successfully
 *       400:
 *         description: Invalid expense ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Expense not found
 */
router.get("/:expenseId", authorize("NRI_OWNER", "ADMIN"), getExpenseById);

/**
 * @swagger
 * /api/expenses/{expenseId}:
 *   put:
 *     summary: Update an expense
 *     operationId: updateExpense
 *     description: Updates an existing expense record.
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the expense.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Expense fields accepted by the update controller.
 *             additionalProperties: true
 *             properties:
 *               category:
 *                 type: string
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Expense updated successfully
 *       400:
 *         description: Invalid expense ID or update data
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Expense not found
 */
router.put("/:expenseId", authorize("NRI_OWNER", "ADMIN"), updateExpense);

/**
 * @swagger
 * /api/expenses/{expenseId}:
 *   delete:
 *     summary: Archive an expense
 *     operationId: deleteExpense
 *     description: Soft-deletes an expense record according to the application's behavior.
 *     tags: [Expenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the expense.
 *     responses:
 *       200:
 *         description: Expense archived successfully
 *       400:
 *         description: Invalid expense ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Expense not found
 */
router.delete("/:expenseId", authorize("NRI_OWNER", "ADMIN"), deleteExpense);

module.exports = router;