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

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notification management, unread notifications, statistics, and read status
 */

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authMiddleware);

// ============================================================
// NOTIFICATION ROUTES
// ============================================================

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     operationId: createNotification
 *     summary: Create a notification
 *     description: Creates a notification. Available to owners and administrators.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Notification fields accepted by the notification controller.
 *             additionalProperties: true
 *             properties:
 *               recipient:
 *                 type: string
 *                 description: Recipient user ID, if supported by the controller.
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *               relatedProperty:
 *                 type: string
 *     responses:
 *       201:
 *         description: Notification created successfully
 *       400:
 *         description: Invalid or incomplete notification data
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Owner or administrator role required
 */
router.post("/", authorize("NRI_OWNER", "ADMIN"), createNotification);

/**
 * @swagger
 * /api/notifications/my:
 *   get:
 *     operationId: getMyNotifications
 *     summary: Get my notifications
 *     description: Retrieves notifications for the authenticated user.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  "/my",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getMyNotifications,
);

/**
 * @swagger
 * /api/notifications/unread:
 *   get:
 *     operationId: getUnreadNotifications
 *     summary: Get unread notifications
 *     description: Retrieves unread notifications for the authenticated user.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread notifications retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  "/unread",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getUnreadNotifications,
);

/**
 * @swagger
 * /api/notifications/stats:
 *   get:
 *     operationId: getNotificationStats
 *     summary: Get notification statistics
 *     description: Retrieves notification statistics for the authenticated user.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification statistics retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  "/stats",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getNotificationStats,
);

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     operationId: markAllNotificationsAsRead
 *     summary: Mark all notifications as read
 *     description: Marks all eligible notifications as read for the authenticated user.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications marked as read successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.patch(
  "/read-all",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  markAllNotificationsAsRead,
);

/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   get:
 *     operationId: getNotificationById
 *     summary: Get a notification by ID
 *     description: Retrieves a single notification.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the notification.
 *     responses:
 *       200:
 *         description: Notification retrieved successfully
 *       400:
 *         description: Invalid notification ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions or notification access denied
 *       404:
 *         description: Notification not found
 */
router.get(
  "/:notificationId",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  getNotificationById,
);

/**
 * @swagger
 * /api/notifications/{notificationId}/read:
 *   patch:
 *     operationId: markNotificationAsRead
 *     summary: Mark a notification as read
 *     description: Marks the specified notification as read.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the notification.
 *     responses:
 *       200:
 *         description: Notification marked as read successfully
 *       400:
 *         description: Invalid notification ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions or notification access denied
 *       404:
 *         description: Notification not found
 */
router.patch(
  "/:notificationId/read",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  markNotificationAsRead,
);

/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   delete:
 *     operationId: deleteNotification
 *     summary: Delete a notification
 *     description: Deletes a notification according to the application's business rules.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the notification.
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *       400:
 *         description: Invalid notification ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions or notification access denied
 *       404:
 *         description: Notification not found
 */
router.delete(
  "/:notificationId",
  authorize("NRI_OWNER", "ADMIN", "CARETAKER"),
  deleteNotification,
);

module.exports = router;
