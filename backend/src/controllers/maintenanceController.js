const mongoose = require("mongoose");

const Property = require("../models/Property");
const Inspection = require("../models/Inspection");
const CaretakerAssignment = require("../models/CaretakerAssignment");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const Vendor = require("../models/Vendor");

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

const validateNonNegativeNumber = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw createError(`${fieldName} must be a valid non-negative number`);
  }

  return number;
};

const validateImages = (images) => {
  if (images === undefined) {
    return [];
  }

  if (!Array.isArray(images)) {
    throw createError("Images must be an array");
  }

  for (const image of images) {
    if (
      typeof image !== "string" ||
      image.trim().length === 0 ||
      image.trim().length > 2000
    ) {
      throw createError(
        "Each maintenance image must be a non-empty string of maximum 2000 characters",
      );
    }
  }

  return images.map((image) => image.trim());
};

// ============================================================
// VALIDATE VENDOR
// ============================================================

const validateVendorForOwner = async (
  vendorId,
  ownerId,
  maintenanceCategory,
) => {
  if (!vendorId) {
    return null;
  }

  if (!isValidObjectId(vendorId)) {
    throw createError("Invalid vendor ID");
  }

  const vendor = await Vendor.findOne({
    _id: vendorId,
    owner: ownerId,
    isActive: true,
    status: "ACTIVE",
  });

  if (!vendor) {
    throw createError(
      "Vendor not found, inactive, or you do not have permission to use this vendor",
      404,
    );
  }

  // Vendor categories that map directly to maintenance categories.
  // OTHER vendor can be used for any maintenance category.
  const categoryCompatible =
    vendor.category === "OTHER" ||
    vendor.category === maintenanceCategory ||
    (vendor.category === "CONSTRUCTION" &&
      maintenanceCategory === "STRUCTURAL");

  if (!categoryCompatible) {
    throw createError(
      `Vendor category ${vendor.category} is not compatible with ${maintenanceCategory} maintenance`,
      400,
    );
  }

  return vendor;
};

// ============================================================
// POPULATE MAINTENANCE REQUEST
// ============================================================

const populateMaintenanceRequest = async (request) => {
  await request.populate([
    {
      path: "property",
      select: "title propertyType address status occupancy condition health",
    },
    {
      path: "reportedBy",
      select: "name email role",
    },
    {
      path: "assignedCaretaker",
      select: "name email role isActive",
    },
    {
      path: "assignedVendor",
      select:
        "name companyName category phone email status rating totalJobs completedJobs",
    },
    {
      path: "inspection",
      select:
        "overallCondition securityStatus electricalStatus plumbingStatus cleanliness status inspectedAt",
    },
  ]);

  return request;
};

// ============================================================
// CREATE MAINTENANCE REQUEST
// ============================================================

