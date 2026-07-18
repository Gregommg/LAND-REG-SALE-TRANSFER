const pool = require("../config/db");
const { encryptMessage, decryptMessage } = require("../utils/messageCrypto");
const { logAction } = require("../utils/auditLogger");

/**
 * GET /api/messages
 * Lists this user's conversations - one row per other person they've
 * exchanged messages with, showing the most recent message and an unread
 * count, most recently active first.
 */
async function listConversations(req, res, next) {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (other_user_id)
              other_user_id,
              u.full_name AS other_user_name,
              u.profile_photo_path AS other_user_photo,
              m.ciphertext, m.iv, m.auth_tag, m.sender_id, m.created_at,
              (SELECT COUNT(*) FROM messages
                WHERE sender_id = other_user_id AND recipient_id = $1 AND read_at IS NULL) AS unread_count
       FROM (
         SELECT id, sender_id, recipient_id, ciphertext, iv, auth_tag, created_at,
                CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_user_id
         FROM messages
         WHERE sender_id = $1 OR recipient_id = $1
       ) m
       JOIN users u ON u.id = m.other_user_id
       ORDER BY other_user_id, m.created_at DESC`,
      [userId]
    );

    const conversations = result.rows.map((row) => ({
      userId: row.other_user_id,
      fullName: row.other_user_name,
      profilePhoto: row.other_user_photo,
      lastMessage: decryptMessage({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.auth_tag }),
      lastMessageFromMe: row.sender_id === userId,
      lastMessageAt: row.created_at,
      unreadCount: Number(row.unread_count),
    }));

    // DISTINCT ON above doesn't let us ORDER BY created_at directly across
    // groups, so do the final most-recent-first sort in JS.
    conversations.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    res.json(conversations);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/messages/:userId
 * Returns the full decrypted conversation with a specific user, oldest
 * first, and marks any of their messages to us as read.
 */
async function getConversation(req, res, next) {
  const userId = req.user.id;
  const otherUserId = Number(req.params.userId);

  try {
    if (otherUserId === userId) {
      return res.status(400).json({ message: "You cannot message yourself" });
    }

    const otherUserResult = await pool.query(
      "SELECT id, full_name, profile_photo_path FROM users WHERE id = $1",
      [otherUserId]
    );
    if (otherUserResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const result = await pool.query(
      `SELECT id, sender_id, recipient_id, ciphertext, iv, auth_tag, read_at, created_at
       FROM messages
       WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
       ORDER BY created_at ASC`,
      [userId, otherUserId]
    );

    const messages = result.rows.map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      text: decryptMessage({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.auth_tag }),
      readAt: row.read_at,
      createdAt: row.created_at,
    }));

    await pool.query(
      `UPDATE messages SET read_at = NOW()
       WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL`,
      [otherUserId, userId]
    );

    res.json({ otherUser: otherUserResult.rows[0], messages });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/messages
 * Sends an encrypted message to another user.
 */
async function sendMessage(req, res, next) {
  const senderId = req.user.id;
  const { recipientId, text } = req.body;

  try {
    if (!recipientId || !text || !text.trim()) {
      return res.status(400).json({ message: "recipientId and a non-empty text are required" });
    }
    if (Number(recipientId) === senderId) {
      return res.status(400).json({ message: "You cannot message yourself" });
    }

    const recipientResult = await pool.query("SELECT id FROM users WHERE id = $1", [recipientId]);
    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const { ciphertext, iv, authTag } = encryptMessage(text.trim());

    const result = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, ciphertext, iv, auth_tag)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, sender_id, recipient_id, created_at`,
      [senderId, recipientId, ciphertext, iv, authTag]
    );

    await logAction(senderId, "MESSAGE_SEND", `Sent a message to user #${recipientId}`, req.ip);

    res.status(201).json({ ...result.rows[0], text: text.trim() });
  } catch (err) {
    next(err);
  }
}

module.exports = { listConversations, getConversation, sendMessage };
