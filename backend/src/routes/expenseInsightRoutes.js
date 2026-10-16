const express = require("express");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
  getExpenseInsights,
} = require("../controllers/expenseInsightController");

const router = express.Router();

// ============================================================
// EXPENSE INSIGHTS
// ============================================================

// GET /api/expenses/insights
// NRI Owner / Admin
router.get(
  "/",
  protect,
  authorize("NRI_OWNER", "ADMIN"),
  getExpenseInsights,
);

module.exports = router;