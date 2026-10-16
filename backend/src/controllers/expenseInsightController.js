const {
  getExpenseInsightFoundation,
} = require("../services/expenseInsightService");

// ============================================================
// GET EXPENSE INSIGHTS
// GET /api/expenses/insights
// ============================================================

const getExpenseInsights = async (req, res, next) => {
  try {
    // --------------------------------------------------------
    // AUTHENTICATED USER
    // --------------------------------------------------------

    const ownerId = req.user.userId;

    // --------------------------------------------------------
    // QUERY PARAMETERS
    // --------------------------------------------------------

    const { propertyId = null, period = "12M" } = req.query;

    // --------------------------------------------------------
    // VALID PERIOD
    // --------------------------------------------------------

    const allowedPeriods = ["3M", "6M", "12M"];

    if (!allowedPeriods.includes(period)) {
      const error = new Error(
        "Invalid period. Allowed values are 3M, 6M, and 12M.",
      );

      error.statusCode = 400;

      return next(error);
    }

    // --------------------------------------------------------
    // EXPENSE INSIGHT SERVICE
    // --------------------------------------------------------

    const insights = await getExpenseInsightFoundation({
      ownerId,
      propertyId,
      period,
      isAdmin: req.user.role === "ADMIN",
    });

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Expense insights generated successfully",
      data: insights,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getExpenseInsights,
};
