const mongoose = require("mongoose");

const Inspection = require("../models/Inspection");
const CaretakerAssignment = require("../models/CaretakerAssignment");
const Property = require("../models/Property");

// ============================================================
// HELPERS
// ============================================================

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const normalizeStringArray = (value, fieldName, maxLength) => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw createError(`${fieldName} must be an array`, 400);
  }

  const cleaned = value.map((item) => {
    if (typeof item !== "string") {
      throw createError(`Each ${fieldName} item must be a string`, 400);
    }

    const trimmed = item.trim();

    if (!trimmed || trimmed.length > maxLength) {
      throw createError(
        `Each ${fieldName} item must be between 1 and ${maxLength} characters`,
        400,
      );
    }

    return trimmed;
  });

  return cleaned;
};

// ============================================================
// CALCULATE PROPERTY HEALTH
// ============================================================

const calculateHealthScore = ({
  overallCondition,
  securityStatus,
  electricalStatus,
  plumbingStatus,
  cleanliness,
}) => {
  const conditionScores = {
    EXCELLENT: 100,
    GOOD: 85,
    FAIR: 65,
    POOR: 40,
    CRITICAL: 15,
  };

  const securityScores = {
    NORMAL: 100,
    WARNING: 55,
    CRITICAL: 15,
  };

  const systemScores = {
    NORMAL: 100,
    WARNING: 60,
    CRITICAL: 20,
    NOT_CHECKED: 75,
  };

  const cleanlinessScores = {
    EXCELLENT: 100,
    GOOD: 85,
    FAIR: 65,
    POOR: 40,
  };

  const score =
    conditionScores[overallCondition] * 0.4 +
    securityScores[securityStatus] * 0.2 +
    systemScores[electricalStatus] * 0.15 +
    systemScores[plumbingStatus] * 0.15 +
    cleanlinessScores[cleanliness] * 0.1;

  return Math.round(score);
};

// ============================================================
// MAP INSPECTION CONDITION → PROPERTY CONDITION
// ============================================================

const mapPropertyCondition = (overallCondition) => {
  const mapping = {
    EXCELLENT: "GOOD",
    GOOD: "GOOD",
    FAIR: "FAIR",
    POOR: "NEEDS_ATTENTION",
    CRITICAL: "CRITICAL",
  };

  return mapping[overallCondition];
};

// ============================================================
// CREATE INSPECTION
// ============================================================

