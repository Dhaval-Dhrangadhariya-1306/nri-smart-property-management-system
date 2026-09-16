const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 12;

// ============================================================
// HASH PASSWORD
// ============================================================

const hashPassword = async (password) => {
  if (!password || typeof password !== "string") {
    throw new Error("Password is required");
  }

  return bcrypt.hash(password, SALT_ROUNDS);
};

// ============================================================
// COMPARE PASSWORD
// ============================================================

const comparePassword = async (password, hashedPassword) => {
  if (!password || !hashedPassword) {
    return false;
  }

  return bcrypt.compare(password, hashedPassword);
};

module.exports = {
  hashPassword,
  comparePassword,
};
