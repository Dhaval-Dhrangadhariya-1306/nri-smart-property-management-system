const { DateTime } = require("luxon");

const Document = require("../models/Document");
const createAutomatedNotification =
  require("../services/notificationService").createAutomatedNotification;

// ============================================================
// CONFIGURATION
// ============================================================

const JOB_TIMEZONE = process.env.JOB_TIMEZONE || "Asia/Kolkata";

// ============================================================
// DATE HELPERS
// ============================================================

/**
 * Get the start of the current calendar day in the job timezone.
 */
const startOfDay = (date = new Date()) => {
  const result = DateTime.fromJSDate(date, {
    zone: JOB_TIMEZONE,
  }).startOf("day");

  if (!result.isValid) {
    throw new Error(
      `Unable to calculate start of day: ${result.invalidReason}`,
    );
  }

  return result.toJSDate();
};

/**
 * Get the start of a calendar day a specified number of days
 * after the supplied date.
 */
const getStartOfDayAfter = (date, days) => {
  const result = DateTime.fromJSDate(date, {
    zone: JOB_TIMEZONE,
  })
    .startOf("day")
    .plus({ days });

  if (!result.isValid) {
    throw new Error(
      `Unable to calculate date boundary: ${result.invalidReason}`,
    );
  }

  return result.toJSDate();
};

/**
 * Get the expiry date as YYYY-MM-DD in the configured timezone.
 */
const getExpiryDateKey = (expiryDate) => {
  const date = new Date(expiryDate);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid document expiry date");
  }

  const result = DateTime.fromJSDate(date, {
    zone: JOB_TIMEZONE,
  }).toISODate();

  if (!result) {
    throw new Error("Unable to determine document expiry date");
  }

  return result;
};

/**
 * Create a half-open date range for a calendar day.
 *
 * The range includes the start and excludes the next day's start.
 */
const getDayRange = (date, daysFromToday = 0) => {
  const start = getStartOfDayAfter(date, daysFromToday);
  const end = getStartOfDayAfter(date, daysFromToday + 1);

  return { start, end };
};

// ============================================================
// NOTIFICATION HELPER
// ============================================================

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

// ============================================================
// MAIN DOCUMENT EXPIRY JOB
// ============================================================

/**
 * Process document expiry notifications.
 *
 * 1. Mark overdue documents as EXPIRED after notification handling.
 * 2. Notify owners about documents expiring today.
 * 3. Notify owners about documents expiring tomorrow.
 * 4. Notify owners about documents expiring in 7 days.
 * 5. Notify owners about documents expiring in 30 days.
 */
const runDocumentExpiryJob = async () => {
  const now = new Date();

  const todayRange = getDayRange(now, 0);
  const tomorrowRange = getDayRange(now, 1);
  const sevenDaysRange = getDayRange(now, 7);
  const thirtyDaysRange = getDayRange(now, 30);

  let processed = 0;
  let notificationsCreated = 0;
  let expiredDocuments = 0;

  // ==========================================================
  // 1. MARK OVERDUE DOCUMENTS AS EXPIRED
  // ==========================================================

  const expiredDocumentsList = await Document.find({
    isActive: true,
    status: "ACTIVE",
    expiryDate: {
      $lt: todayRange.start,
    },
  }).select("_id owner property title category expiryDate");

  for (const document of expiredDocumentsList) {
    processed += 1;

    // Attempt notification creation before changing document status.
    const notification = await notifyDocumentExpiry({
      document,
      daysUntilExpiry: 0,
      priority: "URGENT",
      title: "Document Expired",
      message: `The document "${document.title}" has expired.`,
      eventKey: `DOCUMENT_EXPIRED:${document._id}:${getExpiryDateKey(
        document.expiryDate,
      )}`,
    });

    // If notification creation fails, leave the document ACTIVE
    // so the next scheduled run can retry.
    if (!notification) {
      continue;
    }

    if (notification.created) {
      notificationsCreated += 1;
    }

    // Mark the document as expired only if it is still ACTIVE.
    const updateResult = await Document.updateOne(
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

    if (updateResult.modifiedCount > 0) {
      expiredDocuments += 1;
    }
  }

  // ==========================================================
  // 2. DOCUMENTS EXPIRING TODAY
  // ==========================================================

  const expiringToday = await Document.find({
    isActive: true,
    status: "ACTIVE",
    expiryDate: {
      $gte: todayRange.start,
      $lt: todayRange.end,
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
      eventKey: `DOCUMENT_EXPIRY:${document._id}:${getExpiryDateKey(
        document.expiryDate,
      )}:0`,
    });

    if (notification?.created) {
      notificationsCreated += 1;
    }
  }

  // ==========================================================
  // 3. DOCUMENTS EXPIRING TOMORROW
  // ==========================================================

  const expiringTomorrow = await Document.find({
    isActive: true,
    status: "ACTIVE",
    expiryDate: {
      $gte: tomorrowRange.start,
      $lt: tomorrowRange.end,
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
      eventKey: `DOCUMENT_EXPIRY:${document._id}:${getExpiryDateKey(
        document.expiryDate,
      )}:1`,
    });

    if (notification?.created) {
      notificationsCreated += 1;
    }
  }

  // ==========================================================
  // 4. DOCUMENTS EXPIRING IN 7 DAYS
  // ==========================================================

  const expiringInSevenDays = await Document.find({
    isActive: true,
    status: "ACTIVE",
    expiryDate: {
      $gte: sevenDaysRange.start,
      $lt: sevenDaysRange.end,
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
      eventKey: `DOCUMENT_EXPIRY:${document._id}:${getExpiryDateKey(
        document.expiryDate,
      )}:7`,
    });

    if (notification?.created) {
      notificationsCreated += 1;
    }
  }

  // ==========================================================
  // 5. DOCUMENTS EXPIRING IN 30 DAYS
  // ==========================================================

  const expiringInThirtyDays = await Document.find({
    isActive: true,
    status: "ACTIVE",
    expiryDate: {
      $gte: thirtyDaysRange.start,
      $lt: thirtyDaysRange.end,
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
      eventKey: `DOCUMENT_EXPIRY:${document._id}:${getExpiryDateKey(
        document.expiryDate,
      )}:30`,
    });

    if (notification?.created) {
      notificationsCreated += 1;
    }
  }

  // ==========================================================
  // RETURN JOB SUMMARY
  // ==========================================================

  return {
    processed,
    expiredDocuments,
    notificationsCreated,
    executedAt: now,
  };
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  runDocumentExpiryJob,
};