const createInspection = async (req, res, next) => {
  try {
    const {
      propertyId,
      overallCondition,
      securityStatus,
      electricalStatus,
      plumbingStatus,
      cleanliness,
      issuesFound,
      notes,
      images,
      inspectedAt,
    } = req.body;

    // --------------------------------------------------------
    // Validate property ID
    // --------------------------------------------------------

    if (!propertyId) {
      return next(createError("Property ID is required", 400));
    }

    if (!isValidObjectId(propertyId)) {
      return next(createError("Invalid property ID", 400));
    }

    // --------------------------------------------------------
    // Required fields
    // --------------------------------------------------------

    if (!overallCondition) {
      return next(createError("Overall condition is required", 400));
    }

    if (!securityStatus) {
      return next(createError("Security status is required", 400));
    }

    // --------------------------------------------------------
    // Validate arrays
    // --------------------------------------------------------

    let cleanIssues = [];
    let cleanImages = [];

    try {
      cleanIssues = normalizeStringArray(issuesFound, "issuesFound", 500);

      cleanImages = normalizeStringArray(images, "images", 2000);
    } catch (error) {
      return next(error);
    }

    // --------------------------------------------------------
    // Validate notes
    // --------------------------------------------------------

    let cleanNotes = "";

    if (notes !== undefined) {
      if (typeof notes !== "string") {
        return next(createError("Notes must be a string", 400));
      }

      cleanNotes = notes.trim();

      if (cleanNotes.length > 2000) {
        return next(
          createError("Inspection notes cannot exceed 2000 characters", 400),
        );
      }
    }

    // --------------------------------------------------------
    // Validate inspection date
    // --------------------------------------------------------

    let inspectionDate = new Date();

    if (inspectedAt !== undefined) {
      inspectionDate = new Date(inspectedAt);

      if (Number.isNaN(inspectionDate.getTime())) {
        return next(createError("Invalid inspection date", 400));
      }

      if (inspectionDate > new Date()) {
        return next(
          createError("Inspection date cannot be in the future", 400),
        );
      }
    }

    // --------------------------------------------------------
    // Verify property
    // --------------------------------------------------------

    const property = await Property.findOne({
      _id: propertyId,
      isActive: true,
      status: "ACTIVE",
    });

    if (!property) {
      return next(
        createError("Property not found or is no longer active", 404),
      );
    }

    // --------------------------------------------------------
    // Verify active caretaker assignment
    // --------------------------------------------------------

    const assignment = await CaretakerAssignment.findOne({
      property: propertyId,
      caretaker: req.user.userId,
      status: "ACTIVE",
    });

    if (!assignment) {
      return next(
        createError("You are not actively assigned to this property", 403),
      );
    }

    // --------------------------------------------------------
    // Calculate health
    // --------------------------------------------------------

    const healthScore = calculateHealthScore({
      overallCondition,
      securityStatus,
      electricalStatus: electricalStatus || "NOT_CHECKED",
      plumbingStatus: plumbingStatus || "NOT_CHECKED",
      cleanliness: cleanliness || "GOOD",
    });

    const propertyCondition = mapPropertyCondition(overallCondition);

    // --------------------------------------------------------
    // Create inspection
    // --------------------------------------------------------

    const inspection = await Inspection.create({
      property: property._id,
      caretaker: req.user.userId,
      overallCondition,
      securityStatus,
      electricalStatus: electricalStatus || "NOT_CHECKED",
      plumbingStatus: plumbingStatus || "NOT_CHECKED",
      cleanliness: cleanliness || "GOOD",
      issuesFound: cleanIssues,
      notes: cleanNotes,
      images: cleanImages,
      inspectedAt: inspectionDate,
      status: "COMPLETED",
    });

    // --------------------------------------------------------
    // Synchronize Property
    // --------------------------------------------------------

    property.condition = propertyCondition;

    property.health = {
      score: healthScore,
      lastCalculatedAt: new Date(),
    };

    property.lastInspectionAt = inspectionDate;

    await property.save();

    // --------------------------------------------------------
    // Populate response
    // --------------------------------------------------------

    await inspection.populate([
      {
        path: "property",
        select:
          "title propertyType address status occupancy condition health lastInspectionAt nextInspectionAt",
      },
      {
        path: "caretaker",
        select: "name email role isActive",
      },
    ]);

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Inspection created successfully",
      data: {
        inspection,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET MY INSPECTIONS
// ============================================================

const getMyInspections = async (req, res, next) => {
  try {
    const inspections = await Inspection.find({
      caretaker: req.user.userId,
    })
      .populate({
        path: "property",
        select:
          "title propertyType address status occupancy condition health lastInspectionAt nextInspectionAt",
      })
      .sort({
        inspectedAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: inspections.length,
      data: {
        inspections,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET PROPERTY INSPECTIONS
// ============================================================

const getPropertyInspections = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      return next(createError("Invalid property ID", 400));
    }

    // --------------------------------------------------------
    // Verify active caretaker assignment
    // --------------------------------------------------------

    const assignment = await CaretakerAssignment.findOne({
      property: propertyId,
      caretaker: req.user.userId,
      status: "ACTIVE",
    });

    if (!assignment) {
      return next(
        createError("You are not actively assigned to this property", 403),
      );
    }

    // --------------------------------------------------------
    // Verify property
    // --------------------------------------------------------

    const property = await Property.findOne({
      _id: propertyId,
      isActive: true,
      status: "ACTIVE",
    }).select("title propertyType address occupancy condition health");

    if (!property) {
      return next(createError("Property not found or inactive", 404));
    }

    // --------------------------------------------------------
    // Get inspections
    // --------------------------------------------------------

    const inspections = await Inspection.find({
      property: propertyId,
    })
      .populate({
        path: "caretaker",
        select: "name email role",
      })
      .sort({
        inspectedAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: inspections.length,
      data: {
        property,
        inspections,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET SINGLE INSPECTION
// ============================================================

const getInspectionById = async (req, res, next) => {
  try {
    const { inspectionId } = req.params;

    if (!isValidObjectId(inspectionId)) {
      return next(createError("Invalid inspection ID", 400));
    }

    const inspection = await Inspection.findOne({
      _id: inspectionId,
      caretaker: req.user.userId,
    })
      .populate({
        path: "property",
        select:
          "title propertyType address status occupancy condition health lastInspectionAt nextInspectionAt",
      })
      .populate({
        path: "caretaker",
        select: "name email role",
      });

    if (!inspection) {
      return next(createError("Inspection not found", 404));
    }

    return res.status(200).json({
      success: true,
      data: {
        inspection,
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
  createInspection,
  getMyInspections,
  getPropertyInspections,
  getInspectionById,
};
