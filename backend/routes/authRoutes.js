const express = require("express");
const router = express.Router();
const { register, login, getProfile, updateMyPhoto } = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");
const { registrationUpload, profilePhotoUpload } = require("../middleware/uploadMiddleware");

// Wrap multer so its errors (bad file type, file too large, etc.) flow into
// a clean 400 response instead of crashing the request.
function handleUpload(uploader) {
  return (req, res, next) => {
    uploader(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || "File upload failed" });
      }
      next();
    });
  };
}

router.post("/register", handleUpload(registrationUpload), register);
router.post("/login", login);
router.get("/me", protect, getProfile);
router.put("/me/photo", protect, handleUpload(profilePhotoUpload), updateMyPhoto);

module.exports = router;
