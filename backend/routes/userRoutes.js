const express = require("express");
const router = express.Router();
const {
  getUsers,
  createUser,
  updateUserRole,
  updateUserStatus,
  verifyUser,
  getIdDocument,
} = require("../controllers/userController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.get("/", protect, authorize("admin", "registrar"), getUsers);
router.post("/", protect, authorize("admin"), createUser);
router.put("/:id/role", protect, authorize("admin"), updateUserRole);
router.put("/:id/status", protect, authorize("admin"), updateUserStatus);
router.put("/:id/verify", protect, authorize("admin", "registrar"), verifyUser);
// Ownership vs. staff access is checked inside the controller itself.
router.get("/:id/id-document", protect, getIdDocument);

module.exports = router;
