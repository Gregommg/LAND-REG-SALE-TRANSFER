const pool = require("../config/db");

/**
 * Records an entry in the audit_logs table. Failures are logged but never
 * thrown, so audit logging can never break the main request flow.
 * @param {number|null} userId
 * @param {string} action - short action code, e.g. "LOGIN", "PARCEL_CREATE"
 * @param {string} details - human readable detail of what happened
 * @param {string} ipAddress
 */
async function logAction(userId, action, details, ipAddress) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [userId, action, details, ipAddress]
    );
  } catch (err) {
    console.error("Audit log write failed:", err.message);
  }
}

module.exports = { logAction };
