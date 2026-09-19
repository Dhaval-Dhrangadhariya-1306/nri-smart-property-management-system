const mongoose = require("mongoose");

const Notification = require("../models/Notification");
const Property = require("../models/Property");
const User = require("../models/User");

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
// CREATE NOTIFICATION
// ============================================================

const createNotification = async (req, res, next) => {
  try {
    const {
      recipient,
      property,
      type,
      priority,
      title,
      message,
      relatedEntity,
      actionUrl,
      expiresAt,
      metadata,
    } = req.body;

    // --------------------------------------------------------
    // Validate recipient
    // --------------------------------------------------------

    if (!recipient || !isValidObjectId(recipient)) {
      throw createError("Valid recipient ID is required", 400);
    }

    const recipientUser = await User.findOne({
      _id: recipient,
      isActive: true,
    });

    if (!recipientUser) {
      throw createError("Recipient user not found or inactive", 404);
    }

    // --------------------------------------------------------
    // Validate property if provided
    // --------------------------------------------------------

    let propertyDocument = null;

    if (property) {
      if (!isValidObjectId(property)) {
        throw createError("Invalid property ID", 400);
      }

      propertyDocument = await Property.findOne({
        _id: property,
        isActive: true,
      });

      if (!propertyDocument) {
        throw createError("Property not found or inactive", 404);
      }
    }

    // --------------------------------------------------------
    // Required fields
    // --------------------------------------------------------

    if (!type) {
      throw createError("Notification type is required", 400);
    }

    if (!title || !title.trim()) {
      throw createError("Notification title is required", 400);
    }

    if (!message || !message.trim()) {
      throw createError("Notification message is required", 400);
    }

    // --------------------------------------------------------
    // Validate expiry date
    // --------------------------------------------------------

    let parsedExpiresAt = null;

    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);

      if (Number.isNaN(parsedExpiresAt.getTime())) {
        throw createError("Invalid notification expiry date", 400);
      }

      if (parsedExpiresAt <= new Date()) {
        throw createError(
          "Notification expiry date must be in the future",
          400,
        );
      }
    }

    // --------------------------------------------------------
    // Create notification
    // --------------------------------------------------------

    const notification = await Notification.create({
      recipient,
      property: property || null,
      type,
      priority: priority || "MEDIUM",
      title: title.trim(),
      message: message.trim(),
      relatedEntity: relatedEntity || {
        entityType: null,
        entityId: null,
      },
      actionUrl: actionUrl?.trim() || "",
      expiresAt: parsedExpiresAt,
      metadata: metadata || {},
    });

    const populatedNotification = await Notification.findById(notification._id)
      .populate("recipient", "name email role")
      .populate("property", "title propertyType address");

    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      notification: populatedNotification,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET MY NOTIFICATIONS
// ============================================================

const getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.userId,
    })
      .populate("property", "title propertyType address")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET UNREAD NOTIFICATIONS
// ============================================================

const getUnreadNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.userId,
      isRead: false,
    })
      .populate("property", "title propertyType address")
      .sort({
        priority: -1,
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET SINGLE NOTIFICATION
// ============================================================

const getNotificationById = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    if (!isValidObjectId(notificationId)) {
      throw createError("Invalid notification ID", 400);
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: req.user.userId,
    })
      .populate("recipient", "name email role")
      .populate("property", "title propertyType address");

    if (!notification) {
      throw createError("Notification not found", 404);
    }

    return res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// MARK NOTIFICATION AS READ
// ============================================================

const markNotificationAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    if (!isValidObjectId(notificationId)) {
      throw createError("Invalid notification ID", 400);
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: req.user.userId,
    });

    if (!notification) {
      throw createError("Notification not found", 404);
    }

    if (notification.isRead) {
      return res.status(200).json({
        success: true,
        message: "Notification is already marked as read",
        notification,
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();

    await notification.save();

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================================

const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      {
        recipient: req.user.userId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// DELETE NOTIFICATION
// ============================================================

const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    if (!isValidObjectId(notificationId)) {
      throw createError("Invalid notification ID", 400);
    }

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: req.user.userId,
    });

    if (!notification) {
      throw createError("Notification not found", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// NOTIFICATION STATISTICS
// ============================================================

const getNotificationStats = async (req, res, next) => {
  try {
    const recipientId = new mongoose.Types.ObjectId(req.user.userId);

    const totalNotifications = await Notification.countDocuments({
      recipient: recipientId,
    });

    const unreadNotifications = await Notification.countDocuments({
      recipient: recipientId,
      isRead: false,
    });

    const readNotifications = await Notification.countDocuments({
      recipient: recipientId,
      isRead: true,
    });

    const byType = await Notification.aggregate([
      {
        $match: {
          recipient: recipientId,
        },
      },
      {
        $group: {
          _id: "$type",
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

    const byPriority = await Notification.aggregate([
      {
        $match: {
          recipient: recipientId,
        },
      },
      {
        $group: {
          _id: "$priority",
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

    return res.status(200).json({
      success: true,
      stats: {
        totalNotifications,
        unreadNotifications,
        readNotifications,
        byType,
        byPriority,
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
  createNotification,
  getMyNotifications,
  getUnreadNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationStats,
};
