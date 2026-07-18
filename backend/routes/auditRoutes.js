const express = require("express");
const router = express.Router();
const { getAuditLogs } = require("../controllers/auditController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.get("/", protect, authorize("admin", "auditor"), getAuditLogs);

module.exports = router;
