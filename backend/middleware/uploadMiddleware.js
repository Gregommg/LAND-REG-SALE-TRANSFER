const fs = require("fs");
const path = require("path");
const multer = require("multer");

const PHOTOS_DIR = path.join(__dirname, "..", "uploads", "photos");
const DOCUMENTS_DIR = path.join(__dirname, "..", "uploads", "documents");
const TITLE_DEEDS_DIR = path.join(__dirname, "..", "uploads", "title-deeds");

// Ensure upload directories exist before multer tries to write into them
[PHOTOS_DIR, DOCUMENTS_DIR, TITLE_DEEDS_DIR].forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

function safeFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${unique}${ext}`;
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (file.fieldname === "photo") {
      cb(null, PHOTOS_DIR);
    } else if (file.fieldname === "idDocument") {
      cb(null, DOCUMENTS_DIR);
    } else if (file.fieldname === "titleDeedDocument") {
      cb(null, TITLE_DEEDS_DIR);
    } else {
      cb(new Error("Unexpected file field"), null);
    }
  },
  filename(req, file, cb) {
    cb(null, safeFilename(file.originalname));
  },
});

function fileFilter(req, file, cb) {
  if (file.fieldname === "photo") {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Photo must be a JPEG, PNG, or WEBP image"));
    }
  } else if (file.fieldname === "idDocument" || file.fieldname === "titleDeedDocument") {
    if (file.mimetype !== "application/pdf") {
      return cb(
        new Error(
          file.fieldname === "idDocument"
            ? "ID/passport document must be a PDF file"
            : "Title deed document must be a PDF file"
        )
      );
    }
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});

// Used on POST /api/auth/register
const registrationUpload = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "idDocument", maxCount: 1 },
]);

// Used on POST /api/land - the title deed PDF is optional at the multer
// level; the controller enforces whether it's actually required depending
// on who is submitting the registration.
const landRegistrationUpload = upload.fields([{ name: "titleDeedDocument", maxCount: 1 }]);

// Used on PUT /api/auth/me/photo - updating a profile photo after registration
const profilePhotoUpload = upload.single("photo");

module.exports = {
  registrationUpload,
  landRegistrationUpload,
  profilePhotoUpload,
  PHOTOS_DIR,
  DOCUMENTS_DIR,
  TITLE_DEEDS_DIR,
};
