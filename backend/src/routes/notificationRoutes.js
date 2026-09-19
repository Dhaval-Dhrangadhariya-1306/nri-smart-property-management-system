const express = require("express");

const {
  createNotification,
  getMyNotifications,
  getUnreadNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationStats,
} = require("../controllers/notificationController");

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authMiddleware);

// ============================================================
// NOTIFICATION ROUTES
// ============================================================

// Create notification
router.post("/", authorize("NRI_OWNER", "ADMIN"), createNotification);

// Get my notifications
router.get(
  "/my",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getMyNotifications,
);

// Get unread notifications
router.get(
  "/unread",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getUnreadNotifications,
);

// Notification statistics
router.get(
  "/stats",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getNotificationStats,
);

// Mark all notifications as read
router.patch(
  "/read-all",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  markAllNotificationsAsRead,
);

// Get single notification
router.get(
  "/:notificationId",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getNotificationById,
);

// Mark notification as read
router.patch(
  "/:notificationId/read",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  markNotificationAsRead,
);

// Delete notification
router.delete(
  "/:notificationId",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  deleteNotification,
);

module.exports = router;
