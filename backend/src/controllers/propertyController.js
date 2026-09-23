const mongoose = require("mongoose");

const Property = require("../models/Property");
const Inspection = require("../models/Inspection");
const createAuditLog = require("../utils/auditLogger");

// ============================================================
// HELPERS
// ============================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ============================================================
// CREATE PROPERTY
// ============================================================

const createProperty = async (req, res, next) => {
  try {
    const {
      title,
      propertyType,
      address,
      description,
      area,
      structure,
      occupancy,
      condition,
      security,
      imageUrl,
      caretaker,
      nextInspectionAt,
    } = req.body;

    // ----------------------------------------------------------
    // Basic validation
    // ----------------------------------------------------------

    if (!title || !propertyType || !address) {
      return next(
        createError("Title, property type, and address are required", 400),
      );
    }

    if (
      !address.addressLine1 ||
      !address.city ||
      !address.state ||
      !address.country ||
      !address.postalCode
    ) {
      return next(createError("Complete property address is required", 400));
    }

    // ----------------------------------------------------------
    // Validate area
    // ----------------------------------------------------------

    if (area !== undefined && area !== null) {
      if (typeof area !== "object") {
        return next(createError("Area must be an object", 400));
      }

      if (
        area.value !== undefined &&
        (typeof area.value !== "number" || area.value < 0)
      ) {
        return next(
          createError("Area value must be a non-negative number", 400),
        );
      }
    }

    // ----------------------------------------------------------
    // Validate caretaker ID
    // ----------------------------------------------------------

    if (caretaker !== undefined && caretaker !== null) {
      if (!isValidObjectId(caretaker)) {
        return next(createError("Invalid caretaker ID", 400));
      }
    }

    // ----------------------------------------------------------
    // Create property
    // ----------------------------------------------------------

    const property = await Property.create({
      owner: req.user.userId,

      title: title.trim(),

      propertyType,

      address: {
        addressLine1: address.addressLine1.trim(),
        addressLine2: address.addressLine2 ? address.addressLine2.trim() : "",
        city: address.city.trim(),
        state: address.state.trim(),
        country: address.country.trim(),
        postalCode: address.postalCode.trim(),
      },

      description: description ? description.trim() : "",

      area,

      structure,

      occupancy: occupancy || "VACANT",

      condition: condition || "GOOD",

      security,

      imageUrl: imageUrl || null,

      caretaker: caretaker || null,

      nextInspectionAt: nextInspectionAt || null,

      status: "ACTIVE",

      isActive: true,

      health: {
        score: 100,
        lastCalculatedAt: null,
      },
    });

    // ----------------------------------------------------------
    // AUDIT LOG
    // ----------------------------------------------------------

    await createAuditLog({
      req,
      action: "PROPERTY_CREATED",
      resourceType: "PROPERTY",
      resourceId: property._id,
      property: property._id,
      description: `Property "${property.title}" created successfully`,
      newValues: {
        title: property.title,
        propertyType: property.propertyType,
        occupancy: property.occupancy,
        condition: property.condition,
        status: property.status,
        isActive: property.isActive,
      },
    });

    // ----------------------------------------------------------
    // Populate owner and caretaker
    // ----------------------------------------------------------

    await property.populate([
      {
        path: "owner",
        select: "name email role",
      },
      {
        path: "caretaker",
        select: "name email role",
      },
    ]);

    // ----------------------------------------------------------
    // Response
    // ----------------------------------------------------------

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: {
        property,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET MY PROPERTIES
// ============================================================

const getMyProperties = async (req, res, next) => {
  try {
    const properties = await Property.find({
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    })
      .populate("owner", "name email role")
      .populate("caretaker", "name email role")
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      success: true,
      count: properties.length,
      data: {
        properties,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET PROPERTY BY ID
// ============================================================

const getPropertyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return next(createError("Invalid property ID", 400));
    }

    const property = await Property.findOne({
      _id: id,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    })
      .populate("owner", "name email role")
      .populate("caretaker", "name email role");

    if (!property) {
      return next(createError("Property not found", 404));
    }

    res.status(200).json({
      success: true,
      data: {
        property,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// UPDATE PROPERTY
// ============================================================

const updateProperty = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return next(createError("Invalid property ID", 400));
    }

    // ----------------------------------------------------------
    // Find property
    // ----------------------------------------------------------

    const property = await Property.findOne({
      _id: id,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    });

    if (!property) {
      return next(createError("Property not found", 404));
    }

    // ----------------------------------------------------------
    // Store old values for future audit tracking
    // ----------------------------------------------------------

    const oldPropertyValues = {
      title: property.title,
      propertyType: property.propertyType,
      address: property.address ? property.address.toObject() : null,
      description: property.description,
      area: property.area ? property.area.toObject() : null,
      structure: property.structure,
      occupancy: property.occupancy,
      condition: property.condition,
      security: property.security,
      imageUrl: property.imageUrl,
      caretaker: property.caretaker,
      nextInspectionAt: property.nextInspectionAt,
    };

    // ----------------------------------------------------------
    // Allowed fields
    // ----------------------------------------------------------

    const allowedFields = [
      "title",
      "propertyType",
      "address",
      "description",
      "area",
      "structure",
      "occupancy",
      "condition",
      "security",
      "imageUrl",
      "caretaker",
      "nextInspectionAt",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        property[field] = req.body[field];
      }
    }

    // ----------------------------------------------------------
    // Normalize title
    // ----------------------------------------------------------

    if (property.title) {
      property.title = property.title.trim();
    }

    // ----------------------------------------------------------
    // Normalize description
    // ----------------------------------------------------------

    if (property.description) {
      property.description = property.description.trim();
    }

    // ----------------------------------------------------------
    // Normalize address
    // ----------------------------------------------------------

    if (property.address) {
      if (property.address.addressLine1) {
        property.address.addressLine1 = property.address.addressLine1.trim();
      }

      if (property.address.addressLine2) {
        property.address.addressLine2 = property.address.addressLine2.trim();
      }

      if (property.address.city) {
        property.address.city = property.address.city.trim();
      }

      if (property.address.state) {
        property.address.state = property.address.state.trim();
      }

      if (property.address.country) {
        property.address.country = property.address.country.trim();
      }

      if (property.address.postalCode) {
        property.address.postalCode = property.address.postalCode.trim();
      }
    }

    // ----------------------------------------------------------
    // Validate caretaker
    // ----------------------------------------------------------

    if (
      property.caretaker !== null &&
      property.caretaker !== undefined &&
      !isValidObjectId(property.caretaker)
    ) {
      return next(createError("Invalid caretaker ID", 400));
    }

    // ----------------------------------------------------------
    // Validate area
    // ----------------------------------------------------------

    if (
      property.area &&
      property.area.value !== null &&
      property.area.value !== undefined &&
      (typeof property.area.value !== "number" || property.area.value < 0)
    ) {
      return next(createError("Area value must be a non-negative number", 400));
    }

    // ----------------------------------------------------------
    // Property always remains ACTIVE through this endpoint
    // ----------------------------------------------------------

    property.status = "ACTIVE";
    property.isActive = true;

    // ----------------------------------------------------------
    // Validate and save
    // ----------------------------------------------------------

    await property.validate();
    await property.save();

    // ----------------------------------------------------------
    // Populate
    // ----------------------------------------------------------

    await property.populate([
      {
        path: "owner",
        select: "name email role",
      },
      {
        path: "caretaker",
        select: "name email role",
      },
    ]);

    // ----------------------------------------------------------
    // AUDIT LOG
    // ----------------------------------------------------------

    await createAuditLog({
      req,
      action: "PROPERTY_UPDATED",
      resourceType: "PROPERTY",
      resourceId: property._id,
      property: property._id,
      description: `Property "${property.title}" updated successfully`,
      oldValues: oldPropertyValues,
      newValues: {
        title: property.title,
        propertyType: property.propertyType,
        address: property.address ? property.address.toObject() : null,
        description: property.description,
        area: property.area ? property.area.toObject() : null,
        structure: property.structure,
        occupancy: property.occupancy,
        condition: property.condition,
        security: property.security,
        imageUrl: property.imageUrl,
        caretaker: property.caretaker,
        nextInspectionAt: property.nextInspectionAt,
      },
    });

    // ----------------------------------------------------------
    // Response
    // ----------------------------------------------------------

    res.status(200).json({
      success: true,
      message: "Property updated successfully",
      data: {
        property,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ARCHIVE PROPERTY
// ============================================================

const deleteProperty = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return next(createError("Invalid property ID", 400));
    }

    const property = await Property.findOne({
      _id: id,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    });

    if (!property) {
      return next(createError("Property not found", 404));
    }

    // ----------------------------------------------------------
    // Soft archive
    // ----------------------------------------------------------

    property.isActive = false;
    property.status = "ARCHIVED";
    property.caretaker = null;

    await property.save();

    // ----------------------------------------------------------
    // AUDIT LOG
    // ----------------------------------------------------------

    await createAuditLog({
      req,
      action: "PROPERTY_ARCHIVED",
      resourceType: "PROPERTY",
      resourceId: property._id,
      property: property._id,
      description: `Property "${property.title}" archived successfully`,
      oldValues: {
        status: "ACTIVE",
        isActive: true,
      },
      newValues: {
        status: property.status,
        isActive: property.isActive,
      },
    });

    res.status(200).json({
      success: true,
      message: "Property archived successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// RESTORE / REACTIVATE PROPERTY
// ============================================================

const restoreProperty = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return next(createError("Invalid property ID", 400));
    }

    // Find archived property owned by logged-in user
    const property = await Property.findOne({
      _id: id,
      owner: req.user.userId,
      isActive: false,
      status: "ARCHIVED",
    });

    if (!property) {
      return next(
        createError(
          "Archived property not found or you do not have permission to restore it",
          404,
        ),
      );
    }

    // ----------------------------------------------------------
    // Reactivate property
    // ----------------------------------------------------------

    property.isActive = true;
    property.status = "ACTIVE";

    await property.save();

    // ----------------------------------------------------------
    // Populate owner and caretaker
    // ----------------------------------------------------------

    await property.populate([
      {
        path: "owner",
        select: "name email role",
      },
      {
        path: "caretaker",
        select: "name email role",
      },
    ]);

    // ----------------------------------------------------------
    // AUDIT LOG
    // ----------------------------------------------------------

    await createAuditLog({
      req,
      action: "PROPERTY_RESTORED",
      resourceType: "PROPERTY",
      resourceId: property._id,
      property: property._id,
      description: `Property "${property.title}" restored successfully`,
      oldValues: {
        status: "ARCHIVED",
        isActive: false,
      },
      newValues: {
        status: property.status,
        isActive: property.isActive,
      },
    });

    res.status(200).json({
      success: true,
      message: "Property restored successfully",
      data: {
        property,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET PROPERTY INSPECTION HISTORY
// ============================================================

const getPropertyInspectionHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return next(createError("Invalid property ID", 400));
    }

    // ----------------------------------------------------------
    // Verify ownership
    // ----------------------------------------------------------

    const property = await Property.findOne({
      _id: id,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    });

    if (!property) {
      return next(
        createError(
          "Property not found or you do not have permission to view it",
          404,
        ),
      );
    }

    // ----------------------------------------------------------
    // Get inspections
    // ----------------------------------------------------------

    const inspections = await Inspection.find({
      property: id,
    })
      .populate({
        path: "caretaker",
        select: "name email role",
      })
      .sort({
        inspectedAt: -1,
      });

    res.status(200).json({
      success: true,
      count: inspections.length,
      data: {
        property: {
          id: property._id,
          title: property.title,
        },
        inspections,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PROPERTY STATISTICS
// ============================================================

const getPropertyStats = async (req, res, next) => {
  try {
    const ownerId = req.user.userId;

    const stats = await Property.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(ownerId),
          isActive: true,
          status: "ACTIVE",
        },
      },

      {
        $group: {
          _id: null,

          // ----------------------------------------------------
          // Total properties
          // ----------------------------------------------------

          totalProperties: {
            $sum: 1,
          },

          // ----------------------------------------------------
          // Vacant properties
          // ----------------------------------------------------

          vacantProperties: {
            $sum: {
              $cond: [
                {
                  $eq: ["$occupancy", "VACANT"],
                },
                1,
                0,
              ],
            },
          },

          // ----------------------------------------------------
          // Occupied properties
          // ----------------------------------------------------

          occupiedProperties: {
            $sum: {
              $cond: [
                {
                  $eq: ["$occupancy", "OCCUPIED"],
                },
                1,
                0,
              ],
            },
          },

          // ----------------------------------------------------
          // Properties needing attention
          // ----------------------------------------------------

          propertiesNeedingAttention: {
            $sum: {
              $cond: [
                {
                  $in: ["$condition", ["NEEDS_ATTENTION", "CRITICAL"]],
                },
                1,
                0,
              ],
            },
          },

          // ----------------------------------------------------
          // Critical properties
          // ----------------------------------------------------

          criticalProperties: {
            $sum: {
              $cond: [
                {
                  $eq: ["$condition", "CRITICAL"],
                },
                1,
                0,
              ],
            },
          },

          // ----------------------------------------------------
          // Properties with caretaker
          // ----------------------------------------------------

          assignedCaretakerProperties: {
            $sum: {
              $cond: [
                {
                  $ne: ["$caretaker", null],
                },
                1,
                0,
              ],
            },
          },

          // ----------------------------------------------------
          // Average health score
          // ----------------------------------------------------

          averageHealthScore: {
            $avg: "$health.score",
          },
        },
      },

      {
        $project: {
          _id: 0,
          totalProperties: 1,
          vacantProperties: 1,
          occupiedProperties: 1,
          propertiesNeedingAttention: 1,
          criticalProperties: 1,
          assignedCaretakerProperties: 1,
          averageHealthScore: {
            $round: ["$averageHealthScore", 2],
          },
        },
      },
    ]);

    // ----------------------------------------------------------
    // Default statistics
    // ----------------------------------------------------------

    const result = stats[0] || {
      totalProperties: 0,
      vacantProperties: 0,
      occupiedProperties: 0,
      propertiesNeedingAttention: 0,
      criticalProperties: 0,
      assignedCaretakerProperties: 0,
      averageHealthScore: 0,
    };

    // ----------------------------------------------------------
    // Response
    // ----------------------------------------------------------

    res.status(200).json({
      success: true,
      data: {
        stats: result,
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
  createProperty,
  getMyProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  restoreProperty,
  getPropertyInspectionHistory,
  getPropertyStats,
};
