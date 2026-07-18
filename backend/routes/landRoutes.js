const express = require("express");
const router = express.Router();
const {
  getParcels,
  getParcelById,
  createParcel,
  updateParcel,
  deleteParcel,
  approveParcel,
  rejectParcel,
  listForSale,
  unlistParcel,
  getParcelHistory,
  getTitleDeedDocument,
} = require("../controllers/landController");
const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const { landRegistrationUpload } = require("../middleware/uploadMiddleware");

// Wrap multer so its errors (bad file type, file too large, etc.) flow into
// a clean 400 response instead of crashing the request.
function handleUpload(req, res, next) {
  landRegistrationUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "File upload failed" });
    }
    next();
  });
}

router.get("/", protect, getParcels);
router.get("/:id", protect, getParcelById);
router.get("/:id/history", protect, getParcelHistory);
router.get("/:id/title-deed-document", protect, getTitleDeedDocument);

// Any authenticated user may submit a land registration request (with a PDF
// of the title deed attached); registrars/admins register directly and
// everyone else lands in the approval queue (enforced inside the controller,
// not by role here).
router.post("/", protect, handleUpload, createParcel);

router.put("/:id", protect, authorize("registrar", "admin"), updateParcel);
router.put("/:id/approve", protect, authorize("registrar", "admin"), approveParcel);
router.put("/:id/reject", protect, authorize("registrar", "admin"), rejectParcel);

// Ownership (checked inside the controller), not role, decides who can
// list/unlist a parcel for sale.
router.put("/:id/list", protect, listForSale);
router.put("/:id/unlist", protect, unlistParcel);

router.delete("/:id", protect, authorize("admin"), deleteParcel);

module.exports = router;
