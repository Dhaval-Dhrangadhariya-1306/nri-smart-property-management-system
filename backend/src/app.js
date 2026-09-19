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

// ============================================================
// MIDDLEWARE
// ============================================================

const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

app.use(helmet());

// ============================================================
// CROSS-ORIGIN RESOURCE SHARING
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
app.use(express.urlencoded({ extended: true }));

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

// Authentication routes
app.use("/api/auth", authRoutes);

// Property routes
app.use("/api/properties", propertyRoutes);

// Monitoring routes
app.use("/api/monitoring", monitoringRoutes);

// Caretaker routes
app.use("/api/caretakers", caretakerRoutes);

// Inspection routes
app.use("/api/inspections", inspectionRoutes);

// Maintenance routes
app.use("/api/maintenance", maintenanceRoutes);

// Expense routes
app.use("/api/expenses", expenseRoutes);

// Document Vault routes
app.use("/api/documents", documentRoutes);

// Notification & Alert routes
app.use("/api/notifications", notificationRoutes);

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
