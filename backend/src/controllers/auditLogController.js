const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const Property = require("../models/Property");

// ============================================================
// HELPERS
// ============================================================

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (id) =>
  typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

// ============================================================
// GET MY AUDIT LOGS
// ============================================================

const getMyAuditLogs = async (req, res, next) => {
  try {
    const actorId = req.user.userId;

    const logs = await AuditLog.find({
      actor: actorId,
    })
      .populate("actor", "name email role isActive")
      .populate("property", "title propertyType address")
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      message: "Audit logs retrieved successfully",
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// GET PROPERTY AUDIT LOGS
// ============================================================

const getPropertyAuditLogs = async (req, res, next) => {
  try {
    const ownerId = req.user.userId;
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      return next(createHttpError("Invalid property ID", 400));
    }

    // Verify ownership before retrieving any logs.
    const property = await Property.findOne({
      _id: propertyId,
      owner: ownerId,
    })
      .select("_id title propertyType address")
      .lean();

    if (!property) {
      return next(createHttpError("Property not found", 404));
    }

    const logs = await AuditLog.find({
      property: propertyId,
    })
      .populate("actor", "name email role isActive")
      .populate("property", "title propertyType address")
      .sort({ createdAt: -1, _id: -1 })
      .limit(200)
      .lean();

    return res.status(200).json({
      success: true,
      message: "Property audit logs retrieved successfully",
      property,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// GET PROPERTY ACTIVITY TIMELINE
// ============================================================

const getPropertyActivityTimeline = async (req, res, next) => {
  try {
    const ownerId = req.user.userId;
    const { propertyId } = req.params;

    const {
      page = "1",
      limit = "20",
      action,
      resourceType,
      from,
      to,
    } = req.query;

    // Validate property ID.
    if (!isValidObjectId(propertyId)) {
      return next(createHttpError("Invalid property ID", 400));
    }

    // Validate query parameter types before using string methods.
    for (const [name, value] of [
      ["page", page],
      ["limit", limit],
      ["action", action],
      ["resourceType", resourceType],
      ["from", from],
      ["to", to],
    ]) {
      if (value !== undefined && typeof value !== "string") {
        return next(
          createHttpError(`${name} must be a single string value`, 400),
        );
      }
    }

    // Validate pagination.
    if (!/^[1-9]\d*$/.test(page) || !/^[1-9]\d*$/.test(limit)) {
      return next(
        createHttpError(
          "page must be a positive integer and limit must be a positive integer",
          400,
        ),
      );
    }

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isSafeInteger(pageNumber) ||
      !Number.isSafeInteger(pageSize) ||
      pageSize > 100
    ) {
      return next(
        createHttpError(
          "Invalid pagination values. Limit must not exceed 100",
          400,
        ),
      );
    }

    // Prevent unsafe or unreasonable skip values.
    const skip = (pageNumber - 1) * pageSize;

    if (!Number.isSafeInteger(skip)) {
      return next(createHttpError("Pagination value is too large", 400));
    }

    // Validate optional action and resource filters.
    if (action !== undefined && !isNonEmptyString(action)) {
      return next(createHttpError("action must be a non-empty string", 400));
    }

    if (resourceType !== undefined && !isNonEmptyString(resourceType)) {
      return next(
        createHttpError("resourceType must be a non-empty string", 400),
      );
    }

    // Validate optional date filters.
    let fromDate;
    let toDate;

    if (from !== undefined) {
      if (!isNonEmptyString(from)) {
        return next(createHttpError("from must be a valid date string", 400));
      }

      fromDate = new Date(from);

      if (Number.isNaN(fromDate.getTime())) {
        return next(createHttpError("Invalid from date", 400));
      }
    }

    if (to !== undefined) {
      if (!isNonEmptyString(to)) {
        return next(createHttpError("to must be a valid date string", 400));
      }

      toDate = new Date(to);

      if (Number.isNaN(toDate.getTime())) {
        return next(createHttpError("Invalid to date", 400));
      }
    }

    if (fromDate && toDate && fromDate > toDate) {
      return next(
        createHttpError("'from' date must not be after 'to' date", 400),
      );
    }

    // Verify property ownership before querying the timeline.
    const property = await Property.findOne({
      _id: propertyId,
      owner: ownerId,
    })
      .select("_id title propertyType address")
      .lean();

    if (!property) {
      return next(createHttpError("Property not found", 404));
    }

    // Construct a filter from validated inputs only.
    const filter = {
      property: propertyId,
    };

    if (action !== undefined) {
      filter.action = action.trim().toUpperCase();
    }

    if (resourceType !== undefined) {
      filter.resourceType = resourceType.trim().toUpperCase();
    }

    if (fromDate || toDate) {
      filter.createdAt = {};

      if (fromDate) {
        filter.createdAt.$gte = fromDate;
      }

      if (toDate) {
        filter.createdAt.$lte = toDate;
      }
    }

    const total = await AuditLog.countDocuments(filter);

    const logs = await AuditLog.find(filter)
      .populate("actor", "name email role isActive")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    const timeline = logs.map((log) => ({
      id: log._id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      description: log.description,
      actor: log.actor,
      createdAt: log.createdAt,
    }));

    return res.status(200).json({
      success: true,
      message: "Property activity timeline retrieved successfully",
      property,
      count: timeline.length,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: skip + timeline.length < total,
        hasPreviousPage: pageNumber > 1,
      },
      data: timeline,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================
// GET SINGLE AUDIT LOG
// ============================================================

const getAuditLogById = async (req, res, next) => {
  try {
    const ownerId = req.user.userId;
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return next(createHttpError("Invalid audit log ID", 400));
    }

    const log = await AuditLog.findById(id)
      .populate("actor", "name email role isActive")
      .populate("property", "title propertyType address")
      .lean();

    if (!log) {
      return next(createHttpError("Audit log not found", 404));
    }

    // The owner can access their own logs or logs for their
    // currently owned properties.
    const actorOwnLog = log.actor?._id?.toString() === ownerId.toString();

    let propertyOwnLog = false;

    if (log.property?._id) {
      propertyOwnLog = Boolean(
        await Property.exists({
          _id: log.property._id,
          owner: ownerId,
          isActive: true,
        }),
      );
    }

    if (!actorOwnLog && !propertyOwnLog) {
      return next(createHttpError("Audit log not found", 404));
    }

    return res.status(200).json({
      success: true,
      message: "Audit log retrieved successfully",
      data: log,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMyAuditLogs,
  getPropertyAuditLogs,
  getPropertyActivityTimeline,
  getAuditLogById,
};
