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

// ============================================================
// ALL EXPENSE ROUTES REQUIRE AUTHENTICATION
// ============================================================

router.use(protect);

// ============================================================
// OWNER / ADMIN ROUTES
// ============================================================

// Create expense
router.post("/", authorize("NRI_OWNER", "ADMIN"), createExpense);

// Get logged-in owner's expenses
router.get("/my", authorize("NRI_OWNER", "ADMIN"), getMyExpenses);

// Get expense statistics
router.get("/stats", authorize("NRI_OWNER", "ADMIN"), getExpenseStats);

// Get expenses for a specific property
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyExpenses,
);

// Get a single expense
router.get("/:expenseId", authorize("NRI_OWNER", "ADMIN"), getExpenseById);

// Update expense
router.put("/:expenseId", authorize("NRI_OWNER", "ADMIN"), updateExpense);

// Soft-delete expense
router.delete("/:expenseId", authorize("NRI_OWNER", "ADMIN"), deleteExpense);

module.exports = router;
