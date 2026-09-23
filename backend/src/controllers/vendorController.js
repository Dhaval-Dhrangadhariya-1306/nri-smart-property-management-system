const mongoose = require("mongoose");

const Vendor = require("../models/Vendor");
const createAuditLog = require("../utils/auditLogger");

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
// VENDOR AUDIT SNAPSHOT
// ============================================================

const getVendorAuditValues = (vendor) => {
  if (!vendor) return null;

  return {
    owner: vendor.owner?._id
      ? vendor.owner._id.toString()
      : vendor.owner?.toString?.() || null,

    name: vendor.name,
    companyName: vendor.companyName,
    category: vendor.category,

    phone: vendor.phone,
    email: vendor.email,

    address: vendor.address
      ? {
          addressLine1: vendor.address.addressLine1 || "",
          addressLine2: vendor.address.addressLine2 || "",
          city: vendor.address.city || "",
          state: vendor.address.state || "",
          country: vendor.address.country || "",
          postalCode: vendor.address.postalCode || "",
        }
      : null,

    services: Array.isArray(vendor.services) ? [...vendor.services] : [],

    status: vendor.status,
    rating: vendor.rating,

    totalJobs: vendor.totalJobs,
    completedJobs: vendor.completedJobs,

    notes: vendor.notes,

    isActive: vendor.isActive,
  };
};

// ============================================================
// CREATE VENDOR
// ============================================================

