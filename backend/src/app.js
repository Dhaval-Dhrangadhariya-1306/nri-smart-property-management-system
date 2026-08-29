const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

// Security middleware
app.use(helmet());

// Cross-origin resource sharing
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "NRI Smart Property Management System API is running",
  });
});

// 404 handler
app.use(notFound);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
