const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
const { logAction } = require("../utils/auditLogger");
const { DOCUMENTS_DIR } = require("../middleware/uploadMiddleware");

const VALID_ROLES = ["admin", "registrar", "citizen", "auditor"];

/**
 * GET /api/users  (admin only)
 */
async function getUsers(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, national_id, phone_number, role, profile_photo_path,
              verification_status, verification_notes, is_active,
              (id_document_path IS NOT NULL) AS has_id_document, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/users  (admin only) - create staff accounts (registrar/auditor/admin).
 * Staff accounts created directly by an admin are auto-verified since the
 * admin is personally vouching for them; no ID document is required here.
 */
async function createUser(req, res, next) {
  const { fullName, email, password, nationalId, phoneNumber, role } = req.body;

  try {
    if (!fullName || !email || !password || !role || !phoneNumber) {
      return res.status(400).json({ message: "fullName, email, password, phoneNumber and role are required" });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `role must be one of: ${VALID_ROLES.join(", ")}` });
    }

    const existing = await pool.query(
      `SELECT email, phone_number, national_id FROM users
       WHERE email = $1 OR phone_number = $2 OR (national_id IS NOT NULL AND national_id = $3)`,
      [email, phoneNumber, nationalId || null]
    );
    if (existing.rows.length > 0) {
      const clash = existing.rows[0];
      if (clash.email === email) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      if (clash.phone_number === phoneNumber) {
        return res.status(409).json({ message: "An account with this phone number already exists" });
      }
      return res.status(409).json({ message: "An account with this national ID already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users
        (full_name, email, password_hash, national_id, phone_number, role, verification_status, verified_by, verified_at)
       VALUES ($1,$2,$3,$4,$5,$6,'approved',$7,NOW())
       RETURNING id, full_name, email, national_id, phone_number, role, verification_status, created_at`,
      [fullName, email, passwordHash, nationalId || null, phoneNumber, role, req.user.id]
    );

    await logAction(req.user.id, "USER_CREATE", `Created ${role} account ${email} (auto-verified)`, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/users/:id/role  (admin only)
 */
async function updateUserRole(req, res, next) {
  const { role } = req.body;

  try {
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `role must be one of: ${VALID_ROLES.join(", ")}` });
    }

    const result = await pool.query(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, full_name, email, role`,
      [role, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    await logAction(req.user.id, "USER_ROLE_UPDATE", `Set user #${req.params.id} role to ${role}`, req.ip);

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/users/:id/status  (admin only) - suspend / reactivate an
 * already-verified account (separate from the one-time identity verification).
 */
async function updateUserStatus(req, res, next) {
  const { isActive } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users SET is_active = $1 WHERE id = $2
       RETURNING id, full_name, email, is_active`,
      [Boolean(isActive), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    await logAction(
      req.user.id,
      "USER_STATUS_UPDATE",
      `Set user #${req.params.id} active=${Boolean(isActive)}`,
      req.ip
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/users/:id/verify  (admin/registrar only)
 * Approves or rejects a citizen's pending identity verification, after
 * reviewing their uploaded photo and ID/passport document.
 */
async function verifyUser(req, res, next) {
  const { decision, notes } = req.body;

  try {
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "decision must be 'approved' or 'rejected'" });
    }

    const result = await pool.query(
      `UPDATE users SET
         verification_status = $1,
         verification_notes = $2,
         verified_by = $3,
         verified_at = NOW()
       WHERE id = $4 AND verification_status = 'pending'
       RETURNING id, full_name, email, verification_status`,
      [decision, notes || null, req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No pending verification found for this user" });
    }

    await logAction(
      req.user.id,
      decision === "approved" ? "USER_VERIFY_APPROVE" : "USER_VERIFY_REJECT",
      `${decision === "approved" ? "Approved" : "Rejected"} identity verification for user #${req.params.id}${
        notes ? `: ${notes}` : ""
      }`,
      req.ip
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/:id/id-document  (admin/registrar, or the user themselves)
 * Streams the applicant's uploaded National ID / passport PDF. This file is
 * never served statically - it only leaves the server through this
 * authenticated, access-controlled route.
 */
async function getIdDocument(req, res, next) {
  const targetId = Number(req.params.id);
  const isStaff = ["admin", "registrar"].includes(req.user.role);

  try {
    if (!isStaff && req.user.id !== targetId) {
      return res.status(403).json({ message: "You are not authorized to view this document" });
    }

    const result = await pool.query("SELECT id_document_path, full_name FROM users WHERE id = $1", [
      targetId,
    ]);
    const row = result.rows[0];

    if (!row || !row.id_document_path) {
      return res.status(404).json({ message: "No ID document on file for this user" });
    }

    const filename = path.basename(row.id_document_path); // strip any path segments defensively
    const fullPath = path.join(DOCUMENTS_DIR, filename);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: "Document file could not be found on the server" });
    }

    await logAction(req.user.id, "ID_DOCUMENT_VIEW", `Viewed ID document for user #${targetId}`, req.ip);

    res.sendFile(fullPath);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUserRole,
  updateUserStatus,
  verifyUser,
  getIdDocument,
};
