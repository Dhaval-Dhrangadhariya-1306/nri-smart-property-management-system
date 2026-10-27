const mongoose = require("mongoose");

const Expense = require("../models/Expense");
const Property = require("../models/Property");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const Inspection = require("../models/Inspection");
const createAuditLog = require("../utils/auditLogger");

// ============================================================
// HELPERS
// ============================================================

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const isAdmin = (req) => req.user.role === "ADMIN";

// Owners can access only their own expenses.
// Admins can access all active expenses.
const getExpenseAccessFilter = (req) => ({
  isActive: true,
  ...(isAdmin(req) ? {} : { owner: req.user.userId }),
});

// Owners can access their own active properties.
// Admins can access any active property.
const getPropertyAccessFilter = (req, propertyId) => ({
  _id: propertyId,
  isActive: true,
  status: "ACTIVE",
  ...(isAdmin(req) ? {} : { owner: req.user.userId }),
});

const validateOptionalString = (value, fieldName, maxLength = 2000) => {
  if (value === undefined || value === null) return;

  if (typeof value !== "string") {
    throw createError(`${fieldName} must be a string`);
  }

  if (value.length > maxLength) {
    throw createError(`${fieldName} cannot exceed ${maxLength} characters`);
  }
};

const EXPENSE_CATEGORIES = [
  "MAINTENANCE",
  "ELECTRICITY",
  "WATER",
  "PROPERTY_TAX",
  "INSURANCE",
  "SECURITY",
  "CLEANING",
  "REPAIR",
  "RENOVATION",
  "LEGAL",
  "UTILITY",
  "OTHER",
];

const PAYMENT_STATUSES = ["PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED"];

const PAID_BY_VALUES = ["OWNER", "CARETAKER", "ADMIN", "OTHER"];

const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "UPI",
  "CARD",
  "CHEQUE",
  "OTHER",
];

const validateEnum = (value, allowedValues, fieldName) => {
  if (value !== undefined && !allowedValues.includes(value)) {
    throw createError(`Invalid ${fieldName}`);
  }
};

const validateAmount = (value) => {
  if (value === undefined || value === null || value === "") {
    throw createError("Expense amount is required");
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw createError("Expense amount must be a valid number");
  }

  if (amount < 0) {
    throw createError("Expense amount cannot be negative");
  }

  return amount;
};

const validateExpenseDate = (value) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw createError("Expense date must be a valid date");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError("Expense date must be a valid date");
  }

  if (date > new Date()) {
    throw createError("Expense date cannot be in the future");
  }

  return date;
};

