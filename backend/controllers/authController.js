const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const generateToken = require("../utils/generateToken");
const { logAction } = require("../utils/auditLogger");

/**
 * POST /api/auth/register
 * Public self-registration. Everyone signs up as a plain 'citizen' - there is
 * no landowner/buyer distinction, since ownership (not account role)
 * determines who can register, buy, or sell land. A profile photo and a
 * PDF of the applicant's National ID or passport are required so an admin
 * or registrar can verify their identity before the account is activated.
 * No token is issued here: the account starts out unverified and cannot
 * log in until an admin/registrar approves it.
 */
async function register(req, res, next) {
  const { fullName, email, password, nationalId, phoneNumber } = req.body;
  const photoFile = req.files?.photo?.[0];
  const idDocumentFile = req.files?.idDocument?.[0];

  try {
    if (!fullName || !email || !password || !nationalId || !phoneNumber) {
      return res
        .status(400)
        .json({ message: "fullName, email, password, nationalId and phoneNumber are all required" });
    }
    if (!photoFile) {
      return res.status(400).json({ message: "A passport-size profile photo is required" });
    }
    if (!idDocumentFile) {
      return res.status(400).json({ message: "A PDF copy of your National ID or passport is required" });
    }

    // No two accounts may ever share the same email, phone number, or
    // national ID - check each individually so the applicant gets a
    // specific, actionable message rather than a generic conflict.
    const existing = await pool.query(
      `SELECT email, phone_number, national_id FROM users
       WHERE email = $1 OR phone_number = $2 OR national_id = $3`,
      [email, phoneNumber, nationalId]
    );
    if (existing.rows.length > 0) {
      const clash = existing.rows[0];
      if (clash.email === email) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      if (clash.phone_number === phoneNumber) {
        return res.status(409).json({ message: "An account with this phone number already exists" });
      }
      if (clash.national_id === nationalId) {
        return res.status(409).json({ message: "An account with this national ID already exists" });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const profilePhotoPath = `photos/${photoFile.filename}`;
    const idDocumentPath = `documents/${idDocumentFile.filename}`;

    const result = await pool.query(
      `INSERT INTO users
        (full_name, email, password_hash, national_id, phone_number, role, profile_photo_path, id_document_path, verification_status)
       VALUES ($1,$2,$3,$4,$5,'citizen',$6,$7,'pending')
       RETURNING id, full_name, email, role, verification_status, created_at`,
      [fullName, email, passwordHash, nationalId, phoneNumber, profilePhotoPath, idDocumentPath]
    );

    const user = result.rows[0];

    await logAction(
      user.id,
      "REGISTER",
      "New citizen account submitted for verification (photo + ID document uploaded)",
      req.ip
    );

    res.status(201).json({
      message:
        "Registration received. Your account is pending verification by an administrator or registrar - you'll be able to log in once it's approved.",
      user,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await logAction(user.id, "LOGIN_FAILED", "Incorrect password", req.ip);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.verification_status === "pending") {
      return res.status(403).json({
        message: "Your account is still pending verification. Please wait for an admin or registrar to approve it.",
      });
    }
    if (user.verification_status === "rejected") {
      return res.status(403).json({
        message: "Your account verification was rejected. Please contact the land registry office.",
      });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: "Your account has been suspended. Please contact an administrator." });
    }

    const token = generateToken(user);
    await logAction(user.id, "LOGIN", "Successful login", req.ip);

    delete user.password_hash;
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 */
async function getProfile(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, national_id, phone_number, role, profile_photo_path,
              verification_status, is_active, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/auth/me/photo
 * Lets a logged-in user update their own profile photo at any time (not
 * just at registration).
 */
async function updateMyPhoto(req, res, next) {
  const photoFile = req.file;

  try {
    if (!photoFile) {
      return res.status(400).json({ message: "A photo file is required" });
    }

    const profilePhotoPath = `photos/${photoFile.filename}`;

    const result = await pool.query(
      `UPDATE users SET profile_photo_path = $1 WHERE id = $2
       RETURNING id, full_name, email, role, profile_photo_path`,
      [profilePhotoPath, req.user.id]
    );

    await logAction(req.user.id, "PROFILE_PHOTO_UPDATE", "Updated profile photo", req.ip);

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getProfile, updateMyPhoto };
