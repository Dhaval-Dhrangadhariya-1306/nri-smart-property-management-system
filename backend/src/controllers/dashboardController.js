const mongoose = require("mongoose");

const Property = require("../models/Property");
const Inspection = require("../models/Inspection");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const MonitoringEvent = require("../models/MonitoringEvent");
const Expense = require("../models/Expense");
const Document = require("../models/Document");
const Notification = require("../models/Notification");

// ============================================================
// OWNER DASHBOARD
// ============================================================

const getOwnerDashboard = async (req, res, next) => {
  try {
    const ownerId = req.user.userId;
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    // --------------------------------------------------------
    // OWNER PROPERTIES
    // --------------------------------------------------------

    const properties = await Property.find({
      owner: ownerId,
      isActive: true,
    })
      .select(
        "_id title propertyType address status occupancy condition health caretaker lastInspectionAt nextInspectionAt",
      )
      .populate("caretaker", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    const propertyIds = properties.map((property) => property._id);

    // --------------------------------------------------------
    // EMPTY DASHBOARD
    // --------------------------------------------------------

    if (propertyIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Owner dashboard retrieved successfully",
        data: {
          summary: {
            totalProperties: 0,
            activeProperties: 0,
            vacantProperties: 0,
            occupiedProperties: 0,
            averageHealthScore: 0,
            openMaintenanceRequests: 0,
            unresolvedMonitoringEvents: 0,
            totalExpenses: 0,
            unreadNotifications: 0,
            expiringDocuments: 0,
          },

          properties: [],
          recentInspections: [],
          recentMaintenance: [],
          recentMonitoringEvents: [],
          recentExpenses: [],
          recentActivity: [],
        },
      });
    }

    // --------------------------------------------------------
    // PARALLEL QUERIES
    // --------------------------------------------------------

    const [
      maintenanceStats,
      monitoringStats,
      expenseStats,
      notificationStats,
      documentStats,
      recentInspections,
      recentMaintenance,
      recentMonitoringEvents,
      recentExpenses,
    ] = await Promise.all([
      // ------------------------------------------------------
      // MAINTENANCE SUMMARY
      // ------------------------------------------------------

      MaintenanceRequest.aggregate([
        {
          $match: {
            property: {
              $in: propertyIds,
            },
          },
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: 1,
            },

            open: {
              $sum: {
                $cond: [
                  {
                    $in: ["$status", ["OPEN", "ASSIGNED", "IN_PROGRESS"]],
                  },

                  1,

                  0,
                ],
              },
            },
          },
        },
      ]),

      // ------------------------------------------------------
      // MONITORING SUMMARY
      // ------------------------------------------------------

      MonitoringEvent.aggregate([
        {
          $match: {
            owner: ownerObjectId,

            property: {
              $in: propertyIds,
            },

            isResolved: false,
          },
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: 1,
            },
          },
        },
      ]),

      // ------------------------------------------------------
      // EXPENSE SUMMARY
      // ------------------------------------------------------

      Expense.aggregate([
        {
          $match: {
            owner: ownerObjectId,

            property: {
              $in: propertyIds,
            },

            isActive: true,
          },
        },

        {
          $group: {
            _id: null,

            total: {
              $sum: "$amount",
            },
          },
        },
      ]),

      // ------------------------------------------------------
      // UNREAD NOTIFICATIONS
      // ------------------------------------------------------

      Notification.countDocuments({
        recipient: ownerId,
        isRead: false,
      }),

      // ------------------------------------------------------
      // EXPIRING DOCUMENTS
      // ------------------------------------------------------

      Document.countDocuments({
        owner: ownerId,

        property: {
          $in: propertyIds,
        },

        isActive: true,

        expiryDate: {
          $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),

      // ------------------------------------------------------
      // RECENT INSPECTIONS
      // ------------------------------------------------------

      Inspection.find({
        property: {
          $in: propertyIds,
        },

        status: "COMPLETED",
      })
        .populate("property", "title propertyType")
        .populate("caretaker", "name email role")
        .select(
          "property caretaker overallCondition securityStatus electricalStatus plumbingStatus cleanliness issuesFound inspectedAt status",
        )
        .sort({
          inspectedAt: -1,
        })
        .limit(10)
        .lean(),

      // ------------------------------------------------------
      // RECENT MAINTENANCE
      // ------------------------------------------------------

      MaintenanceRequest.find({
        property: {
          $in: propertyIds,
        },
      })
        .populate("property", "title")
        .populate("assignedVendor", "name category phone email")
        .select(
          "property title description category priority status estimatedCost actualCost assignedVendor createdAt updatedAt",
        )
        .sort({
          createdAt: -1,
        })
        .limit(10)
        .lean(),

      // ------------------------------------------------------
      // RECENT MONITORING
      // ------------------------------------------------------

      MonitoringEvent.find({
        owner: ownerId,

        property: {
          $in: propertyIds,
        },
      })
        .populate("property", "title")
        .select(
          "property eventType severity title description source isAcknowledged isResolved occurredAt",
        )
        .sort({
          occurredAt: -1,
        })
        .limit(10)
        .lean(),

      // ------------------------------------------------------
      // RECENT EXPENSES
      // ------------------------------------------------------

      Expense.find({
        owner: ownerId,

        property: {
          $in: propertyIds,
        },

        isActive: true,
      })
        .populate("property", "title")
        .populate("maintenanceRequest", "title status category")
        .select(
          "property maintenanceRequest title category amount expenseDate paymentStatus paymentMethod createdAt",
        )
        .sort({
          expenseDate: -1,
        })
        .limit(10)
        .lean(),
    ]);

    // --------------------------------------------------------
    // HEALTH
    // --------------------------------------------------------

    const totalHealthScore = properties.reduce(
      (sum, property) => sum + (property.health?.score || 0),
      0,
    );

    const averageHealthScore =
      properties.length > 0
        ? Number((totalHealthScore / properties.length).toFixed(2))
        : 0;

    // --------------------------------------------------------
    // PROPERTY SUMMARY
    // --------------------------------------------------------

    const activeProperties = properties.filter(
      (property) => property.status === "ACTIVE",
    ).length;

    const vacantProperties = properties.filter(
      (property) => property.occupancy === "VACANT",
    ).length;

    const occupiedProperties = properties.filter(
      (property) => property.occupancy === "OCCUPIED",
    ).length;

    // --------------------------------------------------------
    // RECENT ACTIVITY
    // --------------------------------------------------------

    const recentActivity = [
      ...recentInspections.map((item) => ({
        type: "INSPECTION",
        date: item.inspectedAt,
        title: "Property inspection completed",
        property: item.property,
        data: item,
      })),

      ...recentMaintenance.map((item) => ({
        type: "MAINTENANCE",
        date: item.createdAt,
        title: item.title,
        property: item.property,
        data: item,
      })),

      ...recentMonitoringEvents.map((item) => ({
        type: "MONITORING",
        date: item.occurredAt,
        title: item.title,
        property: item.property,
        data: item,
      })),

      ...recentExpenses.map((item) => ({
        type: "EXPENSE",
        date: item.expenseDate,
        title: item.title,
        property: item.property,
        data: item,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20);

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Owner dashboard retrieved successfully",

      data: {
        summary: {
          totalProperties: properties.length,

          activeProperties,

          vacantProperties,

          occupiedProperties,

          averageHealthScore,

          openMaintenanceRequests: maintenanceStats[0]?.open || 0,

          unresolvedMonitoringEvents: monitoringStats[0]?.total || 0,

          totalExpenses: expenseStats[0]?.total || 0,

          unreadNotifications: notificationStats,

          expiringDocuments: documentStats,
        },

        properties,

        recentInspections,

        recentMaintenance,

        recentMonitoringEvents,

        recentExpenses,

        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PROPERTY INTELLIGENCE
// ============================================================

const getPropertyIntelligence = async (req, res, next) => {
  try {
    const ownerId = req.user.userId;

    const { propertyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property ID",
      });
    }

    const property = await Property.findOne({
      _id: propertyId,

      owner: ownerId,

      isActive: true,
    })
      .populate("caretaker", "name email role")
      .lean();

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const [maintenance, monitoring, expenses, documents, latestInspection] =
      await Promise.all([
        // ------------------------------------------------------
        // MAINTENANCE
        // ------------------------------------------------------

        MaintenanceRequest.find({
          property: propertyId,
        })
          .populate("assignedVendor", "name category phone email")
          .sort({
            createdAt: -1,
          })
          .limit(10)
          .lean(),

        // ------------------------------------------------------
        // MONITORING
        // ------------------------------------------------------

        MonitoringEvent.find({
          property: propertyId,

          owner: ownerId,
        })
          .sort({
            occurredAt: -1,
          })
          .limit(10)
          .lean(),

        // ------------------------------------------------------
        // EXPENSES
        // ------------------------------------------------------

        Expense.find({
          property: propertyId,

          owner: ownerId,

          isActive: true,
        })
          .sort({
            expenseDate: -1,
          })
          .limit(10)
          .lean(),

        // ------------------------------------------------------
        // DOCUMENTS
        // ------------------------------------------------------

        Document.find({
          property: propertyId,

          owner: ownerId,

          isActive: true,
        })
          .sort({
            expiryDate: 1,
          })
          .limit(10)
          .lean(),

        // ------------------------------------------------------
        // LATEST INSPECTION
        // ------------------------------------------------------

        Inspection.findOne({
          property: propertyId,

          status: "COMPLETED",
        })
          .populate("caretaker", "name email role")
          .sort({
            inspectedAt: -1,
          })
          .lean(),
      ]);

    const openMaintenance = maintenance.filter(
      (item) => !["COMPLETED", "CANCELLED"].includes(item.status),
    );

    const unresolvedMonitoring = monitoring.filter((item) => !item.isResolved);

    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + (expense.amount || 0),
      0,
    );

    const intelligenceScore = Math.max(
      0,
      Math.min(
        100,

        (property.health?.score || 0) -
          openMaintenance.length * 5 -
          unresolvedMonitoring.length * 5,
      ),
    );

    return res.status(200).json({
      success: true,

      message: "Property intelligence retrieved successfully",

      data: {
        property,

        intelligence: {
          score: intelligenceScore,

          healthScore: property.health?.score || 0,

          openMaintenance: openMaintenance.length,

          unresolvedMonitoring: unresolvedMonitoring.length,

          recentExpenseTotal: totalExpenses,
        },

        latestInspection,

        maintenance,

        monitoring,

        expenses,

        documents,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// FINANCIAL DASHBOARD
// ============================================================

const getFinancialDashboard = async (req, res, next) => {
  try {
    const ownerId = req.user.userId;

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    // --------------------------------------------------------
    // OWNER PROPERTIES
    // --------------------------------------------------------

    const properties = await Property.find({
      owner: ownerId,

      isActive: true,
    })
      .select("_id title propertyType")
      .lean();

    const propertyIds = properties.map((property) => property._id);

    // --------------------------------------------------------
    // EMPTY DASHBOARD
    // --------------------------------------------------------

    if (!propertyIds.length) {
      return res.status(200).json({
        success: true,

        message: "Financial dashboard retrieved successfully",

        data: {
          summary: {
            totalExpenses: 0,
            expenseCount: 0,
            averageExpense: 0,
            paidAmount: 0,
            pendingAmount: 0,
            partiallyPaidAmount: 0,
            cancelledAmount: 0,
          },

          expenseByCategory: [],

          monthlyTrend: [],

          paymentStatusBreakdown: [],

          propertySpending: [],

          maintenanceCosts: {
            totalRequests: 0,
            estimatedCost: 0,
            actualCost: 0,
            openEstimatedCost: 0,
            completedActualCost: 0,
          },

          recentExpenses: [],

          topExpenses: [],
        },
      });
    }

    // --------------------------------------------------------
    // EXPENSE MATCH
    // IMPORTANT:
    // owner uses ObjectId because this is used
    // inside MongoDB aggregation pipelines.
    // --------------------------------------------------------

    const expenseMatch = {
      owner: ownerObjectId,

      property: {
        $in: propertyIds,
      },

      isActive: true,
    };

    // --------------------------------------------------------
    // PARALLEL ANALYTICS
    // --------------------------------------------------------

    const [
      summary,
      expenseByCategory,
      monthlyTrend,
      paymentStatusBreakdown,
      propertySpending,
      maintenanceCosts,
      recentExpenses,
      topExpenses,
    ] = await Promise.all([
      // ------------------------------------------------------
      // SUMMARY
      // ------------------------------------------------------

      Expense.aggregate([
        {
          $match: expenseMatch,
        },

        {
          $group: {
            _id: null,

            totalExpenses: {
              $sum: "$amount",
            },

            expenseCount: {
              $sum: 1,
            },

            averageExpense: {
              $avg: "$amount",
            },

            paidAmount: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$paymentStatus", "PAID"],
                  },

                  "$amount",

                  0,
                ],
              },
            },

            pendingAmount: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$paymentStatus", "PENDING"],
                  },

                  "$amount",

                  0,
                ],
              },
            },

            partiallyPaidAmount: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$paymentStatus", "PARTIALLY_PAID"],
                  },

                  "$amount",

                  0,
                ],
              },
            },

            cancelledAmount: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$paymentStatus", "CANCELLED"],
                  },

                  "$amount",

                  0,
                ],
              },
            },
          },
        },
      ]),

      // ------------------------------------------------------
      // EXPENSE BY CATEGORY
      // ------------------------------------------------------

      Expense.aggregate([
        {
          $match: expenseMatch,
        },

        {
          $group: {
            _id: "$category",

            totalAmount: {
              $sum: "$amount",
            },

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            totalAmount: -1,
          },
        },
      ]),

      // ------------------------------------------------------
      // MONTHLY TREND
      // ------------------------------------------------------

      Expense.aggregate([
        {
          $match: expenseMatch,
        },

        {
          $group: {
            _id: {
              year: {
                $year: "$expenseDate",
              },

              month: {
                $month: "$expenseDate",
              },
            },

            totalAmount: {
              $sum: "$amount",
            },

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            "_id.year": 1,

            "_id.month": 1,
          },
        },

        {
          $limit: 12,
        },
      ]),

      // ------------------------------------------------------
      // PAYMENT STATUS
      // ------------------------------------------------------

      Expense.aggregate([
        {
          $match: expenseMatch,
        },

        {
          $group: {
            _id: "$paymentStatus",

            amount: {
              $sum: "$amount",
            },

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            amount: -1,
          },
        },
      ]),

      // ------------------------------------------------------
      // PROPERTY SPENDING
      // ------------------------------------------------------

      Expense.aggregate([
        {
          $match: expenseMatch,
        },

        {
          $group: {
            _id: "$property",

            totalAmount: {
              $sum: "$amount",
            },

            count: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            totalAmount: -1,
          },
        },
      ]),

      // ------------------------------------------------------
      // MAINTENANCE COSTS
      // ------------------------------------------------------

      MaintenanceRequest.aggregate([
        {
          $match: {
            property: {
              $in: propertyIds,
            },
          },
        },

        {
          $group: {
            _id: null,

            totalRequests: {
              $sum: 1,
            },

            estimatedCost: {
              $sum: {
                $ifNull: ["$estimatedCost", 0],
              },
            },

            actualCost: {
              $sum: {
                $ifNull: ["$actualCost", 0],
              },
            },

            openEstimatedCost: {
              $sum: {
                $cond: [
                  {
                    $not: {
                      $in: ["$status", ["COMPLETED", "CANCELLED"]],
                    },
                  },

                  {
                    $ifNull: ["$estimatedCost", 0],
                  },

                  0,
                ],
              },
            },

            completedActualCost: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", "COMPLETED"],
                  },

                  {
                    $ifNull: ["$actualCost", 0],
                  },

                  0,
                ],
              },
            },
          },
        },
      ]),

      // ------------------------------------------------------
      // RECENT EXPENSES
      // ------------------------------------------------------

      Expense.find({
        owner: ownerId,

        property: {
          $in: propertyIds,
        },

        isActive: true,
      })
        .populate("property", "title propertyType")
        .populate("maintenanceRequest", "title status category")
        .sort({
          expenseDate: -1,
        })
        .limit(10)
        .lean(),

      // ------------------------------------------------------
      // TOP EXPENSES
      // ------------------------------------------------------

      Expense.find({
        owner: ownerId,

        property: {
          $in: propertyIds,
        },

        isActive: true,
      })
        .populate("property", "title propertyType")
        .populate("maintenanceRequest", "title status category")
        .sort({
          amount: -1,
        })
        .limit(10)
        .lean(),
    ]);

    // --------------------------------------------------------
    // SUMMARY DATA
    // --------------------------------------------------------

    const summaryData = summary[0] || {
      totalExpenses: 0,
      expenseCount: 0,
      averageExpense: 0,
      paidAmount: 0,
      pendingAmount: 0,
      partiallyPaidAmount: 0,
      cancelledAmount: 0,
    };

    // --------------------------------------------------------
    // PROPERTY MAP
    // --------------------------------------------------------

    const propertyMap = new Map(
      properties.map((property) => [property._id.toString(), property]),
    );

    const formattedPropertySpending = propertySpending.map((item) => ({
      property: propertyMap.get(item._id.toString()) || null,

      totalAmount: item.totalAmount,

      count: item.count,
    }));

    // --------------------------------------------------------
    // MAINTENANCE SUMMARY
    // --------------------------------------------------------

    const maintenanceSummary = maintenanceCosts[0] || {
      totalRequests: 0,
      estimatedCost: 0,
      actualCost: 0,
      openEstimatedCost: 0,
      completedActualCost: 0,
    };

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      message: "Financial dashboard retrieved successfully",

      data: {
        summary: {
          totalExpenses: summaryData.totalExpenses || 0,

          expenseCount: summaryData.expenseCount || 0,

          averageExpense: Number((summaryData.averageExpense || 0).toFixed(2)),

          paidAmount: summaryData.paidAmount || 0,

          pendingAmount: summaryData.pendingAmount || 0,

          partiallyPaidAmount: summaryData.partiallyPaidAmount || 0,

          cancelledAmount: summaryData.cancelledAmount || 0,
        },

        expenseByCategory,

        monthlyTrend,

        paymentStatusBreakdown,

        propertySpending: formattedPropertySpending,

        maintenanceCosts: maintenanceSummary,

        recentExpenses,

        topExpenses,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PROPERTY HEALTH DASHBOARD
// ============================================================

const getPropertyHealthDashboard = async (req, res, next) => {
  try {
    const ownerId = req.user.userId;

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

    // --------------------------------------------------------
    // GET OWNER PROPERTIES
    // --------------------------------------------------------

    const properties = await Property.find({
      owner: ownerId,

      isActive: true,
    })
      .select(
        "_id title propertyType address status occupancy condition health caretaker lastInspectionAt nextInspectionAt",
      )
      .populate("caretaker", "name email role")
      .sort({
        "health.score": 1,
        title: 1,
      })
      .lean();

    const propertyIds = properties.map((property) => property._id);

    // --------------------------------------------------------
    // NO PROPERTIES
    // --------------------------------------------------------

    if (propertyIds.length === 0) {
      return res.status(200).json({
        success: true,

        message: "Property health dashboard retrieved successfully",

        data: {
          summary: {
            totalProperties: 0,
            averageHealthScore: 0,
            healthyProperties: 0,
            fairProperties: 0,
            attentionRequired: 0,
            criticalProperties: 0,
          },

          healthDistribution: {
            GOOD: 0,
            FAIR: 0,
            NEEDS_ATTENTION: 0,
            CRITICAL: 0,
          },

          properties: [],

          propertiesNeedingAttention: [],

          healthTrend: [],

          recentInspections: [],
        },
      });
    }

    // --------------------------------------------------------
    // PARALLEL ANALYTICS
    // --------------------------------------------------------

    const [
      latestInspectionStats,
      maintenanceStats,
      monitoringStats,
      recentInspections,
      healthTrend,
    ] = await Promise.all([
      // ------------------------------------------------------
      // LATEST INSPECTION
      // ------------------------------------------------------

      Inspection.aggregate([
        {
          $match: {
            property: {
              $in: propertyIds,
            },

            status: "COMPLETED",
          },
        },

        {
          $sort: {
            property: 1,
            inspectedAt: -1,
          },
        },

        {
          $group: {
            _id: "$property",

            latestInspection: {
              $first: "$$ROOT",
            },
          },
        },

        // ------------------------------------------------------
        // POPULATE CARETAKER
        // ------------------------------------------------------

        {
          $lookup: {
            from: "users",
            localField: "latestInspection.caretaker",
            foreignField: "_id",
            as: "latestCaretaker",
          },
        },

        {
          $unwind: {
            path: "$latestCaretaker",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $set: {
            "latestInspection.caretaker": {
              _id: "$latestCaretaker._id",
              name: "$latestCaretaker.name",
              email: "$latestCaretaker.email",
              role: "$latestCaretaker.role",
            },
          },
        },

        {
          $project: {
            latestCaretaker: 0,
          },
        },
      ]),

      // ------------------------------------------------------
      // MAINTENANCE PRESSURE
      // ------------------------------------------------------

      MaintenanceRequest.aggregate([
        {
          $match: {
            property: {
              $in: propertyIds,
            },

            status: {
              $nin: ["COMPLETED", "CANCELLED"],
            },
          },
        },

        {
          $group: {
            _id: "$property",

            openMaintenanceCount: {
              $sum: 1,
            },

            highPriorityCount: {
              $sum: {
                $cond: [
                  {
                    $in: ["$priority", ["HIGH", "URGENT", "CRITICAL"]],
                  },

                  1,

                  0,
                ],
              },
            },

            estimatedCost: {
              $sum: {
                $ifNull: ["$estimatedCost", 0],
              },
            },
          },
        },
      ]),

      // ------------------------------------------------------
      // MONITORING PRESSURE
      // ------------------------------------------------------

      MonitoringEvent.aggregate([
        {
          $match: {
            owner: ownerObjectId,

            property: {
              $in: propertyIds,
            },

            isResolved: false,
          },
        },

        {
          $group: {
            _id: "$property",

            unresolvedEvents: {
              $sum: 1,
            },

            highSeverityEvents: {
              $sum: {
                $cond: [
                  {
                    $in: ["$severity", ["HIGH", "CRITICAL"]],
                  },

                  1,

                  0,
                ],
              },
            },

            criticalEvents: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$severity", "CRITICAL"],
                  },

                  1,

                  0,
                ],
              },
            },
          },
        },
      ]),

      // ------------------------------------------------------
      // RECENT INSPECTIONS
      // ------------------------------------------------------

      Inspection.find({
        property: {
          $in: propertyIds,
        },

        status: "COMPLETED",
      })
        .populate("property", "title propertyType")
        .populate("caretaker", "name email role")
        .select(
          "property caretaker overallCondition securityStatus electricalStatus plumbingStatus cleanliness issuesFound notes inspectedAt status",
        )
        .sort({
          inspectedAt: -1,
        })
        .limit(10)
        .lean(),

      // ------------------------------------------------------
      // HEALTH TREND
      // ------------------------------------------------------

      Inspection.aggregate([
        {
          $match: {
            property: {
              $in: propertyIds,
            },

            status: "COMPLETED",
          },
        },

        {
          $addFields: {
            conditionScore: {
              $switch: {
                branches: [
                  {
                    case: {
                      $eq: ["$overallCondition", "EXCELLENT"],
                    },

                    then: 100,
                  },

                  {
                    case: {
                      $eq: ["$overallCondition", "GOOD"],
                    },

                    then: 85,
                  },

                  {
                    case: {
                      $eq: ["$overallCondition", "FAIR"],
                    },

                    then: 70,
                  },

                  {
                    case: {
                      $eq: ["$overallCondition", "POOR"],
                    },

                    then: 45,
                  },

                  {
                    case: {
                      $eq: ["$overallCondition", "CRITICAL"],
                    },

                    then: 20,
                  },
                ],

                default: 0,
              },
            },
          },
        },

        {
          $group: {
            _id: {
              year: {
                $year: "$inspectedAt",
              },

              month: {
                $month: "$inspectedAt",
              },
            },

            averageInspectionScore: {
              $avg: "$conditionScore",
            },

            inspectionCount: {
              $sum: 1,
            },
          },
        },

        {
          $sort: {
            "_id.year": 1,

            "_id.month": 1,
          },
        },

        {
          $project: {
            _id: 0,

            year: "$_id.year",

            month: "$_id.month",

            averageInspectionScore: {
              $round: ["$averageInspectionScore", 2],
            },

            inspectionCount: 1,
          },
        },
      ]),
    ]);

    // --------------------------------------------------------
    // MAP ANALYTICS
    // --------------------------------------------------------

    const latestInspectionMap = new Map(
      latestInspectionStats.map((item) => [
        item._id.toString(),

        item.latestInspection,
      ]),
    );

    const maintenanceMap = new Map(
      maintenanceStats.map((item) => [item._id.toString(), item]),
    );

    const monitoringMap = new Map(
      monitoringStats.map((item) => [item._id.toString(), item]),
    );

    // --------------------------------------------------------
    // PROPERTY HEALTH
    // --------------------------------------------------------

    const propertyHealth = properties.map((property) => {
      const propertyId = property._id.toString();

      const latestInspection = latestInspectionMap.get(propertyId) || null;

      const maintenance = maintenanceMap.get(propertyId) || {
        openMaintenanceCount: 0,
        highPriorityCount: 0,
        estimatedCost: 0,
      };

      const monitoring = monitoringMap.get(propertyId) || {
        unresolvedEvents: 0,
        highSeverityEvents: 0,
        criticalEvents: 0,
      };

      const healthScore =
        typeof property.health?.score === "number" ? property.health.score : 0;

      // --------------------------------------------------
      // HEALTH CATEGORY
      // --------------------------------------------------

      let healthCategory = "CRITICAL";

      if (healthScore >= 80) {
        healthCategory = "GOOD";
      } else if (healthScore >= 60) {
        healthCategory = "FAIR";
      } else if (healthScore >= 40) {
        healthCategory = "NEEDS_ATTENTION";
      }

      // --------------------------------------------------
      // ATTENTION FLAG
      // --------------------------------------------------

      const needsAttention =
        healthScore < 60 ||
        maintenance.openMaintenanceCount > 0 ||
        monitoring.unresolvedEvents > 0;

      return {
        property: {
          id: property._id,

          title: property.title,

          propertyType: property.propertyType,

          address: property.address,

          status: property.status,

          occupancy: property.occupancy,

          condition: property.condition,

          caretaker: property.caretaker,
        },

        health: {
          score: healthScore,

          category: healthCategory,

          lastCalculatedAt: property.health?.lastCalculatedAt || null,

          lastInspectionAt: property.lastInspectionAt || null,

          nextInspectionAt: property.nextInspectionAt || null,
        },

        latestInspection: latestInspection
          ? {
              id: latestInspection._id,

              overallCondition: latestInspection.overallCondition,

              securityStatus: latestInspection.securityStatus,

              electricalStatus: latestInspection.electricalStatus,

              plumbingStatus: latestInspection.plumbingStatus,

              cleanliness: latestInspection.cleanliness,

              issueCount: latestInspection.issuesFound?.length || 0,

              inspectedAt: latestInspection.inspectedAt,

              caretaker: latestInspection.caretaker,
            }
          : null,

        maintenancePressure: {
          openRequests: maintenance.openMaintenanceCount,

          highPriorityRequests: maintenance.highPriorityCount,

          estimatedOpenCost: maintenance.estimatedCost,
        },

        monitoringPressure: {
          unresolvedEvents: monitoring.unresolvedEvents,

          highSeverityEvents: monitoring.highSeverityEvents,

          criticalEvents: monitoring.criticalEvents,
        },

        needsAttention,
      };
    });

    // --------------------------------------------------------
    // OVERALL HEALTH
    // --------------------------------------------------------

    const totalProperties = propertyHealth.length;

    const totalHealthScore = propertyHealth.reduce(
      (sum, property) => sum + property.health.score,
      0,
    );

    const averageHealthScore =
      totalProperties > 0
        ? Number((totalHealthScore / totalProperties).toFixed(2))
        : 0;

    // --------------------------------------------------------
    // HEALTH DISTRIBUTION
    // --------------------------------------------------------

    const healthDistribution = {
      GOOD: 0,

      FAIR: 0,

      NEEDS_ATTENTION: 0,

      CRITICAL: 0,
    };

    propertyHealth.forEach((property) => {
      healthDistribution[property.health.category]++;
    });

    // --------------------------------------------------------
    // PROPERTIES NEEDING ATTENTION
    // --------------------------------------------------------

    const propertiesNeedingAttention = propertyHealth
      .filter((property) => property.needsAttention)
      .sort((a, b) => {
        if (a.health.score !== b.health.score) {
          return a.health.score - b.health.score;
        }

        return (
          b.monitoringPressure.unresolvedEvents -
          a.monitoringPressure.unresolvedEvents
        );
      });

    // --------------------------------------------------------
    // FINAL RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,

      message: "Property health dashboard retrieved successfully",

      data: {
        summary: {
          totalProperties,

          averageHealthScore,

          healthyProperties: healthDistribution.GOOD,

          fairProperties: healthDistribution.FAIR,

          attentionRequired: healthDistribution.NEEDS_ATTENTION,

          criticalProperties: healthDistribution.CRITICAL,
        },

        healthDistribution,

        properties: propertyHealth,

        propertiesNeedingAttention,

        healthTrend,

        recentInspections,
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
  getFinancialDashboard,
  getPropertyHealthDashboard,
};
