const express = require("express");
const router = express.Router();
const {
  getTransactions,
  getTransactionById,
  createTransaction,
  confirmPayment,
  approveTransaction,
  rejectTransaction,
} = require("../controllers/transactionController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.get("/", protect, getTransactions);
router.get("/:id", protect, getTransactionById);
// Any authenticated user may initiate a sale/transfer; the controller checks
// that the requester actually owns the parcel (ownership decides who can
// sell, not the account's role) and that only citizens ever end up as the
// buyer - staff/system accounts can facilitate but never buy.
router.post("/", protect, createTransaction);
// Only the seller can confirm they actually received payment (checked inside the controller).
router.put("/:id/confirm-payment", protect, confirmPayment);
router.put("/:id/approve", protect, authorize("registrar", "admin"), approveTransaction);
router.put("/:id/reject", protect, authorize("registrar", "admin"), rejectTransaction);

module.exports = router;
