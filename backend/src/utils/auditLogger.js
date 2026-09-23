const AuditLog = require("../models/AuditLog");

/**
 * Create an audit log entry.
 *
 * This helper is intentionally non-blocking:
 * if audit logging fails, the main business operation
 * should not fail because of the audit system.
 */
const createAuditLog = async ({
  req = null,
  actor = null,
  actorRole = null,
  action,
  resourceType,
  resourceId = null,
  property = null,
  description,
  oldValues = null,
  newValues = null,
  metadata = {},
}) => {
  try {
    // ------------------------------------------------------------
    // Determine actor information
    // ------------------------------------------------------------

    const actorId = actor || (req && req.user ? req.user.userId : null);

    const role = actorRole || (req && req.user ? req.user.role : null);

    // ------------------------------------------------------------
    // Basic validation
    // ------------------------------------------------------------

    if (!actorId) {
      console.error("Audit log skipped: actor is missing");

      return null;
    }

    if (!role) {
      console.error("Audit log skipped: actor role is missing");

      return null;
    }

    if (!action) {
      console.error("Audit log skipped: action is missing");

      return null;
    }

    if (!resourceType) {
      console.error("Audit log skipped: resourceType is missing");

      return null;
    }

    if (!description) {
      console.error("Audit log skipped: description is missing");

      return null;
    }

    // ------------------------------------------------------------
    // Request information
    // ------------------------------------------------------------

    let ipAddress = null;
    let userAgent = null;

    if (req) {
      ipAddress =
        req.headers["x-forwarded-for"] || req.socket?.remoteAddress || null;

      if (Array.isArray(ipAddress)) {
        ipAddress = ipAddress[0];
      }

      if (typeof ipAddress === "string") {
        ipAddress = ipAddress.split(",")[0].trim();
      }

      userAgent = req.headers["user-agent"] || null;
    }

    // ------------------------------------------------------------
    // Create audit log
    // ------------------------------------------------------------

    const auditLog = await AuditLog.create({
      actor: actorId,
      actorRole: role,
      action,
      resourceType,
      resourceId,
      property,
      description,
      oldValues,
      newValues,
      metadata,
      ipAddress,
      userAgent,
    });

    return auditLog;
  } catch (error) {
    // ------------------------------------------------------------
    // Audit logging must never break the main operation
    // ------------------------------------------------------------

    console.error("Audit log creation failed:", error.message);

    return null;
  }
};

module.exports = createAuditLog;
