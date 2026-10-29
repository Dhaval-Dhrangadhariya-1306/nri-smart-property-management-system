const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

// ============================================================
// SWAGGER / OPENAPI
// ============================================================

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

// ============================================================
// ROUTES
// ============================================================

const authRoutes = require("./routes/authRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const expenseInsightRoutes = require("./routes/expenseInsightRoutes");
const monitoringRoutes = require("./routes/monitoringRoutes");
const caretakerRoutes = require("./routes/caretakerRoutes");
const inspectionRoutes = require("./routes/inspectionRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const documentRoutes = require("./routes/documentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");

// ============================================================
// ERROR-HANDLING MIDDLEWARE
// ============================================================

const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

// ============================================================
// INITIALIZE EXPRESS APP
// ============================================================

const app = express();

// ============================================================
// SECURITY AND CORS
// ============================================================

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(helmet());

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

// ============================================================
// BODY PARSERS
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
// SWAGGER API DOCUMENTATION
// Register before the not-found and error handlers.
// ============================================================

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve the generated OpenAPI specification as JSON.
app.get("/api-docs.json", (req, res) => {
  res.status(200).json(swaggerSpec);
});

// ============================================================
// API ROUTES
// ============================================================

app.use("/api/auth", authRoutes);

app.use("/api/properties", propertyRoutes);

app.use("/api/expenses/insights", expenseInsightRoutes);

app.use("/api/monitoring", monitoringRoutes);

app.use("/api/caretakers", caretakerRoutes);

app.use("/api/inspections", inspectionRoutes);

app.use("/api/maintenance", maintenanceRoutes);

app.use("/api/expenses", expenseRoutes);

app.use("/api/documents", documentRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/vendors", vendorRoutes);

app.use("/api/audit-logs", auditLogRoutes);

app.use("/api/dashboard", dashboardRoutes);

// ============================================================
// ERROR HANDLING
// Keep these last so unmatched requests and errors are handled.
// ============================================================

app.use(notFound);

app.use(errorHandler);

// ============================================================
// EXPORT APP
// ============================================================

module.exports = app;
