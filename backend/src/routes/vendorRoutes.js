const express = require("express");

const {
  createVendor,
  getMyVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  getVendorStats,
} = require("../controllers/vendorController");

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// AUTHENTICATION
// ============================================================

router.use(authMiddleware);

// ============================================================
// VENDOR STATISTICS
// ============================================================

router.get("/stats", authorize("NRI_OWNER", "ADMIN"), getVendorStats);

// ============================================================
// CREATE VENDOR
// ============================================================

router.post("/", authorize("NRI_OWNER", "ADMIN"), createVendor);

// ============================================================
// GET MY VENDORS
// ============================================================

router.get("/my", authorize("NRI_OWNER", "ADMIN"), getMyVendors);

// ============================================================
// GET VENDOR BY ID
// ============================================================

router.get("/:vendorId", authorize("NRI_OWNER", "ADMIN"), getVendorById);

// ============================================================
// UPDATE VENDOR
// ============================================================

router.put("/:vendorId", authorize("NRI_OWNER", "ADMIN"), updateVendor);

// ============================================================
// ARCHIVE VENDOR
// ============================================================

router.delete("/:vendorId", authorize("NRI_OWNER", "ADMIN"), deleteVendor);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;
