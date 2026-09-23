const mongoose = require("mongoose");

const User = require("../models/User");
const Property = require("../models/Property");
const CaretakerAssignment = require("../models/CaretakerAssignment");
const { hashPassword } = require("../utils/password");
const createAuditLog = require("../utils/auditLogger");

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

const normalizeResponsibilities = (responsibilities) => {
  if (responsibilities === undefined) {
    return [];
  }

  if (!Array.isArray(responsibilities)) {
    throw createError("Responsibilities must be provided as an array", 400);
  }

  const cleaned = responsibilities.map((item) => {
    if (typeof item !== "string") {
      return null;
    }

    const trimmed = item.trim();

    if (!trimmed || trimmed.length > 200) {
      return null;
    }

    return trimmed;
  });

  if (cleaned.includes(null)) {
    throw createError(
      "Each responsibility must be a non-empty string of maximum 200 characters",
      400,
    );
  }

  return cleaned;
};

const normalizeNotes = (notes) => {
  if (notes === undefined) {
    return "";
  }

  if (typeof notes !== "string") {
    throw createError("Notes must be a string", 400);
  }

  const cleaned = notes.trim();

  if (cleaned.length > 1000) {
    throw createError("Notes cannot exceed 1000 characters", 400);
  }

  return cleaned;
};

const parseStartDate = (startDate) => {
  if (startDate === undefined) {
    return new Date();
  }

  const parsed = new Date(startDate);

  if (Number.isNaN(parsed.getTime())) {
    throw createError("Invalid start date", 400);
  }

  return parsed;
};

// ============================================================
// CREATE CARETAKER
// POST /api/caretakers/create
// ============================================================

const createCaretaker = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    // --------------------------------------------------------
    // Required fields
    // --------------------------------------------------------

    if (!name || !email || !password) {
      return next(createError("Name, email and password are required", 400));
    }

    // --------------------------------------------------------
    // Normalize input
    // --------------------------------------------------------

    if (typeof name !== "string") {
      return next(createError("Name must be a string", 400));
    }

    if (typeof email !== "string") {
      return next(createError("Email must be a string", 400));
    }

    if (typeof password !== "string") {
      return next(createError("Password must be a string", 400));
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // --------------------------------------------------------
    // Validate name
    // --------------------------------------------------------

    if (trimmedName.length < 2) {
      return next(createError("Name must be at least 2 characters", 400));
    }

    if (trimmedName.length > 100) {
      return next(createError("Name cannot exceed 100 characters", 400));
    }

    // --------------------------------------------------------
    // Validate email
    // --------------------------------------------------------

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return next(createError("Please provide a valid email address", 400));
    }

    // --------------------------------------------------------
    // Validate password
    // --------------------------------------------------------

    if (password.length < 8) {
      return next(createError("Password must be at least 8 characters", 400));
    }

    // --------------------------------------------------------
    // Validate phone if provided
    // --------------------------------------------------------

    let cleanPhone = null;

    if (phone !== undefined && phone !== null) {
      if (typeof phone !== "string") {
        return next(createError("Phone must be a string", 400));
      }

      cleanPhone = phone.trim();

      if (cleanPhone.length > 20) {
        return next(
          createError("Phone number cannot exceed 20 characters", 400),
        );
      }
    }

    // --------------------------------------------------------
    // Check duplicate email
    // --------------------------------------------------------

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return next(createError("A user with this email already exists", 409));
    }

    // --------------------------------------------------------
    // Hash password
    // --------------------------------------------------------

    const hashedPassword = await hashPassword(password);

    // --------------------------------------------------------
    // Create caretaker
    // --------------------------------------------------------

    const caretaker = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: "CARETAKER",
      isActive: true,
      isEmailVerified: false,
      phone: cleanPhone,
    });

    // --------------------------------------------------------
    // AUDIT LOG
    // --------------------------------------------------------

    await createAuditLog({
      req,
      action: "CARETAKER_CREATED",
      resourceType: "USER",
      resourceId: caretaker._id,
      description: `Caretaker "${caretaker.name}" created successfully`,
      newValues: {
        name: caretaker.name,
        email: caretaker.email,
        role: caretaker.role,
        isActive: caretaker.isActive,
        isEmailVerified: caretaker.isEmailVerified,
        phone: caretaker.phone,
      },
    });

    // --------------------------------------------------------
    // Safe response
    // Never return password
    // --------------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Caretaker created successfully",
      data: {
        caretaker: {
          id: caretaker._id,
          name: caretaker.name,
          email: caretaker.email,
          role: caretaker.role,
          isActive: caretaker.isActive,
          isEmailVerified: caretaker.isEmailVerified,
          phone: caretaker.phone,
          createdAt: caretaker.createdAt,
        },
      },
    });
  } catch (error) {
    // MongoDB duplicate-key protection
    if (error.code === 11000) {
      return next(createError("A user with this email already exists", 409));
    }

    next(error);
  }
};

