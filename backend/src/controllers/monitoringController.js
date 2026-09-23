const mongoose = require("mongoose");

const MonitoringEvent = require("../models/MonitoringEvent");
const Property = require("../models/Property");

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// ============================================================
// CREATE MONITORING / SECURITY EVENT
// ============================================================

const createMonitoringEvent = async (req, res, next) => {
  try {
    const {
      propertyId,
      eventType,
      severity,
      title,
      description,
      location,
      metadata,
      occurredAt,
    } = req.body;

    // ----------------------------------------------------------
    // Validate required fields
    // ----------------------------------------------------------

    if (!propertyId || !eventType || !title) {
      return next(
        createError("Property ID, event type, and title are required"),
      );
    }

    if (!isValidObjectId(propertyId)) {
      return next(createError("Invalid property ID"));
    }

    if (typeof title !== "string" || title.trim().length < 3) {
      return next(createError("Event title must be at least 3 characters"));
    }

    if (title.trim().length > 150) {
      return next(createError("Event title cannot exceed 150 characters"));
    }

    if (description !== undefined && typeof description !== "string") {
      return next(createError("Description must be a string"));
    }

    if (description && description.trim().length > 2000) {
      return next(
        createError("Event description cannot exceed 2000 characters"),
      );
    }

    // ----------------------------------------------------------
    // Verify property access
    //
    // NRI_OWNER:
    //   Can only access their own active property.
    //
    // ADMIN:
    //   Can access any active property.
    // ----------------------------------------------------------

    const propertyQuery = {
      _id: propertyId,
      isActive: true,
      status: "ACTIVE",
    };

    if (req.user.role === "NRI_OWNER") {
      propertyQuery.owner = req.user.userId;
    }

    const property = await Property.findOne(propertyQuery);

    if (!property) {
      return next(
        createError("Property not found or you do not have access to it", 404),
      );
    }

    // ----------------------------------------------------------
    // Validate occurredAt
    // ----------------------------------------------------------

    let eventDate = new Date();

    if (occurredAt !== undefined) {
      eventDate = new Date(occurredAt);

      if (Number.isNaN(eventDate.getTime())) {
        return next(createError("Invalid occurredAt date"));
      }

      if (eventDate > new Date()) {
        return next(
          createError("Event occurrence time cannot be in the future"),
        );
      }
    }

    // ----------------------------------------------------------
    // Determine trusted event source
    //
    // Do not allow the client to claim SYSTEM, MAINTENANCE,
    // INSPECTION, etc. through req.body.source.
    //
    // Manual events created through this endpoint are attributed
    // to the authenticated actor.
    // ----------------------------------------------------------

    const eventSource = req.user.role === "ADMIN" ? "SYSTEM" : "OWNER";

    // ----------------------------------------------------------
    // Create event
    // ----------------------------------------------------------

    const monitoringEvent = await MonitoringEvent.create({
      property: property._id,
      owner: property.owner,

      eventType,
      severity: severity || "INFO",

      title: title.trim(),
      description: description ? description.trim() : "",

      source: eventSource,

      location,
      metadata: metadata || {},

      occurredAt: eventDate,
    });

    await monitoringEvent.populate([
      {
        path: "property",
        select:
          "title propertyType address status occupancy condition health securityLevel",
      },
      {
        path: "owner",
        select: "name email role",
      },
    ]);

    return res.status(201).json({
      success: true,
      message: "Monitoring event created successfully",
      data: {
        event: monitoringEvent,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET PROPERTY EVENTS
// ============================================================

const getPropertyEvents = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      return next(createError("Invalid property ID"));
    }

    // ----------------------------------------------------------
    // Verify property access
    // ----------------------------------------------------------

    const propertyQuery = {
      _id: propertyId,
      isActive: true,
    };

    if (req.user.role === "NRI_OWNER") {
      propertyQuery.owner = req.user.userId;
    }

    const property = await Property.findOne(propertyQuery);

    if (!property) {
      return next(
        createError("Property not found or you do not have access to it", 404),
      );
    }

    const eventQuery = {
      property: propertyId,
    };

    // Owners only see their own property's events.
    // Admins can see events across properties.
    if (req.user.role === "NRI_OWNER") {
      eventQuery.owner = req.user.userId;
    }

    const events = await MonitoringEvent.find(eventQuery)
      .populate(
        "property",
        "title propertyType address status occupancy condition health securityLevel",
      )
      .populate("owner", "name email role")
      .populate("acknowledgedBy", "name email role")
      .populate("resolvedBy", "name email role")
      .sort({
        occurredAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: events.length,
      data: {
        events,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET MY MONITORING EVENTS
// ============================================================

const getMyMonitoringEvents = async (req, res, next) => {
  try {
    const events = await MonitoringEvent.find({
      owner: req.user.userId,
    })
      .populate(
        "property",
        "title propertyType address status occupancy condition health securityLevel",
      )
      .populate("acknowledgedBy", "name email role")
      .populate("resolvedBy", "name email role")
      .sort({
        occurredAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: events.length,
      data: {
        events,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ACKNOWLEDGE MONITORING EVENT
// ============================================================

const acknowledgeEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
      return next(createError("Invalid event ID"));
    }

    // ----------------------------------------------------------
    // Find event
    //
    // NRI_OWNER:
    //   Only their own events.
    //
    // ADMIN:
    //   Any event.
    // ----------------------------------------------------------

    const eventQuery = {
      _id: eventId,
    };

    if (req.user.role === "NRI_OWNER") {
      eventQuery.owner = req.user.userId;
    }

    const event = await MonitoringEvent.findOne(eventQuery);

    if (!event) {
      return next(createError("Monitoring event not found", 404));
    }

    if (event.isAcknowledged) {
      return next(createError("Monitoring event is already acknowledged"));
    }

    if (event.isResolved) {
      return next(
        createError("Resolved monitoring events cannot be acknowledged"),
      );
    }

    event.isAcknowledged = true;
    event.acknowledgedBy = req.user.userId;
    event.acknowledgedAt = new Date();

    await event.save();

    await event.populate([
      {
        path: "property",
        select:
          "title propertyType address status occupancy condition health securityLevel",
      },
      {
        path: "owner",
        select: "name email role",
      },
      {
        path: "acknowledgedBy",
        select: "name email role",
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Monitoring event acknowledged successfully",
      data: {
        event,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// RESOLVE MONITORING EVENT
// ============================================================

const resolveEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
      return next(createError("Invalid event ID"));
    }

    // ----------------------------------------------------------
    // Find event
    //
    // NRI_OWNER:
    //   Only their own events.
    //
    // ADMIN:
    //   Any event.
    // ----------------------------------------------------------

    const eventQuery = {
      _id: eventId,
    };

    if (req.user.role === "NRI_OWNER") {
      eventQuery.owner = req.user.userId;
    }

    const event = await MonitoringEvent.findOne(eventQuery);

    if (!event) {
      return next(createError("Monitoring event not found", 404));
    }

    if (!event.isAcknowledged) {
      return next(
        createError(
          "Monitoring event must be acknowledged before it can be resolved",
        ),
      );
    }

    if (event.isResolved) {
      return next(createError("Monitoring event is already resolved"));
    }

    event.isResolved = true;
    event.resolvedBy = req.user.userId;
    event.resolvedAt = new Date();

    await event.save();

    await event.populate([
      {
        path: "property",
        select:
          "title propertyType address status occupancy condition health securityLevel",
      },
      {
        path: "owner",
        select: "name email role",
      },
      {
        path: "acknowledgedBy",
        select: "name email role",
      },
      {
        path: "resolvedBy",
        select: "name email role",
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Monitoring event resolved successfully",
      data: {
        event,
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
  createMonitoringEvent,
  getPropertyEvents,
  getMyMonitoringEvents,
  acknowledgeEvent,
  resolveEvent,
};
