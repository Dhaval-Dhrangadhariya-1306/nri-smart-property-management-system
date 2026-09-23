const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const Property = require("../models/Property");

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
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      message: "Audit logs retrieved successfully",
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET PROPERTY AUDIT LOGS
// ============================================================

const getPropertyAuditLogs = async (req, res, next) => {
  try {
    const ownerId = req.user.userId;
    const { propertyId } = req.params;

    // --------------------------------------------------------
    // Validate ObjectId
    // --------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      const error = new Error("Invalid property ID");
      error.statusCode = 400;
      return next(error);
    }

    // --------------------------------------------------------
    // Verify property belongs to current owner
    // --------------------------------------------------------

    const property = await Property.findOne({
      _id: propertyId,
      owner: ownerId,
    })
      .select("_id title propertyType address")
      .lean();

    if (!property) {
      const error = new Error("Property not found");
      error.statusCode = 404;
      return next(error);
    }

    // --------------------------------------------------------
    // Get logs
    // --------------------------------------------------------

    const logs = await AuditLog.find({
      property: propertyId,
    })
      .populate("actor", "name email role isActive")
      .populate("property", "title propertyType address")
      .sort({ createdAt: -1 })
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
    next(error);
  }
};

// ============================================================
// GET SINGLE AUDIT LOG
// ============================================================

const getAuditLogById = async (req, res, next) => {
  try {
    const ownerId = req.user.userId;
    const { id } = req.params;

    // --------------------------------------------------------
    // Validate ObjectId
    // --------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error("Invalid audit log ID");
      error.statusCode = 400;
      return next(error);
    }

    // --------------------------------------------------------
    // Find audit log
    // --------------------------------------------------------

    const log = await AuditLog.findById(id)
      .populate("actor", "name email role isActive")
      .populate("property", "title propertyType address")
      .lean();

    if (!log) {
      const error = new Error("Audit log not found");
      error.statusCode = 404;
      return next(error);
    }

    // --------------------------------------------------------
    // Security check
    //
    // Owner can access:
    // 1. Their own audit log
    // 2. An audit log belonging to their property
    // --------------------------------------------------------

    const actorOwnLog =
      log.actor && log.actor._id && log.actor._id.toString() === ownerId;

    let propertyOwnLog = false;

    if (log.property && log.property._id) {
      const property = await Property.findOne({
        _id: log.property._id,
        owner: ownerId,
        isActive: true,
      })
        .select("_id")
        .lean();

      propertyOwnLog = Boolean(property);
    }

    if (!actorOwnLog && !propertyOwnLog) {
      const error = new Error("Audit log not found");
      error.statusCode = 404;
      return next(error);
    }

    return res.status(200).json({
      success: true,
      message: "Audit log retrieved successfully",
      data: log,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyAuditLogs,
  getPropertyAuditLogs,
  getAuditLogById,
};
