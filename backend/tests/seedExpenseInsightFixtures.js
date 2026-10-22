const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../.env.test"),
  override: true,
});

const mongoose = require("mongoose");
const { hashPassword } = require("../src/utils/password");

const User = require("../src/models/User");
const Property = require("../src/models/Property");
const Expense = require("../src/models/Expense");
const MaintenanceRequest = require("../src/models/MaintenanceRequest");
const Vendor = require("../src/models/Vendor");

const EXPECTED_DB = "nri_property_test";

const IDS = {
  owner: "6aa97840f532befd1c175241",
  admin: "6aa97840f532befd1c175242",
  otherOwner: "6aa97840f532befd1c175243",
  property: "6aa97840f532befd1c175245",
  otherProperty: "6aa98002f532befd1c175247",
  vendor: "6aa97840f532befd1c175248",
  maintenance: "6aa97840f532befd1c175249",
};

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function upsertById(Model, id, data) {
  await Model.updateOne(
    { _id: new mongoose.Types.ObjectId(id) },
    { $set: data },
    { upsert: true, runValidators: true },
  );
}

async function seed() {
  const uri = process.env.MONGODB_URI;

  if (process.env.NODE_ENV !== "test") {
    throw new Error("Refusing to seed: NODE_ENV must be test.");
  }

  if (!uri) {
    throw new Error("MONGODB_URI is missing from .env.test.");
  }

  const databaseFromUri = new URL(
    uri.replace(/^mongodb\+srv:/, "https:").replace(/^mongodb:/, "http:"),
  ).pathname.slice(1);

  if (databaseFromUri !== EXPECTED_DB) {
    throw new Error("Refusing to seed: unexpected database in URI.");
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  if (mongoose.connection.name !== EXPECTED_DB) {
    throw new Error("Refusing to seed: connected to the wrong database.");
  }

  console.log(`Verified database: ${mongoose.connection.name}`);

  try {
    const ownerPassword = await hashPassword("Test@12345");
    const adminPassword = await hashPassword("AdminTest@123");
    const otherPassword = await hashPassword("OtherOwner@123");

    await upsertById(User, IDS.owner, {
      name: "Test NRI Owner",
      email: "testnri@example.com",
      password: ownerPassword,
      role: "NRI_OWNER",
      isActive: true,
      isEmailVerified: true,
      failedLoginAttempts: 0,
      lockUntil: null,
      tokenVersion: 0,
    });

    await upsertById(User, IDS.admin, {
      name: "Test Administrator",
      email: "admin.test@example.com",
      password: adminPassword,
      role: "ADMIN",
      isActive: true,
      isEmailVerified: true,
      failedLoginAttempts: 0,
      lockUntil: null,
      tokenVersion: 0,
    });

    await upsertById(User, IDS.otherOwner, {
      name: "Other Test Owner",
      email: "otherowner.test@example.com",
      password: otherPassword,
      role: "NRI_OWNER",
      isActive: true,
      isEmailVerified: true,
      failedLoginAttempts: 0,
      lockUntil: null,
      tokenVersion: 0,
    });

    const address = {
      addressLine1: "101 Test Avenue",
      addressLine2: "",
      city: "Ahmedabad",
      state: "Gujarat",
      country: "India",
      postalCode: "380001",
    };

    await upsertById(Property, IDS.property, {
      owner: IDS.owner,
      title: "Test Owner Property",
      propertyType: "APARTMENT",
      address,
      status: "ACTIVE",
      occupancy: "VACANT",
      condition: "GOOD",
      isActive: true,
    });

    await upsertById(Property, IDS.otherProperty, {
      owner: IDS.otherOwner,
      title: "Other Owner Test Property",
      propertyType: "HOUSE",
      address: {
        ...address,
        addressLine1: "202 Separate Test Road",
        postalCode: "380002",
      },
      status: "ACTIVE",
      occupancy: "VACANT",
      condition: "GOOD",
      isActive: true,
    });

    await upsertById(Vendor, IDS.vendor, {
      owner: IDS.owner,
      name: "Test Structural Repair Vendor",
      companyName: "Test Maintenance Services",
      category: "CONSTRUCTION",
      phone: "9999999999",
      email: "vendor.test@example.com",
      status: "ACTIVE",
      rating: 4.5,
      totalJobs: 1,
      completedJobs: 0,
      isActive: true,
    });

    await upsertById(MaintenanceRequest, IDS.maintenance, {
      property: IDS.property,
      reportedBy: IDS.owner,
      assignedVendor: IDS.vendor,
      title: "Emergency structural repair",
      description: "Synthetic test maintenance request for expense analytics.",
      category: "STRUCTURAL",
      priority: "URGENT",
      status: "COMPLETED",
      estimatedCost: 25000,
      actualCost: 28000,
      reportedAt: daysAgo(100),
    });

    const expenseRows = [
      {
        id: "6aa97840f532befd1c175251",
        title: "Electricity Bill",
        category: "ELECTRICITY",
        amount: 6000,
        days: 30,
      },
      {
        id: "6aa97840f532befd1c175252",
        title: "Electricity Bill",
        category: "ELECTRICITY",
        amount: 6100,
        days: 60,
      },
      {
        id: "6aa97840f532befd1c175253",
        title: "Electricity Bill",
        category: "ELECTRICITY",
        amount: 5900,
        days: 90,
      },
      {
        id: "6aa97840f532befd1c175254",
        title: "Emergency structural repair",
        category: "REPAIR",
        amount: 45000,
        days: 120,
      },
      {
        id: "6aa97840f532befd1c175255",
        title: "Structural maintenance payment",
        category: "MAINTENANCE",
        amount: 6500,
        days: 100,
        maintenanceRequest: IDS.maintenance,
      },
      {
        id: "6aa97840f532befd1c175256",
        title: "Property cleaning",
        category: "CLEANING",
        amount: 7000,
        days: 150,
      },
      {
        id: "6aa97840f532befd1c175257",
        title: "Water bill",
        category: "WATER",
        amount: 7000,
        days: 180,
      },
      {
        id: "6aa97840f532befd1c175258",
        title: "Property insurance",
        category: "INSURANCE",
        amount: 7000,
        days: 210,
      },
      {
        id: "6aa97840f532befd1c175259",
        title: "Property tax payment",
        category: "PROPERTY_TAX",
        amount: 7500,
        days: 240,
      },
    ];

    for (const row of expenseRows) {
      await upsertById(Expense, row.id, {
        property: IDS.property,
        owner: IDS.owner,
        title: row.title,
        category: row.category,
        amount: row.amount,
        expenseDate: daysAgo(row.days),
        paymentStatus: "PAID",
        paidBy: "OWNER",
        paymentMethod: "BANK_TRANSFER",
        isActive: true,
        ...(row.maintenanceRequest
          ? { maintenanceRequest: row.maintenanceRequest }
          : {}),
      });
    }

    await upsertById(Expense, "6aa97840f532befd1c175260", {
      property: IDS.otherProperty,
      owner: IDS.otherOwner,
      title: "Other property water bill",
      category: "WATER",
      amount: 3200,
      expenseDate: daysAgo(45),
      paymentStatus: "PAID",
      paidBy: "OWNER",
      paymentMethod: "BANK_TRANSFER",
      isActive: true,
    });

    const [ownerExpenses, allExpenses] = await Promise.all([
      Expense.aggregate([
        {
          $match: {
            property: new mongoose.Types.ObjectId(IDS.property),
            owner: new mongoose.Types.ObjectId(IDS.owner),
            isActive: true,
          },
        },
        {
          $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } },
        },
      ]),
      Expense.aggregate([
        { $match: { isActive: true } },
        {
          $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } },
        },
      ]),
    ]);

    console.log(
      "Owner expense verification:",
      ownerExpenses[0] || { count: 0, total: 0 },
    );
    console.log(
      "All expense verification:",
      allExpenses[0] || { count: 0, total: 0 },
    );
    console.log("Synthetic fixtures seeded. No collections were cleared.");
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch(async (error) => {
  console.error("Fixture seeding failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
