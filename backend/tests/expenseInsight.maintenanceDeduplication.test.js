const test = require("node:test");
const assert = require("node:assert/strict");

const MaintenanceRequest = require("../src/models/MaintenanceRequest");

const {
  calculateMaintenanceCostAnalysis,
  calculateVendorCostAnalysis,
} = require("../src/services/expenseInsightService");

test("multiple expenses for one maintenance request do not double-count job costs", async () => {
  const originalFind = MaintenanceRequest.find;

  const requestId = "64a000000000000000000001";
  const vendorId = "64a000000000000000000002";

  const maintenanceRequest = {
    _id: requestId,
    title: "Regression test repair",
    category: "STRUCTURAL",
    priority: "URGENT",
    status: "COMPLETED",
    estimatedCost: 25000,
    actualCost: 28000,
    assignedVendor: vendorId,
  };

  const expenses = [
    {
      _id: "64a000000000000000000003",
      amount: 2000,
      maintenanceRequest: requestId,
    },
    {
      _id: "64a000000000000000000004",
      amount: 3000,
      maintenanceRequest: requestId,
    },
  ];

  try {
    // Mock the database query; no records are created or changed.
    MaintenanceRequest.find = () => ({
      select() {
        return this;
      },
      lean: async () => [maintenanceRequest],
    });

    const maintenance = await calculateMaintenanceCostAnalysis(expenses);

    const vendor = await calculateVendorCostAnalysis(expenses);

    // Both expense entries must be included.
    assert.equal(maintenance.linkedExpenseCount, 2);
    assert.equal(maintenance.totalMaintenanceExpense, 5000);

    // The request's costs must be counted only once.
    assert.equal(maintenance.requestsAnalyzed, 1);
    assert.equal(maintenance.requestsWithCostData, 1);
    assert.equal(maintenance.totalEstimatedCost, 25000);
    assert.equal(maintenance.totalActualCost, 28000);
    assert.equal(maintenance.totalVariance, 3000);
    assert.equal(maintenance.variancePercent, 12);

    // Both expenses belong to one vendor and one maintenance job.
    assert.equal(vendor.vendorCount, 1);
    assert.equal(vendor.totalVendorExpense, 5000);
    assert.equal(vendor.vendors[0].totalExpense, 5000);
    assert.equal(vendor.vendors[0].jobCount, 1);
    assert.equal(vendor.vendors[0].averageExpensePerJob, 5000);

    // Vendor maintenance costs must also be counted only once.
    assert.equal(vendor.vendors[0].totalEstimatedCost, 25000);
    assert.equal(vendor.vendors[0].totalActualCost, 28000);
    assert.equal(vendor.vendors[0].variance, 3000);
    assert.equal(vendor.vendors[0].variancePercent, 12);
  } finally {
    // Restore the real model method even if an assertion fails.
    MaintenanceRequest.find = originalFind;
  }
});