const createMaintenanceRequest = async (req, res, next) => {
  try {
    const {
      propertyId,
      inspectionId,
      vendorId,
      title,
      description,
      category,
      priority,
      estimatedCost,
      images,
      notes,
    } = req.body;

    if (!propertyId) {
      return next(createError("Property ID is required"));
    }

    if (!isValidObjectId(propertyId)) {
      return next(createError("Invalid property ID"));
    }

    if (!title || !description || !category) {
      return next(createError("Title, description, and category are required"));
    }

    if (typeof title !== "string" || title.trim().length < 3) {
      return next(createError("Title must be at least 3 characters"));
    }

    if (title.trim().length > 150) {
      return next(createError("Title cannot exceed 150 characters"));
    }

    if (typeof description !== "string" || description.trim().length < 5) {
      return next(createError("Description must be at least 5 characters"));
    }

    if (description.trim().length > 2000) {
      return next(createError("Description cannot exceed 2000 characters"));
    }

    // --------------------------------------------------------
    // Property ownership validation
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
    // Optional inspection validation
    // --------------------------------------------------------

    let inspection = null;

    if (inspectionId) {
      if (!isValidObjectId(inspectionId)) {
        return next(createError("Invalid inspection ID"));
      }

      inspection = await Inspection.findOne({
        _id: inspectionId,
        property: propertyId,
      });

      if (!inspection) {
        return next(createError("Inspection not found for this property", 404));
      }
    }

    // --------------------------------------------------------
    // Find currently assigned caretaker
    // --------------------------------------------------------

    const assignment = await CaretakerAssignment.findOne({
      property: propertyId,
      status: "ACTIVE",
    }).populate("caretaker", "name email role isActive");

    let assignedCaretaker = null;

    if (
      assignment &&
      assignment.caretaker &&
      assignment.caretaker.role === "CARETAKER" &&
      assignment.caretaker.isActive
    ) {
      assignedCaretaker = assignment.caretaker._id;
    }

    // --------------------------------------------------------
    // Validate vendor
    // --------------------------------------------------------

    const vendor = await validateVendorForOwner(
      vendorId,
      req.user.userId,
      category,
    );

    // --------------------------------------------------------
    // Validate costs/images/notes
    // --------------------------------------------------------

    const safeEstimatedCost = validateNonNegativeNumber(
      estimatedCost,
      "Estimated cost",
    );

    const safeImages = validateImages(images);

    if (notes !== undefined && typeof notes !== "string") {
      return next(createError("Notes must be a string"));
    }

    if (notes && notes.trim().length > 2000) {
      return next(createError("Notes cannot exceed 2000 characters"));
    }

    // --------------------------------------------------------
    // Create request
    // --------------------------------------------------------

    const maintenanceRequest = await MaintenanceRequest.create({
      property: propertyId,
      reportedBy: req.user.userId,
      assignedCaretaker,
      assignedVendor: vendor ? vendor._id : null,

      inspection: inspection ? inspection._id : null,

      title: title.trim(),
      description: description.trim(),

      category,
      priority: priority || "MEDIUM",

      status: assignedCaretaker ? "ASSIGNED" : "OPEN",

      estimatedCost: safeEstimatedCost,
      actualCost: 0,

      images: safeImages,
      notes: notes ? notes.trim() : "",

      assignedAt: assignedCaretaker ? new Date() : null,

      vendorAssignedAt: vendor ? new Date() : null,
    });

    // --------------------------------------------------------
    // Update vendor job count
    // --------------------------------------------------------

    if (vendor) {
      await Vendor.updateOne(
        { _id: vendor._id },
        {
          $inc: {
            totalJobs: 1,
          },
        },
      );
    }

    await populateMaintenanceRequest(maintenanceRequest);

    return res.status(201).json({
      success: true,
      message: "Maintenance request created successfully",
      data: {
        maintenanceRequest,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET OWNER MAINTENANCE REQUESTS
// ============================================================

const getOwnerMaintenanceRequests = async (req, res, next) => {
  try {
    const requests = await MaintenanceRequest.find({
      reportedBy: req.user.userId,
    })
      .populate(
        "property",
        "title propertyType address status occupancy condition health",
      )
      .populate("assignedCaretaker", "name email role isActive")
      .populate(
        "assignedVendor",
        "name companyName category phone email status rating totalJobs completedJobs",
      )
      .populate(
        "inspection",
        "overallCondition securityStatus electricalStatus plumbingStatus cleanliness status inspectedAt",
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: {
        maintenanceRequests: requests,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET PROPERTY MAINTENANCE REQUESTS
// ============================================================

const getPropertyMaintenanceRequests = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      return next(createError("Invalid property ID"));
    }

    const property = await Property.findOne({
      _id: propertyId,
      owner: req.user.userId,
      isActive: true,
    });

    if (!property) {
      return next(
        createError(
          "Property not found or you do not have permission to view it",
          404,
        ),
      );
    }

    const requests = await MaintenanceRequest.find({
      property: propertyId,
    })
      .populate("reportedBy", "name email role")
      .populate("assignedCaretaker", "name email role isActive")
      .populate(
        "assignedVendor",
        "name companyName category phone email status rating totalJobs completedJobs",
      )
      .populate(
        "inspection",
        "overallCondition securityStatus electricalStatus plumbingStatus cleanliness status inspectedAt",
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: {
        maintenanceRequests: requests,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET CARETAKER MAINTENANCE REQUESTS
// ============================================================

const getCaretakerMaintenanceRequests = async (req, res, next) => {
  try {
    const requests = await MaintenanceRequest.find({
      assignedCaretaker: req.user.userId,
    })
      .populate(
        "property",
        "title propertyType address status occupancy condition health",
      )
      .populate("reportedBy", "name email role")
      .populate(
        "assignedVendor",
        "name companyName category phone email status rating totalJobs completedJobs",
      )
      .populate(
        "inspection",
        "overallCondition securityStatus electricalStatus plumbingStatus cleanliness status inspectedAt",
      )
      .sort({
        priority: -1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: {
        maintenanceRequests: requests,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ASSIGN / CHANGE VENDOR
// ============================================================

const assignVendorToMaintenance = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { vendorId } = req.body;

    if (!isValidObjectId(requestId)) {
      return next(createError("Invalid maintenance request ID"));
    }

    if (!vendorId) {
      return next(createError("Vendor ID is required"));
    }

    if (!isValidObjectId(vendorId)) {
      return next(createError("Invalid vendor ID"));
    }

    // --------------------------------------------------------
    // Find owner's maintenance request
    // --------------------------------------------------------

    const request = await MaintenanceRequest.findOne({
      _id: requestId,
      reportedBy: req.user.userId,
    });

    if (!request) {
      return next(
        createError("Maintenance request not found or access denied", 404),
      );
    }

    // --------------------------------------------------------
    // Completed/cancelled requests cannot be reassigned
    // --------------------------------------------------------

    if (request.status === "COMPLETED" || request.status === "CANCELLED") {
      return next(
        createError(
          `Cannot assign a vendor to a ${request.status.toLowerCase()} maintenance request`,
        ),
      );
    }

    // --------------------------------------------------------
    // Validate new vendor
    // --------------------------------------------------------

    const vendor = await validateVendorForOwner(
      vendorId,
      req.user.userId,
      request.category,
    );

    // --------------------------------------------------------
    // Avoid duplicate assignment
    // --------------------------------------------------------

    if (
      request.assignedVendor &&
      request.assignedVendor.toString() === vendor._id.toString()
    ) {
      return next(
        createError(
          "This vendor is already assigned to the maintenance request",
        ),
      );
    }

    // --------------------------------------------------------
    // Assign vendor
    // --------------------------------------------------------

    request.assignedVendor = vendor._id;
    request.vendorAssignedAt = new Date();
    request.vendorCompletedAt = null;

    await request.save();

    // --------------------------------------------------------
    // Update vendor statistics
    // --------------------------------------------------------

    await Vendor.updateOne(
      { _id: vendor._id },
      {
        $inc: {
          totalJobs: 1,
        },
      },
    );

    await populateMaintenanceRequest(request);

    return res.status(200).json({
      success: true,
      message: "Vendor assigned to maintenance request successfully",
      data: {
        maintenanceRequest: request,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// UPDATE MAINTENANCE STATUS
// ============================================================

const updateMaintenanceStatus = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { status, actualCost, notes } = req.body;

    if (!isValidObjectId(requestId)) {
      return next(createError("Invalid maintenance request ID"));
    }

    const allowedStatuses = [
      "ASSIGNED",
      "IN_PROGRESS",
      "ON_HOLD",
      "COMPLETED",
      "CANCELLED",
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return next(createError("Invalid maintenance status"));
    }

    const request = await MaintenanceRequest.findOne({
      _id: requestId,
      assignedCaretaker: req.user.userId,
    });

    if (!request) {
      return next(
        createError(
          "Maintenance request not found or not assigned to you",
          404,
        ),
      );
    }

    // --------------------------------------------------------
    // Prevent changes to completed/cancelled requests
    // --------------------------------------------------------

    if (request.status === "COMPLETED" || request.status === "CANCELLED") {
      return next(
        createError(
          `Cannot update a ${request.status.toLowerCase()} maintenance request`,
        ),
      );
    }

    // --------------------------------------------------------
    // Status transition validation
    // --------------------------------------------------------

    const validTransitions = {
      ASSIGNED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],

      IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],

      ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
    };

    const allowedNextStatuses = validTransitions[request.status] || [];

    if (!allowedNextStatuses.includes(status)) {
      return next(
        createError(
          `Cannot change maintenance status from ${request.status} to ${status}`,
        ),
      );
    }

    // --------------------------------------------------------
    // Actual cost
    // --------------------------------------------------------

    if (actualCost !== undefined) {
      request.actualCost = validateNonNegativeNumber(actualCost, "Actual cost");
    }

    // --------------------------------------------------------
    // Notes
    // --------------------------------------------------------

    if (notes !== undefined) {
      if (typeof notes !== "string") {
        return next(createError("Notes must be a string"));
      }

      if (notes.trim().length > 2000) {
        return next(createError("Notes cannot exceed 2000 characters"));
      }

      request.notes = notes.trim();
    }

    // --------------------------------------------------------
    // Update timestamps
    // --------------------------------------------------------

    if (status === "IN_PROGRESS" && !request.startedAt) {
      request.startedAt = new Date();
    }

    if (status === "COMPLETED") {
      request.completedAt = new Date();

      if (!request.startedAt) {
        request.startedAt = new Date();
      }
    }

    request.status = status;

    // --------------------------------------------------------
    // Save request
    // --------------------------------------------------------

    await request.save();

    // --------------------------------------------------------
    // Update vendor completed jobs
    // --------------------------------------------------------

    if (
      status === "COMPLETED" &&
      request.assignedVendor &&
      !request.vendorCompletedAt
    ) {
      request.vendorCompletedAt = new Date();

      await request.save();

      await Vendor.updateOne(
        {
          _id: request.assignedVendor,
          isActive: true,
        },
        {
          $inc: {
            completedJobs: 1,
          },
        },
      );
    }

    await populateMaintenanceRequest(request);

    return res.status(200).json({
      success: true,
      message: "Maintenance status updated successfully",
      data: {
        maintenanceRequest: request,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET SINGLE MAINTENANCE REQUEST
// ============================================================

const getMaintenanceRequestById = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    if (!isValidObjectId(requestId)) {
      return next(createError("Invalid maintenance request ID"));
    }

    const request = await MaintenanceRequest.findOne({
      _id: requestId,
      $or: [
        {
          reportedBy: req.user.userId,
        },
        {
          assignedCaretaker: req.user.userId,
        },
      ],
    })
      .populate(
        "property",
        "title propertyType address status occupancy condition health",
      )
      .populate("reportedBy", "name email role")
      .populate("assignedCaretaker", "name email role isActive")
      .populate(
        "assignedVendor",
        "name companyName category phone email status rating totalJobs completedJobs",
      )
      .populate(
        "inspection",
        "overallCondition securityStatus electricalStatus plumbingStatus cleanliness status inspectedAt",
      );

    if (!request) {
      return next(createError("Maintenance request not found", 404));
    }

    return res.status(200).json({
      success: true,
      data: {
        maintenanceRequest: request,
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
  createMaintenanceRequest,
  getOwnerMaintenanceRequests,
  getPropertyMaintenanceRequests,
  getCaretakerMaintenanceRequests,
  assignVendorToMaintenance,
  updateMaintenanceStatus,
  getMaintenanceRequestById,
};
