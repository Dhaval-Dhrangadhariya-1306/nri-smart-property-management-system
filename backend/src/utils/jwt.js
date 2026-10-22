const jwt = require("jsonwebtoken");

const JWT_ISSUER = "nri-smart-property-management";
const JWT_ALGORITHM = "HS256";

const generateToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  if (
    !payload ||
    typeof payload.userId !== "string" ||
    !Number.isInteger(payload.tokenVersion) ||
    payload.tokenVersion < 0
  ) {
    throw new Error("Invalid authentication token payload");
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    issuer: JWT_ISSUER,
  });
};

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER,
  });
};

module.exports = {
  generateToken,
  verifyToken,
};
