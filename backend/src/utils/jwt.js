const jwt = require("jsonwebtoken");

// ============================================================
// GENERATE JWT
// ============================================================

const generateToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    issuer: "nri-smart-property-management",
  });
};

// ============================================================
// VERIFY JWT
// ============================================================

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.verify(token, process.env.JWT_SECRET, {
    issuer: "nri-smart-property-management",
  });
};

module.exports = {
  generateToken,
  verifyToken,
};