// ============================================================
// ASSIGN CARETAKER
// POST /api/caretakers/assign
// ============================================================

const assignCaretaker = async (req, res, next) => {
  try {
    const { propertyId, caretakerId, startDate, responsibilities, notes } =
      req.body;

    // --------------------------------------------------------
    // Required fields
    // --------------------------------------------------------

    if (!propertyId || !caretakerId) {
      return next(
        createError("Property ID and caretaker ID are required", 400),
      );
    }

    // --------------------------------------------------------
    // Validate IDs
    // --------------------------------------------------------

    if (!isValidObjectId(propertyId) || !isValidObjectId(caretakerId)) {
      return next(createError("Invalid property ID or caretaker ID", 400));
    }

    // --------------------------------------------------------
    // Normalize input
    // --------------------------------------------------------

    const cleanResponsibilities = normalizeResponsibilities(responsibilities);

    const cleanNotes = normalizeNotes(notes);

    const assignmentStartDate = parseStartDate(startDate);

    // --------------------------------------------------------
    // Verify property ownership
    // --------------------------------------------------------

    const property = await Property.findOne({
      _id: propertyId,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    });

    if (!property) {
      return next(
        createError(
          "Property not found or you do not have permission to manage it",
          404,
        ),
      );
    }

    // --------------------------------------------------------
    // Verify caretaker
    // --------------------------------------------------------

    const caretaker = await User.findOne({
      _id: caretakerId,
      role: "CARETAKER",
      isActive: true,
    });

    if (!caretaker) {
      return next(
        createError("Active caretaker with the provided ID was not found", 404),
      );
    }

    // --------------------------------------------------------
    // Prevent assigning same caretaker twice
    // --------------------------------------------------------

    const existingAssignment = await CaretakerAssignment.findOne({
      property: property._id,
      status: "ACTIVE",
    }).populate("caretaker", "name email role isActive");

    if (existingAssignment) {
      if (
        existingAssignment.caretaker &&
        existingAssignment.caretaker._id.toString() === caretakerId.toString()
      ) {
        return next(
          createError(
            "This caretaker is already actively assigned to this property",
            409,
          ),
        );
      }

      const currentCaretaker =
        existingAssignment.caretaker?.name || "another caretaker";

      return next(
        createError(
          `Another caretaker (${currentCaretaker}) is already actively assigned to this property`,
          409,
        ),
      );
    }

    // --------------------------------------------------------
    // Create assignment
    // --------------------------------------------------------

    const assignment = await CaretakerAssignment.create({
      property: property._id,
      caretaker: caretaker._id,
      assignedBy: req.user.userId,
      assignedAt: new Date(),
      startDate: assignmentStartDate,
      status: "ACTIVE",
      responsibilities: cleanResponsibilities,
      notes: cleanNotes,
    });

    // --------------------------------------------------------
    // Synchronize Property
    // --------------------------------------------------------

    property.caretaker = caretaker._id;

    await property.save();

    // --------------------------------------------------------
    // AUDIT LOG
    // --------------------------------------------------------

    await createAuditLog({
      req,
      action: "CARETAKER_ASSIGNED",
      resourceType: "CARETAKER_ASSIGNMENT",
      resourceId: assignment._id,
      property: property._id,
      description: `Caretaker "${caretaker.name}" assigned to property "${property.title}"`,
      newValues: {
        caretaker: caretaker._id,
        property: property._id,
        assignedBy: req.user.userId,
        assignedAt: assignment.assignedAt,
        startDate: assignment.startDate,
        status: assignment.status,
        responsibilities: assignment.responsibilities,
        notes: assignment.notes,
      },
    });

    // --------------------------------------------------------
    // Populate response
    // --------------------------------------------------------

    await assignment.populate([
      {
        path: "caretaker",
        select: "name email role isActive",
      },
      {
        path: "property",
        select:
          "title propertyType address description area structure occupancy condition security health lastInspectionAt nextInspectionAt lastMaintenanceAt imageUrl isActive status caretaker",
      },
      {
        path: "assignedBy",
        select: "name email role",
      },
    ]);

    return res.status(201).json({
      success: true,
      message: "Caretaker assigned successfully",
      data: {
        assignment,
      },
    });
  } catch (error) {
    // MongoDB duplicate key
    if (error.code === 11000) {
      return next(
        createError(
          "An active caretaker assignment already exists for this property",
          409,
        ),
      );
    }

    next(error);
  }
};

