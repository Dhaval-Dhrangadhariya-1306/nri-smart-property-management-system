const jwt = require("jsonwebtoken");
const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    const error = new Error("Authentication token required");
    error.statusCode = 401;
    return next(error);
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    const error = new Error("Authentication token required");
    error.statusCode = 401;
    return next(error);
  }

  let decoded;

  // Only token verification failures should become authentication errors.
  try {
    decoded = verifyToken(token);
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.NotBeforeError
    ) {
      const authError = new Error("Invalid or expired authentication token");
      authError.statusCode = 401;
      return next(authError);
    }

    return next(error);
  }

  if (
    !decoded ||
    typeof decoded.userId !== "string" ||
    !Number.isInteger(decoded.tokenVersion) ||
    decoded.tokenVersion < 0
  ) {
    const error = new Error("Invalid authentication token");
    error.statusCode = 401;
    return next(error);
  }

  try {
    const user = await User.findOne({
      _id: decoded.userId,
      isActive: true,
    }).select("_id name email role isActive tokenVersion");

    if (!user) {
      const error = new Error("User account is inactive or no longer exists");
      error.statusCode = 401;
      return next(error);
    }

    if (decoded.tokenVersion !== (user.tokenVersion ?? 0)) {
      const error = new Error("Authentication session is no longer valid");
      error.statusCode = 401;
      return next(error);
    }

    req.user = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    };

    return next();
  } catch (error) {
    // Let the central error handler handle database and unexpected failures.
    return next(error);
  }
};

module.exports = protect;
