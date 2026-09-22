const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

// ============================================================
// ROUTES
// ============================================================

const authRoutes = require("./routes/authRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const monitoringRoutes = require("./routes/monitoringRoutes");
const caretakerRoutes = require("./routes/caretakerRoutes");
const inspectionRoutes = require("./routes/inspectionRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const documentRoutes = require("./routes/documentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const vendorRoutes = require("./routes/vendorRoutes");

// ============================================================
// MIDDLEWARE
// ============================================================

const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

// ============================================================
// APP INITIALIZATION
// ============================================================

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

app.use(helmet());

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

// ============================================================
// REQUEST PARSING
// ============================================================

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  }),
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "NRI Smart Property Management System API is running",
  });
});

// ============================================================
// API ROUTES
// ============================================================

// Authentication
app.use("/api/auth", authRoutes);

// Property Management
app.use("/api/properties", propertyRoutes);

// Monitoring & Security Events
app.use("/api/monitoring", monitoringRoutes);

// Caretaker Management
app.use("/api/caretakers", caretakerRoutes);

// Property Inspections
app.use("/api/inspections", inspectionRoutes);

// Maintenance Management
app.use("/api/maintenance", maintenanceRoutes);

// Expense Management
app.use("/api/expenses", expenseRoutes);

// Document Vault
app.use("/api/documents", documentRoutes);

// Notifications
app.use("/api/notifications", notificationRoutes);

// Vendor Management
app.use("/api/vendors", vendorRoutes);

// Analytics & Dashboards
app.use("/api/dashboard", dashboardRoutes);

// ============================================================
// 404 HANDLER
// ============================================================

app.use(notFound);

// ============================================================
// CENTRALIZED ERROR HANDLER
// ============================================================

app.use(errorHandler);

// ============================================================
// EXPORT
// ============================================================

module.exports = app;
