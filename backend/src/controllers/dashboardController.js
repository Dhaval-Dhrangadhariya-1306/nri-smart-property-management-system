const mongoose = require("mongoose");

const Property = require("../models/Property");
const CaretakerAssignment = require("../models/CaretakerAssignment");
const Inspection = require("../models/Inspection");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const MonitoringEvent = require("../models/MonitoringEvent");
const Expense = require("../models/Expense");
const Document = require("../models/Document");
const Notification = require("../models/Notification");

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
// GET OWNER DASHBOARD
// ============================================================

const getOwnerDashboard = async (req, res, next) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.userId);

    // --------------------------------------------------------
    // Get active properties
    // --------------------------------------------------------

    const properties = await Property.find({
      owner: ownerId,
      isActive: true,
      status: "ACTIVE",
    })
      .select(
        "title propertyType address status occupancy condition health caretaker lastInspectionAt nextInspectionAt lastMaintenanceAt",
      )
      .populate("caretaker", "name email role")
      .sort({ createdAt: -1 });

    const propertyIds = properties.map((property) => property._id);

    // --------------------------------------------------------
    // If owner has no properties
    // --------------------------------------------------------

    if (propertyIds.length === 0) {
      return res.status(200).json({
        success: true,
        dashboard: {
          overview: {
            totalProperties: 0,
            totalMaintenanceRequests: 0,
            openMaintenanceRequests: 0,
            criticalMonitoringEvents: 0,
            totalExpenses: 0,
            unreadNotifications: 0,
            documentsExpiringSoon: 0,
          },

          propertyHealth: {
            averageScore: 0,
            excellent: 0,
            good: 0,
            fair: 0,
            poor: 0,
            critical: 0,
          },

          properties: [],

          recentActivity: [],
        },
      });
    }

    // --------------------------------------------------------
    // Maintenance statistics
    // --------------------------------------------------------

    const maintenanceStats = await MaintenanceRequest.aggregate([
      {
        $match: {
          property: { $in: propertyIds },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },

          open: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD"],
                  ],
                },
                1,
                0,
              ],
            },
          },

          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // --------------------------------------------------------
    // Monitoring statistics
    // --------------------------------------------------------

    const monitoringStats = await MonitoringEvent.aggregate([
      {
        $match: {
          property: { $in: propertyIds },
          isResolved: false,
        },
      },
      {
        $group: {
          _id: null,

          critical: {
            $sum: {
              $cond: [{ $eq: ["$severity", "CRITICAL"] }, 1, 0],
            },
          },

          high: {
            $sum: {
              $cond: [{ $eq: ["$severity", "HIGH"] }, 1, 0],
            },
          },

          totalUnresolved: {
            $sum: 1,
          },
        },
      },
    ]);

    // --------------------------------------------------------
    // Expense statistics
    // --------------------------------------------------------

    const expenseStats = await Expense.aggregate([
      {
        $match: {
          property: { $in: propertyIds },
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalExpenses: { $sum: 1 },
        },
      },
    ]);

    // --------------------------------------------------------
    // Document expiry statistics
    // --------------------------------------------------------

    const now = new Date();

    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const documentsExpiringSoon = await Document.countDocuments({
      owner: ownerId,
      property: { $in: propertyIds },
      isActive: true,
      status: "ACTIVE",
      expiryDate: {
        $gte: now,
        $lte: thirtyDaysLater,
      },
    });

    // --------------------------------------------------------
    // Notification statistics
    // --------------------------------------------------------

    const unreadNotifications = await Notification.countDocuments({
      recipient: ownerId,
      isRead: false,
    });

    // --------------------------------------------------------
    // Property health statistics
    // --------------------------------------------------------

    const healthStats = await Property.aggregate([
      {
        $match: {
          owner: ownerId,
          isActive: true,
          status: "ACTIVE",
        },
      },
      {
        $group: {
          _id: null,

          averageScore: {
            $avg: "$health.score",
          },

          excellent: {
            $sum: {
              $cond: [{ $eq: ["$condition", "GOOD"] }, 1, 0],
            },
          },

          fair: {
            $sum: {
              $cond: [{ $eq: ["$condition", "FAIR"] }, 1, 0],
            },
          },

          needsAttention: {
            $sum: {
              $cond: [{ $eq: ["$condition", "NEEDS_ATTENTION"] }, 1, 0],
            },
          },

          critical: {
            $sum: {
              $cond: [{ $eq: ["$condition", "CRITICAL"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // --------------------------------------------------------
    // Recent inspections
    // --------------------------------------------------------

    const recentInspections = await Inspection.find({
      property: { $in: propertyIds },
    })
      .populate("property", "title")
      .populate("caretaker", "name email")
      .sort({ inspectedAt: -1 })
      .limit(5)
      .lean();

    // --------------------------------------------------------
    // Recent maintenance
    // --------------------------------------------------------

    const recentMaintenance = await MaintenanceRequest.find({
      property: { $in: propertyIds },
    })
      .populate("property", "title")
      .populate("assignedCaretaker", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // --------------------------------------------------------
    // Recent monitoring events
    // --------------------------------------------------------

    const recentMonitoring = await MonitoringEvent.find({
      property: { $in: propertyIds },
    })
      .populate("property", "title")
      .sort({ occurredAt: -1 })
      .limit(5)
      .lean();

    // --------------------------------------------------------
    // Recent expenses
    // --------------------------------------------------------

    const recentExpenses = await Expense.find({
      property: { $in: propertyIds },
      isActive: true,
    })
      .populate("property", "title")
      .sort({ expenseDate: -1 })
      .limit(5)
      .lean();

    // --------------------------------------------------------
    // Build unified recent activity
    // --------------------------------------------------------

    const recentActivity = [
      ...recentInspections.map((item) => ({
        type: "INSPECTION",
        date: item.inspectedAt || item.createdAt,
        property: item.property,
        data: item,
      })),

      ...recentMaintenance.map((item) => ({
        type: "MAINTENANCE",
        date: item.createdAt,
        property: item.property,
        data: item,
      })),

      ...recentMonitoring.map((item) => ({
        type: "MONITORING",
        date: item.occurredAt || item.createdAt,
        property: item.property,
        data: item,
      })),

      ...recentExpenses.map((item) => ({
        type: "EXPENSE",
        date: item.expenseDate || item.createdAt,
        property: item.property,
        data: item,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    // --------------------------------------------------------
    // Property health response
    // --------------------------------------------------------

    const health = healthStats[0] || {
      averageScore: 0,
      excellent: 0,
      fair: 0,
      needsAttention: 0,
      critical: 0,
    };

    // --------------------------------------------------------
    // Dashboard response
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      dashboard: {
        overview: {
          totalProperties: properties.length,

          totalMaintenanceRequests: maintenanceStats[0]?.total || 0,

          openMaintenanceRequests: maintenanceStats[0]?.open || 0,

          completedMaintenanceRequests: maintenanceStats[0]?.completed || 0,

          criticalMonitoringEvents: monitoringStats[0]?.critical || 0,

          highMonitoringEvents: monitoringStats[0]?.high || 0,

          unresolvedMonitoringEvents: monitoringStats[0]?.totalUnresolved || 0,

          totalExpenses: expenseStats[0]?.totalExpenses || 0,

          totalExpenseAmount: expenseStats[0]?.totalAmount || 0,

          unreadNotifications,

          documentsExpiringSoon,
        },

        propertyHealth: {
          averageScore: Number((health.averageScore || 0).toFixed(2)),

          good: health.excellent || 0,

          fair: health.fair || 0,

          needsAttention: health.needsAttention || 0,

          critical: health.critical || 0,
        },

        properties,

        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET SINGLE PROPERTY INTELLIGENCE
// ============================================================

const getPropertyIntelligence = async (req, res, next) => {
  try {
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      throw createError("Invalid property ID", 400);
    }

    // --------------------------------------------------------
    // Verify property ownership
    // --------------------------------------------------------

    const property = await Property.findOne({
      _id: propertyId,
      owner: req.user.userId,
      isActive: true,
      status: "ACTIVE",
    })
      .populate("caretaker", "name email role")
      .lean();

    if (!property) {
      throw createError("Property not found or access denied", 404);
    }

    const propertyObjectId = new mongoose.Types.ObjectId(propertyId);

    // --------------------------------------------------------
    // Maintenance
    // --------------------------------------------------------

    const maintenanceStats = await MaintenanceRequest.aggregate([
      {
        $match: {
          property: propertyObjectId,
        },
      },
      {
        $group: {
          _id: null,

          total: { $sum: 1 },

          open: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD"],
                  ],
                },
                1,
                0,
              ],
            },
          },

          urgent: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $in: [
                        "$status",
                        ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD"],
                      ],
                    },
                    { $eq: ["$priority", "URGENT"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // --------------------------------------------------------
    // Monitoring
    // --------------------------------------------------------

    const monitoringStats = await MonitoringEvent.aggregate([
      {
        $match: {
          property: propertyObjectId,
          isResolved: false,
        },
      },
      {
        $group: {
          _id: null,

          total: { $sum: 1 },

          critical: {
            $sum: {
              $cond: [{ $eq: ["$severity", "CRITICAL"] }, 1, 0],
            },
          },

          high: {
            $sum: {
              $cond: [{ $eq: ["$severity", "HIGH"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // --------------------------------------------------------
    // Expenses
    // --------------------------------------------------------

    const expenseStats = await Expense.aggregate([
      {
        $match: {
          property: propertyObjectId,
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalExpenses: { $sum: 1 },
        },
      },
    ]);

    // --------------------------------------------------------
    // Documents
    // --------------------------------------------------------

    const now = new Date();

    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const documentStats = await Document.aggregate([
      {
        $match: {
          property: propertyObjectId,
          owner: new mongoose.Types.ObjectId(req.user.userId),
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,

          total: { $sum: 1 },

          expiringSoon: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$expiryDate", null] },
                    {
                      $gte: ["$expiryDate", now],
                    },
                    {
                      $lte: ["$expiryDate", thirtyDaysLater],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // --------------------------------------------------------
    // Latest inspection
    // --------------------------------------------------------

    const latestInspection = await Inspection.findOne({
      property: propertyObjectId,
    })
      .populate("caretaker", "name email")
      .sort({ inspectedAt: -1 })
      .lean();

    // --------------------------------------------------------
    // Recent maintenance
    // --------------------------------------------------------

    const recentMaintenance = await MaintenanceRequest.find({
      property: propertyObjectId,
    })
      .populate("assignedCaretaker", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // --------------------------------------------------------
    // Recent monitoring
    // --------------------------------------------------------

    const recentMonitoring = await MonitoringEvent.find({
      property: propertyObjectId,
    })
      .sort({ occurredAt: -1 })
      .limit(5)
      .lean();

    // --------------------------------------------------------
    // Recent expenses
    // --------------------------------------------------------

    const recentExpenses = await Expense.find({
      property: propertyObjectId,
      isActive: true,
    })
      .sort({ expenseDate: -1 })
      .limit(5)
      .lean();

    // --------------------------------------------------------
    // Property intelligence score
    // --------------------------------------------------------

    let intelligenceScore = property.health?.score || 0;

    const maintenance = maintenanceStats[0] || {};
    const monitoring = monitoringStats[0] || {};

    if (maintenance.urgent > 0) {
      intelligenceScore -= 15;
    }

    if (monitoring.critical > 0) {
      intelligenceScore -= 20;
    } else if (monitoring.high > 0) {
      intelligenceScore -= 10;
    }

    intelligenceScore = Math.max(0, Math.min(100, intelligenceScore));

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      intelligence: {
        property,

        health: {
          score: property.health?.score || 0,
          calculatedIntelligenceScore: intelligenceScore,
          condition: property.condition,
          occupancy: property.occupancy,
        },

        maintenance: {
          total: maintenance.total || 0,
          open: maintenance.open || 0,
          urgent: maintenance.urgent || 0,
        },

        monitoring: {
          unresolved: monitoring.total || 0,
          critical: monitoring.critical || 0,
          high: monitoring.high || 0,
        },

        expenses: {
          totalExpenses: expenseStats[0]?.totalExpenses || 0,
          totalAmount: expenseStats[0]?.totalAmount || 0,
        },

        documents: {
          total: documentStats[0]?.total || 0,
          expiringSoon: documentStats[0]?.expiringSoon || 0,
        },

        latestInspection,

        recentMaintenance,

        recentMonitoring,

        recentExpenses,
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
  getOwnerDashboard,
  getPropertyIntelligence,
};
