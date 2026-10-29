const express = require("express");

const {
  getOwnerDashboard,
  getPropertyIntelligence,
  getFinancialDashboard,
  getPropertyHealthDashboard,
  getCaretakerPerformanceDashboard,
} = require("../controllers/dashboardController");

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dashboards
 *   description: Owner dashboard, financial analytics, property intelligence, and caretaker performance
 */

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authMiddleware);

// ============================================================
// OWNER DASHBOARD
// ============================================================

/**
 * @swagger
 * /api/dashboard/owner:
 *   get:
 *     summary: Get owner dashboard
 *     operationId: getOwnerDashboard
 *     description: Retrieves dashboard information for the authenticated property owner.
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Owner dashboard retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get("/owner", authorize("NRI_OWNER", "ADMIN"), getOwnerDashboard);

// ============================================================
// PROPERTY INTELLIGENCE
// ============================================================

/**
 * @swagger
 * /api/dashboard/property/{propertyId}:
 *   get:
 *     summary: Get property intelligence
 *     operationId: getPropertyIntelligence
 *     description: Retrieves intelligence and analytical information for a specific property.
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ID of the property.
 *     responses:
 *       200:
 *         description: Property intelligence retrieved successfully
 *       400:
 *         description: Invalid property ID
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions or property access denied
 *       404:
 *         description: Property not found
 */
router.get(
  "/property/:propertyId",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyIntelligence,
);

// ============================================================
// FINANCIAL DASHBOARD
// ============================================================

/**
 * @swagger
 * /api/dashboard/financial:
 *   get:
 *     summary: Get financial dashboard
 *     operationId: getFinancialDashboard
 *     description: Retrieves financial analytics for the authenticated property owner.
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Financial dashboard retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  "/financial",
  authorize("NRI_OWNER", "ADMIN"),
  getFinancialDashboard,
);

// ============================================================
// PROPERTY HEALTH DASHBOARD
// ============================================================

/**
 * @swagger
 * /api/dashboard/property-health:
 *   get:
 *     summary: Get property health dashboard
 *     operationId: getPropertyHealthDashboard
 *     description: Retrieves property health metrics and related dashboard information.
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Property health dashboard retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  "/property-health",
  authorize("NRI_OWNER", "ADMIN"),
  getPropertyHealthDashboard,
);

// ============================================================
// CARETAKER PERFORMANCE DASHBOARD
// ============================================================

/**
 * @swagger
 * /api/dashboard/caretaker-performance:
 *   get:
 *     summary: Get caretaker performance dashboard
 *     operationId: getCaretakerPerformanceDashboard
 *     description: Retrieves caretaker performance metrics for the authenticated owner.
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Caretaker performance dashboard retrieved successfully
 *       401:
 *         description: Authentication required or token invalid
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  "/caretaker-performance",
  authorize("NRI_OWNER", "ADMIN"),
  getCaretakerPerformanceDashboard,
);

module.exports = router;