// ============================================================
// GET ALL ASSIGNMENTS FOR PROPERTY
// GET /api/caretakers/property/:propertyId
// ============================================================

const getPropertyCaretakers = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    // --------------------------------------------------------
    // Validate ID
    // --------------------------------------------------------

    if (!isValidObjectId(propertyId)) {
      return next(createError("Invalid property ID", 400));
    }

    // --------------------------------------------------------
    // Verify ownership
    // --------------------------------------------------------

    const property = await Property.findOne({
      _id: propertyId,
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

    // --------------------------------------------------------
    // Get history
    // --------------------------------------------------------

    const assignments = await CaretakerAssignment.find({
      property: propertyId,
    })
      .populate("caretaker", "name email role isActive")
      .populate("assignedBy", "name email role")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: assignments.length,
      data: {
        property: {
          id: property._id,
          title: property.title,
          caretaker: property.caretaker,
        },
        assignments,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET CURRENT CARETAKER
// GET /api/caretakers/property/:propertyId/current
// ============================================================

const getCurrentCaretaker = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      return next(createError("Invalid property ID", 400));
    }

    // --------------------------------------------------------
    // Verify property ownership
    // --------------------------------------------------------

    const property = await Property.findOne({
      _id: propertyId,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    });

    if (!property) {
      return next(createError("Property not found", 404));
    }

    // --------------------------------------------------------
    // Find active assignment
    // --------------------------------------------------------

    const assignment = await CaretakerAssignment.findOne({
      property: propertyId,
      status: "ACTIVE",
    })
      .populate("caretaker", "name email role isActive")
      .populate("assignedBy", "name email role");

    if (!assignment) {
      return res.status(200).json({
        success: true,
        message: "No active caretaker assigned to this property",
        data: {
          assignment: null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        assignment,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET MY ASSIGNED PROPERTIES
// GET /api/caretakers/my-properties
// ============================================================

const getMyAssignedProperties = async (req, res, next) => {
  try {
    const assignments = await CaretakerAssignment.find({
      caretaker: req.user.userId,
      status: "ACTIVE",
    })
      .populate({
        path: "property",
        match: {
          isActive: true,
          status: "ACTIVE",
        },
        select:
          "title propertyType address description area structure occupancy condition security health lastInspectionAt nextInspectionAt lastMaintenanceAt imageUrl isActive status caretaker",
      })
      .populate({
        path: "assignedBy",
        select: "name email role",
      })
      .sort({
        createdAt: -1,
      });

    const activeAssignments = assignments.filter(
      (assignment) => assignment.property,
    );

    return res.status(200).json({
      success: true,
      count: activeAssignments.length,
      data: {
        assignments: activeAssignments,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET ONE ASSIGNED PROPERTY
// GET /api/caretakers/my-properties/:propertyId
// ============================================================

const getAssignedPropertyDetails = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      return next(createError("Invalid property ID", 400));
    }

    // --------------------------------------------------------
    // Verify active assignment
    // --------------------------------------------------------

    const assignment = await CaretakerAssignment.findOne({
      property: propertyId,
      caretaker: req.user.userId,
      status: "ACTIVE",
    })
      .populate({
        path: "property",
        match: {
          isActive: true,
          status: "ACTIVE",
        },
        select:
          "title propertyType address description area structure occupancy condition security health lastInspectionAt nextInspectionAt lastMaintenanceAt imageUrl isActive status caretaker",
      })
      .populate({
        path: "assignedBy",
        select: "name email role",
      });

    if (!assignment) {
      return next(
        createError("You are not actively assigned to this property", 403),
      );
    }

    if (!assignment.property) {
      return next(createError("Property is no longer active", 404));
    }

    return res.status(200).json({
      success: true,
      data: {
        property: assignment.property,
        assignment: {
          id: assignment._id,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          status: assignment.status,
          responsibilities: assignment.responsibilities,
          notes: assignment.notes,
          assignedAt: assignment.assignedAt,
          assignedBy: assignment.assignedBy,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// END CARETAKER ASSIGNMENT
// PUT /api/caretakers/property/:propertyId/end
// ============================================================

const endCaretakerAssignment = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    // --------------------------------------------------------
    // Validate ID
    // --------------------------------------------------------

    if (!isValidObjectId(propertyId)) {
      return next(createError("Invalid property ID", 400));
    }

    // --------------------------------------------------------
    // Verify property ownership
    // --------------------------------------------------------

    const property = await Property.findOne({
      _id: propertyId,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    });

    if (!property) {
      return next(
        createError(
          "Property not found or you do not have permission to manage it",
          404,
        ),
      );
    }

    // --------------------------------------------------------
    // Find active assignment
    // --------------------------------------------------------

    const assignment = await CaretakerAssignment.findOne({
      property: propertyId,
      status: "ACTIVE",
    });

    if (!assignment) {
      return next(
        createError(
          "No active caretaker assignment found for this property",
          404,
        ),
      );
    }

    // --------------------------------------------------------
    // Capture old values BEFORE modifying assignment
    // --------------------------------------------------------

    const oldValues = {
      status: assignment.status,
      caretaker: assignment.caretaker,
      property: assignment.property,
      assignedBy: assignment.assignedBy,
      assignedAt: assignment.assignedAt,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      responsibilities: assignment.responsibilities,
      notes: assignment.notes,
    };

    // --------------------------------------------------------
    // Complete assignment
    // --------------------------------------------------------

    const endDate = new Date();

    assignment.status = "COMPLETED";
    assignment.endDate = endDate;

    await assignment.save();

    // --------------------------------------------------------
    // Synchronize property
    // --------------------------------------------------------

    property.caretaker = null;

    await property.save();

    // --------------------------------------------------------
    // AUDIT LOG
    // --------------------------------------------------------

    await createAuditLog({
      req,
      action: "CARETAKER_ASSIGNMENT_ENDED",
      resourceType: "CARETAKER_ASSIGNMENT",
      resourceId: assignment._id,
      property: property._id,
      description: `Caretaker assignment for property "${property.title}" ended successfully`,
      oldValues,
      newValues: {
        status: assignment.status,
        caretaker: assignment.caretaker,
        property: assignment.property,
        assignedBy: assignment.assignedBy,
        assignedAt: assignment.assignedAt,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        responsibilities: assignment.responsibilities,
        notes: assignment.notes,
        propertyCaretaker: property.caretaker,
      },
    });

    // --------------------------------------------------------
    // Populate response
    // --------------------------------------------------------

    await assignment.populate([
      {
        path: "caretaker",
        select: "name email role isActive",
      },
      {
        path: "property",
        select: "title propertyType address status caretaker",
      },
      {
        path: "assignedBy",
        select: "name email role",
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Caretaker assignment ended successfully",
      data: {
        assignment,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET CARETAKER ASSIGNMENT HISTORY
// GET /api/caretakers/:caretakerId/history
// ============================================================

const getCaretakerAssignmentHistory = async (req, res, next) => {
  try {
    const { caretakerId } = req.params;

    // --------------------------------------------------------
    // Validate ID
    // --------------------------------------------------------

    if (!isValidObjectId(caretakerId)) {
      return next(createError("Invalid caretaker ID", 400));
    }

    // --------------------------------------------------------
    // Verify caretaker
    // --------------------------------------------------------

    const caretaker = await User.findOne({
      _id: caretakerId,
      role: "CARETAKER",
    }).select("name email role isActive");

    if (!caretaker) {
      return next(createError("Caretaker not found", 404));
    }

    // --------------------------------------------------------
    // Get assignments belonging ONLY to
    // properties owned by current user.
    // --------------------------------------------------------

    const assignments = await CaretakerAssignment.find({
      caretaker: caretakerId,
    })
      .populate({
        path: "property",
        match: {
          owner: req.user.userId,
          isActive: true,
          status: "ACTIVE",
        },
        select:
          "title propertyType address status occupancy condition caretaker isActive",
      })
      .populate({
        path: "assignedBy",
        select: "name email role",
      })
      .sort({
        createdAt: -1,
      });

    const filteredAssignments = assignments.filter(
      (assignment) => assignment.property,
    );

    return res.status(200).json({
      success: true,
      count: filteredAssignments.length,
      data: {
        caretaker: {
          id: caretaker._id,
          name: caretaker.name,
          email: caretaker.email,
          role: caretaker.role,
          isActive: caretaker.isActive,
        },
        assignments: filteredAssignments,
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
  createCaretaker,
  assignCaretaker,
  getPropertyCaretakers,
  getCurrentCaretaker,
  getMyAssignedProperties,
  getAssignedPropertyDetails,
  endCaretakerAssignment,
  getCaretakerAssignmentHistory,
};
