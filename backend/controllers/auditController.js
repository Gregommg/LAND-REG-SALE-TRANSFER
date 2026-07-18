const pool = require("../config/db");

/**
 * GET /api/audit-logs  (admin/auditor only)
 */
async function getAuditLogs(req, res, next) {
  const { userId, action } = req.query;

  try {
    const conditions = [];
    const values = [];

    if (userId) {
      values.push(userId);
      conditions.push(`al.user_id = $${values.length}`);
    }
    if (action) {
      values.push(action);
      conditions.push(`al.action = $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT al.*, u.full_name AS user_name, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT 500`,
      values
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAuditLogs };
