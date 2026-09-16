const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

const protect = async (req, res, next) => {
  try {
    // ----------------------------------------------------------
    // Check Authorization header
    // ----------------------------------------------------------

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const error = new Error("Authentication token required");
      error.statusCode = 401;
      return next(error);
    }

    // ----------------------------------------------------------
    // Extract token
    // ----------------------------------------------------------

    const token = authHeader.substring(7).trim();

    if (!token) {
      const error = new Error("Authentication token required");
      error.statusCode = 401;
      return next(error);
    }

    // ----------------------------------------------------------
    // Verify JWT
    // ----------------------------------------------------------

    const decoded = verifyToken(token);

    // ----------------------------------------------------------
    // Validate token payload
    // ----------------------------------------------------------

    if (!decoded.userId) {
      const error = new Error("Invalid authentication token");
      error.statusCode = 401;
      return next(error);
    }

    // ----------------------------------------------------------
    // Check user still exists and is active
    // ----------------------------------------------------------

    const user = await User.findOne({
      _id: decoded.userId,
      isActive: true,
    }).select("_id name email role isActive tokenVersion");

    if (!user) {
      const error = new Error("User account is inactive or no longer exists");
      error.statusCode = 401;
      return next(error);
    }

    // ----------------------------------------------------------
    // Token version validation
    // ----------------------------------------------------------

    if (
      decoded.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      const error = new Error("Authentication session is no longer valid");
      error.statusCode = 401;
      return next(error);
    }

    // ----------------------------------------------------------
    // Attach authenticated user
    // ----------------------------------------------------------

    req.user = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    next();
  } catch (error) {
    const authError = new Error("Invalid or expired authentication token");

    authError.statusCode = 401;

    return next(authError);
  }
};

module.exports = protect;
