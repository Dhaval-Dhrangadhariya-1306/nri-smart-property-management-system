const Document = require("../models/Document");
const createAutomatedNotification =
  require("../services/notificationService").createAutomatedNotification;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Get the start of a calendar day.
 *
 * Using calendar-day boundaries makes the job predictable
 * regardless of the exact time the scheduler executes.
 */
const startOfDay = (date = new Date()) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Get the end of a calendar day.
 */
const endOfDay = (date = new Date()) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

/**
 * Create an automated document-expiry notification.
 */
const notifyDocumentExpiry = async ({
  document,
  daysUntilExpiry,
  priority,
  title,
  message,
  eventKey,
}) => {
  return createAutomatedNotification({
    recipient: document.owner,
    property: document.property,
    type: "DOCUMENT_EXPIRY",
    priority,
    title,
    message,
    relatedEntity: {
      entityType: "DOCUMENT",
      entityId: document._id,
    },
    actionUrl: `/documents/${document._id}`,
    metadata: {
      documentId: document._id,
      documentCategory: document.category,
      expiryDate: document.expiryDate,
      daysUntilExpiry,
      automationType: "DOCUMENT_EXPIRY",
    },
    eventKey,
  });
};

/**
 * Process document expiry notifications.
 *
 * This function is intentionally exported separately so it can be
 * executed manually during testing before being connected to cron.
 */
const runDocumentExpiryJob = async () => {
  const now = new Date();

  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const tomorrowEnd = endOfDay(tomorrowStart);

  const sevenDaysStart = new Date(todayStart.getTime() + 7 * DAY_MS);
  const sevenDaysEnd = endOfDay(sevenDaysStart);

  const thirtyDaysStart = new Date(todayStart.getTime() + 30 * DAY_MS);
  const thirtyDaysEnd = endOfDay(thirtyDaysStart);

  let processed = 0;
  let notificationsCreated = 0;
  let expiredDocuments = 0;

  // ============================================================
  // 1. MARK EXPIRED DOCUMENTS
  // ============================================================

  const expiredDocumentsList = await Document.find({
    isActive: true,
    status: "ACTIVE",
    expiryDate: {
      $lt: todayStart,
    },
  }).select("_id owner property title category expiryDate");

  for (const document of expiredDocumentsList) {
    await Document.updateOne(
      {
        _id: document._id,
        isActive: true,
        status: "ACTIVE",
      },
      {
        $set: {
          status: "EXPIRED",
        },
      },
    );

    expiredDocuments += 1;
    processed += 1;

    const notification = await notifyDocumentExpiry({
      document,
      daysUntilExpiry: 0,
      priority: "URGENT",
      title: "Document Expired",
      message: `The document "${document.title}" has expired.`,
      eventKey: `DOCUMENT_EXPIRED:${document._id}`,
    });

    if (notification?.created) {
      notificationsCreated += 1;
    }
  }

  // ============================================================
  // 2. EXPIRING TODAY
  // ============================================================

  const expiringToday = await Document.find({
    isActive: true,
    status: "ACTIVE",
    expiryDate: {
      $gte: todayStart,
      $lte: todayEnd,
    },
  }).select("_id owner property title category expiryDate");

  for (const document of expiringToday) {
    processed += 1;

    const notification = await notifyDocumentExpiry({
      document,
      daysUntilExpiry: 0,
      priority: "URGENT",
      title: "Document Expires Today",
      message: `The document "${document.title}" expires today.`,
      eventKey: `DOCUMENT_EXPIRY:${document._id}:0`,
    });

    if (notification?.created) {
      notificationsCreated += 1;
    }
  }

  // ============================================================
  // 3. EXPIRING TOMORROW
  // ============================================================

  const expiringTomorrow = await Document.find({
    isActive: true,
    status: "ACTIVE",
    expiryDate: {
      $gte: tomorrowStart,
      $lte: tomorrowEnd,
    },
  }).select("_id owner property title category expiryDate");

  for (const document of expiringTomorrow) {
    processed += 1;

    const notification = await notifyDocumentExpiry({
      document,
      daysUntilExpiry: 1,
      priority: "URGENT",
      title: "Document Expires Tomorrow",
      message: `The document "${document.title}" expires tomorrow.`,
      eventKey: `DOCUMENT_EXPIRY:${document._id}:1`,
    });

    if (notification?.created) {
      notificationsCreated += 1;
    }
  }

  // ============================================================
  // 4. EXPIRING IN 7 DAYS
  // ============================================================

  const expiringInSevenDays = await Document.find({
    isActive: true,
    status: "ACTIVE",
    expiryDate: {
      $gte: sevenDaysStart,
      $lte: sevenDaysEnd,
    },
  }).select("_id owner property title category expiryDate");

  for (const document of expiringInSevenDays) {
    processed += 1;

    const notification = await notifyDocumentExpiry({
      document,
      daysUntilExpiry: 7,
      priority: "HIGH",
      title: "Document Expires in 7 Days",
      message: `The document "${document.title}" will expire in 7 days.`,
      eventKey: `DOCUMENT_EXPIRY:${document._id}:7`,
    });

    if (notification?.created) {
      notificationsCreated += 1;
    }
  }

  // ============================================================
  // 5. EXPIRING IN 30 DAYS
  // ============================================================

  const expiringInThirtyDays = await Document.find({
    isActive: true,
    status: "ACTIVE",
    expiryDate: {
      $gte: thirtyDaysStart,
      $lte: thirtyDaysEnd,
    },
  }).select("_id owner property title category expiryDate");

  for (const document of expiringInThirtyDays) {
    processed += 1;

    const notification = await notifyDocumentExpiry({
      document,
      daysUntilExpiry: 30,
      priority: "MEDIUM",
      title: "Document Expires in 30 Days",
      message: `The document "${document.title}" will expire in 30 days.`,
      eventKey: `DOCUMENT_EXPIRY:${document._id}:30`,
    });

    if (notification?.created) {
      notificationsCreated += 1;
    }
  }

  return {
    processed,
    expiredDocuments,
    notificationsCreated,
    executedAt: now,
  };
};

module.exports = {
  runDocumentExpiryJob,
};
