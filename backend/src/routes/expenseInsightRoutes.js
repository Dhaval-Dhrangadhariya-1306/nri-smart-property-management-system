const express = require("express");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
  getExpenseInsights,
} = require("../controllers/expenseInsightController");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Expense Insights
 *   description: Expense analytics and spending insights
 */

// ============================================================
// EXPENSE INSIGHTS
// ============================================================

/**
 * @swagger
 * /api/expenses/insights:
 *   get:
 *     summary: Get expense insights
 *     operationId: getExpenseInsights
 *     description: Retrieves expense analytics and insights for the authenticated property owner.
 *     tags: [Expense Insights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: propertyId
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional MongoDB ID used to filter insights for a specific property, if supported by the controller.
 *     responses:
 *       200:
 *         description: Expense insights retrieved successfully
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions or property access denied
 *       404:
 *         description: Property or requested resource not found
 */
router.get("/", protect, authorize("NRI_OWNER", "ADMIN"), getExpenseInsights);

module.exports = router;
