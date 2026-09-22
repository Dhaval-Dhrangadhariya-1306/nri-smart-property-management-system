const mongoose = require("mongoose");

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

    const vendor = await Vendor.findOneAndUpdate(
      {
        _id: vendorId,
        owner: req.user.userId,
        isActive: true,
      },
      updates,
      {
        new: true,
        runValidators: true,
      },
    ).populate("owner", "name email role");

    if (!vendor) {
      throw createError("Vendor not found or access denied", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      vendor,
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

    const vendor = await Vendor.findOneAndUpdate(
      {
        _id: vendorId,
        owner: req.user.userId,
        isActive: true,
      },
      {
        isActive: false,
        status: "INACTIVE",
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!vendor) {
      throw createError("Vendor not found or access denied", 404);
    }

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
