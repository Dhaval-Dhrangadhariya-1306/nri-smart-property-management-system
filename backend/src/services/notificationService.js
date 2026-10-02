const Notification = require("../models/Notification");
const User = require("../models/User");

/**
 * Create an automated notification.
 *
 * This service is intentionally non-blocking:
 * notification failures must never break the primary business operation.
 *
 * Duplicate protection is handled at two levels:
 *
 * 1. Application-level check using automationEventKey.
 * 2. MongoDB unique index on metadata.automationEventKey.
 *
 * The second layer protects against race conditions where two
 * requests attempt to create the same automated notification
 * at nearly the same time.
 *
 * Return value:
 * {
 *   notification: Notification document,
 *   created: true/false
 * }
 */
const createAutomatedNotification = async ({
  recipient,
  property = null,
  type,
  priority = "MEDIUM",
  title,
  message,
  relatedEntity = null,
  actionUrl = "",
  metadata = {},
  eventKey = null,
}) => {
  try {
    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    if (!recipient) {
      console.error("Automated notification skipped: recipient is missing");
      return null;
    }

    if (!type) {
      console.error("Automated notification skipped: type is missing");
      return null;
    }

    if (!title) {
      console.error("Automated notification skipped: title is missing");
      return null;
    }

    if (!message) {
      console.error("Automated notification skipped: message is missing");
      return null;
    }

    // ----------------------------------------------------------
    // VERIFY RECIPIENT
    // ----------------------------------------------------------

    const recipientUser = await User.findOne({
      _id: recipient,
      isActive: true,
    }).select("_id");

    if (!recipientUser) {
      console.error(
        `Automated notification skipped: active recipient not found (${recipient})`,
      );

      return null;
    }

    // ----------------------------------------------------------
    // APPLICATION-LEVEL DUPLICATE PROTECTION
    // ----------------------------------------------------------

    if (eventKey) {
      const existingNotification = await Notification.findOne({
        "metadata.automationEventKey": eventKey,
      }).select("_id");

      if (existingNotification) {
        return {
          notification: existingNotification,
          created: false,
        };
      }
    }

    // ----------------------------------------------------------
    // PREPARE METADATA
    // ----------------------------------------------------------

    const notificationMetadata = {
      ...metadata,
      automation: true,
      ...(eventKey
        ? {
            automationEventKey: eventKey,
          }
        : {}),
    };

    // ----------------------------------------------------------
    // CREATE NOTIFICATION
    // ----------------------------------------------------------

    try {
      const notification = await Notification.create({
        recipient: recipientUser._id,
        property,
        type,
        priority,
        title,
        message,
        relatedEntity,
        actionUrl,
        metadata: notificationMetadata,
      });

      return {
        notification,
        created: true,
      };
    } catch (error) {
      // --------------------------------------------------------
      // DATABASE-LEVEL DUPLICATE PROTECTION
      // --------------------------------------------------------
      //
      // If two requests reach Notification.create() at nearly
      // the same time, MongoDB's unique index may reject one
      // with error code 11000.
      //
      // Instead of treating that as a failure, retrieve and
      // return the already-created notification.
      //

      if (error.code === 11000 && eventKey) {
        const existingNotification = await Notification.findOne({
          "metadata.automationEventKey": eventKey,
        });

        return existingNotification
          ? {
              notification: existingNotification,
              created: false,
            }
          : null;
      }

      throw error;
    }
  } catch (error) {
    console.error("Automated notification creation failed:", error.message);

    // ----------------------------------------------------------
    // IMPORTANT
    // ----------------------------------------------------------
    //
    // Notification failure must never break the primary
    // business operation.
    //

    return null;
  }
};

module.exports = {
  createAutomatedNotification,
};
