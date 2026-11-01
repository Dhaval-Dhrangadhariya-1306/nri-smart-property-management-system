const User = require("../models/User");
const Property = require("../models/Property");
const CaretakerAssignment = require("../models/CaretakerAssignment");
const Vendor = require("../models/Vendor");
const MaintenanceRequest = require("../models/MaintenanceRequest");
const MonitoringEvent = require("../models/MonitoringEvent");
const Expense = require("../models/Expense");
const Notification = require("../models/Notification");
const { hashPassword } = require("./password");
const logger = require("./logger");

const seedDemoData = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return;
    }

    logger.info(
      "Database is empty. Seeding initial demo data for NRI Owner...",
    );

    const hashedPassword = await hashPassword("Password123!");

    // 1. Create Demo Owner
    const owner = await User.create({
      name: "Aanya Mehta",
      email: "demo@estatepro.com",
      password: hashedPassword,
      role: "NRI_OWNER",
      phone: "+91 98200 12345",
      isActive: true,
      isEmailVerified: true,
    });

    // 2. Create Demo Caretaker
    const caretaker = await User.create({
      name: "Rajesh Patel",
      email: "rajesh.caretaker@estatepro.com",
      password: hashedPassword,
      role: "CARETAKER",
      phone: "+91 98765 43210",
      isActive: true,
      isEmailVerified: true,
    });

    // 3. Create Sample Properties
    const villa = await Property.create({
      owner: owner._id,
      title: "Palm Grove Villa",
      propertyType: "VILLA",
      address: {
        addressLine1: "12 Palm Beach Road",
        addressLine2: "Seaface",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        postalCode: "400050",
      },
      status: "ACTIVE",
      occupancy: "VACANT",
      condition: "GOOD",
      health: {
        score: 92,
        lastCalculatedAt: new Date(),
      },
      description: "Seafront 4BHK vacation home in Mumbai.",
      caretaker: caretaker._id,
      lastInspectionAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    });

    const apartment = await Property.create({
      owner: owner._id,
      title: "Emerald Heights Apartment",
      propertyType: "APARTMENT",
      address: {
        addressLine1: "Flat 402, Emerald Towers",
        addressLine2: "Bodakdev",
        city: "Ahmedabad",
        state: "Gujarat",
        country: "India",
        postalCode: "380054",
      },
      status: "ACTIVE",
      occupancy: "OCCUPIED",
      condition: "GOOD",
      health: {
        score: 88,
        lastCalculatedAt: new Date(),
      },
      description: "Modern 3BHK residential flat.",
      caretaker: caretaker._id,
      lastInspectionAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });

    // 4. Create Caretaker Assignment
    await CaretakerAssignment.create({
      property: villa._id,
      caretaker: caretaker._id,
      assignedBy: owner._id,
      status: "ACTIVE",
      startDate: new Date(),
      responsibilities: ["Routine inspection", "Vendor coordination"],
      notes: "Primary caretaker for Palm Grove Villa",
    });

    // 5. Create Vendor
    const vendor = await Vendor.create({
      owner: owner._id,
      name: "Apex Plumbing & HVAC",
      companyName: "Apex Services Pvt Ltd",
      category: "PLUMBING",
      phone: "+91 98111 22334",
      email: "service@apexplumbing.in",
      status: "ACTIVE",
      rating: 4.8,
    });

    // 6. Create Maintenance Request
    await MaintenanceRequest.create({
      property: villa._id,
      reportedBy: owner._id,
      assignedCaretaker: caretaker._id,
      assignedVendor: vendor._id,
      title: "HVAC Servicing & Filter Replacement",
      description:
        "Seasonal preventative maintenance for master bedroom air conditioning.",
      category: "HVAC",
      priority: "MEDIUM",
      status: "IN_PROGRESS",
      estimatedCost: 3500,
    });

    // 7. Create Monitoring Event
    await MonitoringEvent.create({
      property: villa._id,
      owner: owner._id,
      eventType: "SECURITY_INCIDENT",
      severity: "LOW",
      title: "Perimeter Sensor Triggered",
      description:
        "Motion detected on driveway sensor. Checked by caretaker, confirmed stray cat.",
      status: "RESOLVED",
      resolvedAt: new Date(),
    });

    // 8. Create Expenses
    await Expense.create({
      property: villa._id,
      owner: owner._id,
      title: "Quarterly Society Maintenance",
      description: "Q1 society maintenance dues",
      category: "MAINTENANCE",
      amount: 12500,
      expenseDate: new Date(),
      paymentStatus: "PAID",
      paidBy: "OWNER",
      paymentMethod: "UPI",
    });

    await Expense.create({
      property: apartment._id,
      owner: owner._id,
      title: "Annual Property Tax (AMC)",
      description: "Ahmedabad Municipal Corporation residential tax",
      category: "PROPERTY_TAX",
      amount: 8400,
      expenseDate: new Date(),
      paymentStatus: "PAID",
      paidBy: "OWNER",
      paymentMethod: "BANK_TRANSFER",
    });

    // 9. Create Welcome Notification
    await Notification.create({
      recipient: owner._id,
      title: "Welcome to EstatePro",
      message:
        "Your NRI smart property management portfolio is connected and active.",
      type: "SYSTEM",
      priority: "LOW",
      isRead: false,
      relatedProperty: villa._id,
    });

    logger.info("Demo data seeded successfully.");
    logger.info("Login: demo@estatepro.com / Password123!");
  } catch (error) {
    logger.error(`Failed to seed demo data: ${error.message}`);
  }
};

module.exports = seedDemoData;
