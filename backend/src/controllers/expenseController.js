const mongoose = require("mongoose");

const Expense = require("../models/Expense");
const Property = require("../models/Property");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const Inspection = require("../models/Inspection");

// ============================================================
// HELPERS
// ============================================================

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// ============================================================
// CREATE EXPENSE
// ============================================================

const createExpense = async (req, res, next) => {
  try {
    const {
      propertyId,
      maintenanceRequestId,
      inspectionId,
      title,
      description,
      category,
      amount,
      expenseDate,
      paymentStatus,
      paidBy,
      paymentMethod,
      receiptUrl,
      notes,
    } = req.body;

    // --------------------------------------------------------
    // BASIC VALIDATION
    // --------------------------------------------------------

    if (!propertyId) {
      throw createError("Property ID is required");
    }

    if (!isValidObjectId(propertyId)) {
      throw createError("Invalid property ID");
    }

    if (!title || typeof title !== "string") {
      throw createError("Expense title is required");
    }

    if (title.trim().length < 3) {
      throw createError("Expense title must be at least 3 characters");
    }

    if (title.trim().length > 150) {
      throw createError("Expense title cannot exceed 150 characters");
    }

    if (!category) {
      throw createError("Expense category is required");
    }

    if (amount === undefined || amount === null || amount === "") {
      throw createError("Expense amount is required");
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
      throw createError("Expense amount must be a valid number");
    }

    if (numericAmount < 0) {
      throw createError("Expense amount cannot be negative");
    }

    // --------------------------------------------------------
    // EXPENSE DATE
    // --------------------------------------------------------

    let parsedExpenseDate;

    if (expenseDate) {
      parsedExpenseDate = new Date(expenseDate);

      if (Number.isNaN(parsedExpenseDate.getTime())) {
        throw createError("Invalid expense date");
      }

      if (parsedExpenseDate > new Date()) {
        throw createError("Expense date cannot be in the future");
      }
    } else {
      parsedExpenseDate = new Date();
    }

    // --------------------------------------------------------
    // VALIDATE PROPERTY OWNERSHIP
    // --------------------------------------------------------

    const property = await Property.findOne({
      _id: propertyId,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    });

    if (!property) {
      throw createError(
        "Property not found or you do not have access to it",
        404,
      );
    }

    // --------------------------------------------------------
    // OPTIONAL MAINTENANCE REQUEST
    // --------------------------------------------------------

    let maintenanceRequest = null;

    if (maintenanceRequestId) {
      if (!isValidObjectId(maintenanceRequestId)) {
        throw createError("Invalid maintenance request ID");
      }

      maintenanceRequest = await MaintenanceRequest.findOne({
        _id: maintenanceRequestId,
        property: propertyId,
      });

      if (!maintenanceRequest) {
        throw createError(
          "Maintenance request not found or does not belong to this property",
          404,
        );
      }
    }

    // --------------------------------------------------------
    // OPTIONAL INSPECTION
    // --------------------------------------------------------

    let inspection = null;

    if (inspectionId) {
      if (!isValidObjectId(inspectionId)) {
        throw createError("Invalid inspection ID");
      }

      inspection = await Inspection.findOne({
        _id: inspectionId,
        property: propertyId,
      });

      if (!inspection) {
        throw createError(
          "Inspection not found or does not belong to this property",
          404,
        );
      }
    }

    // --------------------------------------------------------
    // VALIDATE STRING FIELDS
    // --------------------------------------------------------

    if (description !== undefined && description !== null) {
      if (typeof description !== "string") {
        throw createError("Description must be a string");
      }

      if (description.length > 2000) {
        throw createError("Description cannot exceed 2000 characters");
      }
    }

    if (notes !== undefined && notes !== null) {
      if (typeof notes !== "string") {
        throw createError("Notes must be a string");
      }

      if (notes.length > 2000) {
        throw createError("Notes cannot exceed 2000 characters");
      }
    }

    if (receiptUrl !== undefined && receiptUrl !== null) {
      if (typeof receiptUrl !== "string") {
        throw createError("Receipt URL must be a string");
      }

      if (receiptUrl.length > 2000) {
        throw createError("Receipt URL cannot exceed 2000 characters");
      }
    }

    // --------------------------------------------------------
    // CREATE EXPENSE
    // --------------------------------------------------------

    const expense = await Expense.create({
      property: propertyId,
      owner: req.user.userId,
      maintenanceRequest: maintenanceRequest ? maintenanceRequest._id : null,
      inspection: inspection ? inspection._id : null,
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : "",
      category,
      amount: numericAmount,
      expenseDate: parsedExpenseDate,
      paymentStatus: paymentStatus || "PENDING",
      paidBy: paidBy || "OWNER",
      paymentMethod: paymentMethod || "BANK_TRANSFER",
      receiptUrl: typeof receiptUrl === "string" ? receiptUrl.trim() : "",
      notes: typeof notes === "string" ? notes.trim() : "",
    });

    // --------------------------------------------------------
    // POPULATE RESPONSE
    // --------------------------------------------------------

    const populatedExpense = await Expense.findById(expense._id)
      .populate("property", "title propertyType address")
      .populate(
        "maintenanceRequest",
        "title category priority status estimatedCost actualCost",
      )
      .populate(
        "inspection",
        "overallCondition securityStatus electricalStatus plumbingStatus inspectedAt",
      );

    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: populatedExpense,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET MY EXPENSES
// ============================================================

const getMyExpenses = async (req, res, next) => {
  try {
    const expenses = await Expense.find({
      owner: req.user.userId,
      isActive: true,
    })
      .populate("property", "title propertyType address")
      .populate(
        "maintenanceRequest",
        "title category priority status actualCost",
      )
      .populate("inspection", "overallCondition inspectedAt")
      .sort({ expenseDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET PROPERTY EXPENSES
// ============================================================

const getPropertyExpenses = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      throw createError("Invalid property ID");
    }

    // --------------------------------------------------------
    // VERIFY PROPERTY OWNERSHIP
    // --------------------------------------------------------

    const property = await Property.findOne({
      _id: propertyId,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    });

    if (!property) {
      throw createError(
        "Property not found or you do not have access to it",
        404,
      );
    }

    const expenses = await Expense.find({
      property: propertyId,
      owner: req.user.userId,
      isActive: true,
    })
      .populate("property", "title propertyType address")
      .populate(
        "maintenanceRequest",
        "title category priority status actualCost",
      )
      .populate("inspection", "overallCondition inspectedAt")
      .sort({ expenseDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: expenses.length,
      data: expenses,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET SINGLE EXPENSE
// ============================================================

const getExpenseById = async (req, res, next) => {
  try {
    const { expenseId } = req.params;

    if (!isValidObjectId(expenseId)) {
      throw createError("Invalid expense ID");
    }

    const expense = await Expense.findOne({
      _id: expenseId,
      owner: req.user.userId,
      isActive: true,
    })
      .populate("property", "title propertyType address")
      .populate(
        "maintenanceRequest",
        "title description category priority status estimatedCost actualCost",
      )
      .populate(
        "inspection",
        "overallCondition securityStatus electricalStatus plumbingStatus cleanliness issuesFound inspectedAt",
      );

    if (!expense) {
      throw createError(
        "Expense not found or you do not have access to it",
        404,
      );
    }

    res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// UPDATE EXPENSE
// ============================================================

const updateExpense = async (req, res, next) => {
  try {
    const { expenseId } = req.params;

    if (!isValidObjectId(expenseId)) {
      throw createError("Invalid expense ID");
    }

    const expense = await Expense.findOne({
      _id: expenseId,
      owner: req.user.userId,
      isActive: true,
    });

    if (!expense) {
      throw createError(
        "Expense not found or you do not have access to it",
        404,
      );
    }

    const allowedFields = [
      "title",
      "description",
      "category",
      "amount",
      "expenseDate",
      "paymentStatus",
      "paidBy",
      "paymentMethod",
      "receiptUrl",
      "notes",
    ];

    // --------------------------------------------------------
    // UPDATE ONLY ALLOWED FIELDS
    // --------------------------------------------------------

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        expense[field] = req.body[field];
      }
    }

    // --------------------------------------------------------
    // VALIDATE AMOUNT
    // --------------------------------------------------------

    if (req.body.amount !== undefined) {
      const numericAmount = Number(req.body.amount);

      if (!Number.isFinite(numericAmount)) {
        throw createError("Expense amount must be a valid number");
      }

      if (numericAmount < 0) {
        throw createError("Expense amount cannot be negative");
      }

      expense.amount = numericAmount;
    }

    // --------------------------------------------------------
    // VALIDATE EXPENSE DATE
    // --------------------------------------------------------

    if (req.body.expenseDate !== undefined) {
      const parsedDate = new Date(req.body.expenseDate);

      if (Number.isNaN(parsedDate.getTime())) {
        throw createError("Invalid expense date");
      }

      if (parsedDate > new Date()) {
        throw createError("Expense date cannot be in the future");
      }

      expense.expenseDate = parsedDate;
    }

    // --------------------------------------------------------
    // VALIDATE TITLE
    // --------------------------------------------------------

    if (expense.title) {
      expense.title = expense.title.trim();

      if (expense.title.length < 3) {
        throw createError("Expense title must be at least 3 characters");
      }

      if (expense.title.length > 150) {
        throw createError("Expense title cannot exceed 150 characters");
      }
    }

    // --------------------------------------------------------
    // TRIM STRING FIELDS
    // --------------------------------------------------------

    if (typeof expense.description === "string") {
      expense.description = expense.description.trim();
    }

    if (typeof expense.notes === "string") {
      expense.notes = expense.notes.trim();
    }

    if (typeof expense.receiptUrl === "string") {
      expense.receiptUrl = expense.receiptUrl.trim();
    }

    await expense.save();

    const updatedExpense = await Expense.findById(expense._id)
      .populate("property", "title propertyType address")
      .populate(
        "maintenanceRequest",
        "title category priority status actualCost",
      )
      .populate("inspection", "overallCondition inspectedAt");

    res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: updatedExpense,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// SOFT DELETE EXPENSE
// ============================================================

const deleteExpense = async (req, res, next) => {
  try {
    const { expenseId } = req.params;

    if (!isValidObjectId(expenseId)) {
      throw createError("Invalid expense ID");
    }

    const expense = await Expense.findOne({
      _id: expenseId,
      owner: req.user.userId,
      isActive: true,
    });

    if (!expense) {
      throw createError(
        "Expense not found or you do not have access to it",
        404,
      );
    }

    expense.isActive = false;

    await expense.save();

    res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// EXPENSE STATISTICS
// ============================================================

const getExpenseStats = async (req, res, next) => {
  try {
    const { propertyId } = req.query;

    const match = {
      owner: new mongoose.Types.ObjectId(req.user.userId),
      isActive: true,
    };

    // --------------------------------------------------------
    // OPTIONAL PROPERTY FILTER
    // --------------------------------------------------------

    if (propertyId) {
      if (!isValidObjectId(propertyId)) {
        throw createError("Invalid property ID");
      }

      const property = await Property.findOne({
        _id: propertyId,
        owner: req.user.userId,
        isActive: true,
        status: "ACTIVE",
      });

      if (!property) {
        throw createError(
          "Property not found or you do not have access to it",
          404,
        );
      }

      match.property = new mongoose.Types.ObjectId(propertyId);
    }

    // --------------------------------------------------------
    // TOTAL EXPENSE
    // --------------------------------------------------------

    const totalResult = await Expense.aggregate([
      {
        $match: match,
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalExpenses: { $sum: 1 },
        },
      },
    ]);

    // --------------------------------------------------------
    // BY CATEGORY
    // --------------------------------------------------------

    const categoryStats = await Expense.aggregate([
      {
        $match: match,
      },
      {
        $group: {
          _id: "$category",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          totalAmount: -1,
        },
      },
    ]);

    // --------------------------------------------------------
    // BY PAYMENT STATUS
    // --------------------------------------------------------

    const paymentStats = await Expense.aggregate([
      {
        $match: match,
      },
      {
        $group: {
          _id: "$paymentStatus",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          totalAmount: -1,
        },
      },
    ]);

    const total = totalResult[0] || {
      totalAmount: 0,
      totalExpenses: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        totalExpenses: total.totalExpenses,
        totalAmount: total.totalAmount,
        byCategory: categoryStats,
        byPaymentStatus: paymentStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createExpense,
  getMyExpenses,
  getPropertyExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseStats,
};