const createVendor = async (req, res, next) => {
  try {
    const {
      name,
      companyName,
      category,
      phone,
      email,
      address,
      services,
      notes,
      status,
      rating,
    } = req.body;

    if (!name || !name.trim()) {
      throw createError("Vendor name is required");
    }

    if (!category) {
      throw createError("Vendor category is required");
    }

    const vendor = await Vendor.create({
      owner: req.user.userId,
      name: name.trim(),
      companyName: companyName?.trim() || "",
      category,
      phone: phone?.trim() || "",
      email: email?.trim().toLowerCase() || "",
      address: address || {},
      services: Array.isArray(services) ? services : [],
      notes: notes?.trim() || "",
      status: status || "ACTIVE",
      rating: rating ?? 0,
    });

    // --------------------------------------------------------
    // AUDIT: VENDOR_CREATED
    // --------------------------------------------------------

    await createAuditLog({
      req,
      action: "VENDOR_CREATED",
      resourceType: "VENDOR",
      resourceId: vendor._id,
      description: `Vendor "${vendor.name}" was created.`,
      oldValues: null,
      newValues: getVendorAuditValues(vendor),
    });

    const populatedVendor = await Vendor.findById(vendor._id).populate(
      "owner",
      "name email role",
    );

    return res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      vendor: populatedVendor,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET MY VENDORS
// ============================================================

const getMyVendors = async (req, res, next) => {
  try {
    const { category, status, search } = req.query;

    const filter = {
      owner: req.user.userId,
      isActive: true,
    };

    if (category) {
      filter.category = category;
    }

    if (status) {
      filter.status = status;
    }

    if (search?.trim()) {
      filter.$or = [
        {
          name: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          companyName: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          category: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    const vendors = await Vendor.find(filter)
      .populate("owner", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: vendors.length,
      vendors,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET VENDOR BY ID
// ============================================================

const getVendorById = async (req, res, next) => {
  try {
    const { vendorId } = req.params;

    if (!isValidObjectId(vendorId)) {
      throw createError("Invalid vendor ID", 400);
    }

    const vendor = await Vendor.findOne({
      _id: vendorId,
      owner: req.user.userId,
      isActive: true,
    }).populate("owner", "name email role");

    if (!vendor) {
      throw createError("Vendor not found or access denied", 404);
    }

    return res.status(200).json({
      success: true,
      vendor,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// UPDATE VENDOR
// ============================================================

const updateVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;

    if (!isValidObjectId(vendorId)) {
      throw createError("Invalid vendor ID", 400);
    }

    const allowedFields = [
      "name",
      "companyName",
      "category",
      "phone",
      "email",
      "address",
      "services",
      "notes",
      "status",
      "rating",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.name !== undefined) {
      if (typeof updates.name !== "string" || !updates.name.trim()) {
        throw createError("Vendor name cannot be empty");
      }

      updates.name = updates.name.trim();
    }

    if (updates.companyName !== undefined) {
      updates.companyName =
        typeof updates.companyName === "string"
          ? updates.companyName.trim()
          : "";
    }

    if (updates.phone !== undefined) {
      updates.phone =
        typeof updates.phone === "string" ? updates.phone.trim() : "";
    }

    if (updates.email !== undefined) {
      updates.email =
        typeof updates.email === "string"
          ? updates.email.trim().toLowerCase()
          : "";
    }

    if (updates.notes !== undefined) {
      updates.notes =
        typeof updates.notes === "string" ? updates.notes.trim() : "";
    }

    if (updates.services !== undefined) {
      if (!Array.isArray(updates.services)) {
        throw createError("Services must be an array");
      }
    }

    if (updates.rating !== undefined) {
      if (
        typeof updates.rating !== "number" ||
        updates.rating < 0 ||
        updates.rating > 5
      ) {
        throw createError("Rating must be a number between 0 and 5");
      }
    }

    // --------------------------------------------------------
    // GET EXISTING VENDOR
    // --------------------------------------------------------

    const existingVendor = await Vendor.findOne({
      _id: vendorId,
      owner: req.user.userId,
      isActive: true,
    });

    if (!existingVendor) {
      throw createError("Vendor not found or access denied", 404);
    }

    const oldValues = getVendorAuditValues(existingVendor);

    // --------------------------------------------------------
    // APPLY UPDATE
    // --------------------------------------------------------

    Object.assign(existingVendor, updates);

    await existingVendor.save();

    const newValues = getVendorAuditValues(existingVendor);

    // --------------------------------------------------------
    // AUDIT: VENDOR_UPDATED
    // --------------------------------------------------------

    await createAuditLog({
      req,
      action: "VENDOR_UPDATED",
      resourceType: "VENDOR",
      resourceId: existingVendor._id,
      description: `Vendor "${existingVendor.name}" was updated.`,
      oldValues,
      newValues,
    });

    const populatedVendor = await Vendor.findById(existingVendor._id).populate(
      "owner",
      "name email role",
    );

    return res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      vendor: populatedVendor,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DELETE / ARCHIVE VENDOR
// ============================================================

const deleteVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;

    if (!isValidObjectId(vendorId)) {
      throw createError("Invalid vendor ID", 400);
    }

    // --------------------------------------------------------
    // GET EXISTING VENDOR
    // --------------------------------------------------------

    const vendor = await Vendor.findOne({
      _id: vendorId,
      owner: req.user.userId,
      isActive: true,
    });

    if (!vendor) {
      throw createError("Vendor not found or access denied", 404);
    }

    const oldValues = getVendorAuditValues(vendor);

    // --------------------------------------------------------
    // SOFT DELETE / ARCHIVE
    // --------------------------------------------------------

    vendor.isActive = false;
    vendor.status = "INACTIVE";

    await vendor.save();

    const newValues = getVendorAuditValues(vendor);

    // --------------------------------------------------------
    // AUDIT: VENDOR_ARCHIVED
    // --------------------------------------------------------

    await createAuditLog({
      req,
      action: "VENDOR_ARCHIVED",
      resourceType: "VENDOR",
      resourceId: vendor._id,
      description: `Vendor "${vendor.name}" was archived.`,
      oldValues,
      newValues,
    });

    return res.status(200).json({
      success: true,
      message: "Vendor archived successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET VENDOR STATS
// ============================================================

const getVendorStats = async (req, res, next) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.userId);

    const stats = await Vendor.aggregate([
      {
        $match: {
          owner: ownerId,
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,

          totalVendors: {
            $sum: 1,
          },

          activeVendors: {
            $sum: {
              $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0],
            },
          },

          inactiveVendors: {
            $sum: {
              $cond: [{ $eq: ["$status", "INACTIVE"] }, 1, 0],
            },
          },

          suspendedVendors: {
            $sum: {
              $cond: [{ $eq: ["$status", "SUSPENDED"] }, 1, 0],
            },
          },

          averageRating: {
            $avg: "$rating",
          },

          totalJobs: {
            $sum: "$totalJobs",
          },

          completedJobs: {
            $sum: "$completedJobs",
          },
        },
      },
    ]);

    const categoryStats = await Vendor.aggregate([
      {
        $match: {
          owner: ownerId,
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$category",
          count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
    ]);

    const result = stats[0] || {
      totalVendors: 0,
      activeVendors: 0,
      inactiveVendors: 0,
      suspendedVendors: 0,
      averageRating: 0,
      totalJobs: 0,
      completedJobs: 0,
    };

    return res.status(200).json({
      success: true,
      stats: {
        totalVendors: result.totalVendors,
        activeVendors: result.activeVendors,
        inactiveVendors: result.inactiveVendors,
        suspendedVendors: result.suspendedVendors,
        averageRating: Number((result.averageRating || 0).toFixed(2)),
        totalJobs: result.totalJobs,
        completedJobs: result.completedJobs,
        byCategory: categoryStats,
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
  createVendor,
  getMyVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  getVendorStats,
};
