// ============================================================
// ROLE AUTHORIZATION MIDDLEWARE
// ============================================================

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // ----------------------------------------------------------
    // Authentication check
    // ----------------------------------------------------------

    if (!req.user) {
      const error = new Error("Authentication required");
      error.statusCode = 401;
      return next(error);
    }

    // ----------------------------------------------------------
    // Role validation
    // ----------------------------------------------------------

    if (!allowedRoles.includes(req.user.role)) {
      const error = new Error(
        "You do not have permission to perform this action",
      );

      error.statusCode = 403;

      return next(error);
    }

    next();
  };
};

module.exports = authorize;