const getExpenseAuditValues = (expense) => ({
  property: expense.property || null,
  owner: expense.owner || null,
  maintenanceRequest: expense.maintenanceRequest || null,
  inspection: expense.inspection || null,
  title: expense.title,
  description: expense.description,
  category: expense.category,
  amount: expense.amount,
  expenseDate: expense.expenseDate,
  paymentStatus: expense.paymentStatus,
  paidBy: expense.paidBy,
  paymentMethod: expense.paymentMethod,
  receiptUrl: expense.receiptUrl,
  notes: expense.notes,
  isActive: expense.isActive,
});

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

    if (!propertyId) {
      throw createError("Property ID is required");
    }

    if (!isValidObjectId(propertyId)) {
      throw createError("Invalid property ID");
    }

    if (typeof title !== "string") {
      throw createError("Expense title is required");
    }

    const cleanTitle = title.trim();

    if (cleanTitle.length < 3) {
      throw createError("Expense title must be at least 3 characters");
    }

    if (cleanTitle.length > 150) {
      throw createError("Expense title cannot exceed 150 characters");
    }

    validateEnum(category, EXPENSE_CATEGORIES, "expense category");

    if (!category) {
      throw createError("Expense category is required");
    }

    validateEnum(paymentStatus, PAYMENT_STATUSES, "payment status");
    validateEnum(paidBy, PAID_BY_VALUES, "paid-by value");
    validateEnum(paymentMethod, PAYMENT_METHODS, "payment method");

    const numericAmount = validateAmount(amount);

    const parsedExpenseDate =
      expenseDate === undefined || expenseDate === null || expenseDate === ""
        ? new Date()
        : validateExpenseDate(expenseDate);

    validateOptionalString(description, "Description");
    validateOptionalString(notes, "Notes");
    validateOptionalString(receiptUrl, "Receipt URL");

    const property = await Property.findOne(
      getPropertyAccessFilter(req, propertyId),
    );

    if (!property) {
      throw createError(
        "Property not found or you do not have access to it",
        404,
      );
    }

    let maintenanceRequest = null;

    if (maintenanceRequestId) {
      if (!isValidObjectId(maintenanceRequestId)) {
        throw createError("Invalid maintenance request ID");
      }

      maintenanceRequest = await MaintenanceRequest.findOne({
        _id: maintenanceRequestId,
        property: property._id,
      });

      if (!maintenanceRequest) {
        throw createError(
          "Maintenance request not found or does not belong to this property",
          404,
        );
      }
    }

    let inspection = null;

    if (inspectionId) {
      if (!isValidObjectId(inspectionId)) {
        throw createError("Invalid inspection ID");
      }

      inspection = await Inspection.findOne({
        _id: inspectionId,
        property: property._id,
      });

      if (!inspection) {
        throw createError(
          "Inspection not found or does not belong to this property",
          404,
        );
      }
    }

    // Always record the actual property owner, even if an admin
    // creates the expense.
    const expense = await Expense.create({
      property: property._id,
      owner: property.owner,
      maintenanceRequest: maintenanceRequest ? maintenanceRequest._id : null,
      inspection: inspection ? inspection._id : null,
      title: cleanTitle,
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

    await createAuditLog({
      req,
      action: "EXPENSE_CREATED",
      resourceType: "EXPENSE",
      resourceId: expense._id,
      property: expense.property,
      description: `Expense "${expense.title}" was created for property "${property.title}".`,
      newValues: getExpenseAuditValues(expense),
    });

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
// Admin: all active expenses.
// Owner: only their own active expenses.
// ============================================================

const getMyExpenses = async (req, res, next) => {
  try {
    const expenses = await Expense.find(getExpenseAccessFilter(req))
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
// GET EXPENSES FOR A PROPERTY
// ============================================================

const getPropertyExpenses = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      throw createError("Invalid property ID");
    }

    const property = await Property.findOne(
      getPropertyAccessFilter(req, propertyId),
    );

    if (!property) {
      throw createError(
        "Property not found or you do not have access to it",
        404,
      );
    }

    const expenses = await Expense.find({
      property: property._id,
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
      ...getExpenseAccessFilter(req),
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
      ...getExpenseAccessFilter(req),
    });

    if (!expense) {
      throw createError(
        "Expense not found or you do not have access to it",
        404,
      );
    }

    const oldValues = getExpenseAuditValues(expense);
    const body = req.body || {};

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

    // Reject unsupported fields.
    const unsupportedFields = Object.keys(body).filter(
      (field) => !allowedFields.includes(field),
    );

    if (unsupportedFields.length > 0) {
      throw createError(
        `Unsupported expense field(s): ${unsupportedFields.join(", ")}`,
      );
    }

    // Validate all provided values before modifying the document.
    validateOptionalString(body.title, "Expense title", 150);
    validateOptionalString(body.description, "Description");
    validateOptionalString(body.receiptUrl, "Receipt URL");
    validateOptionalString(body.notes, "Notes");

    if (body.title !== undefined) {
      if (typeof body.title !== "string") {
        throw createError("Expense title must be a string");
      }

      const cleanTitle = body.title.trim();

      if (cleanTitle.length < 3) {
        throw createError("Expense title must be at least 3 characters");
      }

      if (cleanTitle.length > 150) {
        throw createError("Expense title cannot exceed 150 characters");
      }
    }

    if (body.category !== undefined) {
      if (typeof body.category !== "string") {
        throw createError("Invalid expense category");
      }

      validateEnum(body.category, EXPENSE_CATEGORIES, "expense category");
    }

    if (body.paymentStatus !== undefined) {
      if (typeof body.paymentStatus !== "string") {
        throw createError("Invalid payment status");
      }

      validateEnum(body.paymentStatus, PAYMENT_STATUSES, "payment status");
    }

    if (body.paidBy !== undefined) {
      if (typeof body.paidBy !== "string") {
        throw createError("Invalid paid-by value");
      }

      validateEnum(body.paidBy, PAID_BY_VALUES, "paid-by value");
    }

    if (body.paymentMethod !== undefined) {
      if (typeof body.paymentMethod !== "string") {
        throw createError("Invalid payment method");
      }

      validateEnum(body.paymentMethod, PAYMENT_METHODS, "payment method");
    }

    const validatedAmount =
      body.amount !== undefined ? validateAmount(body.amount) : undefined;

    const validatedDate =
      body.expenseDate !== undefined
        ? validateExpenseDate(body.expenseDate)
        : undefined;

    // All validation has passed. Apply changes now.
    if (body.title !== undefined) {
      expense.title = body.title.trim();
    }

    if (body.description !== undefined) {
      expense.description =
        body.description === null ? "" : body.description.trim();
    }

    if (body.category !== undefined) {
      expense.category = body.category;
    }

    if (validatedAmount !== undefined) {
      expense.amount = validatedAmount;
    }

    if (validatedDate !== undefined) {
      expense.expenseDate = validatedDate;
    }

    if (body.paymentStatus !== undefined) {
      expense.paymentStatus = body.paymentStatus;
    }

    if (body.paidBy !== undefined) {
      expense.paidBy = body.paidBy;
    }

    if (body.paymentMethod !== undefined) {
      expense.paymentMethod = body.paymentMethod;
    }

    if (body.receiptUrl !== undefined) {
      expense.receiptUrl =
        body.receiptUrl === null ? "" : body.receiptUrl.trim();
    }

    if (body.notes !== undefined) {
      expense.notes = body.notes === null ? "" : body.notes.trim();
    }

    await expense.save();

    await createAuditLog({
      req,
      action: "EXPENSE_UPDATED",
      resourceType: "EXPENSE",
      resourceId: expense._id,
      property: expense.property,
      description: `Expense "${expense.title}" was updated.`,
      oldValues,
      newValues: getExpenseAuditValues(expense),
    });

    const updatedExpense = await Expense.findById(expense._id)
      .populate("property", "title propertyType address")
      .populate(
        "maintenanceRequest",
        "title category priority status actualCost",
      )
      .populate("inspection", "overallCondition inspectedAt");

    return res.status(200).json({
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
      ...getExpenseAccessFilter(req),
    });

    if (!expense) {
      throw createError(
        "Expense not found or you do not have access to it",
        404,
      );
    }

    const oldValues = getExpenseAuditValues(expense);

    expense.isActive = false;
    await expense.save();

    await createAuditLog({
      req,
      action: "EXPENSE_DELETED",
      resourceType: "EXPENSE",
      resourceId: expense._id,
      property: expense.property,
      description: `Expense "${expense.title}" was soft-deleted.`,
      oldValues,
      newValues: getExpenseAuditValues(expense),
    });

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
// Admin: platform-wide statistics.
// Owner: statistics for their own expenses.
// ============================================================

const getExpenseStats = async (req, res, next) => {
  try {
    const { propertyId } = req.query;

    const match = {
      isActive: true,
      ...(isAdmin(req)
        ? {}
        : {
            owner: new mongoose.Types.ObjectId(req.user.userId),
          }),
    };

    if (propertyId) {
      if (!isValidObjectId(propertyId)) {
        throw createError("Invalid property ID");
      }

      const property = await Property.findOne(
        getPropertyAccessFilter(req, propertyId),
      );

      if (!property) {
        throw createError(
          "Property not found or you do not have access to it",
          404,
        );
      }

      match.property = new mongoose.Types.ObjectId(propertyId);
    }

    const totalResult = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalExpenses: { $sum: 1 },
        },
      },
    ]);

    const categoryStats = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const paymentStats = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$paymentStatus",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
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
