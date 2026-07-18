const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

/**
 * The server holds a single symmetric key (from env) used to encrypt every
 * message before it is written to the database, and decrypt it again when
 * read back. This protects message content at rest (e.g. if the database
 * were ever leaked or inspected directly, messages are unreadable without
 * this key) and in transit within the server process.
 *
 * IMPORTANT HONESTY NOTE: this is NOT end-to-end encryption. The server
 * itself can still decrypt every message, because it holds the only key.
 * True end-to-end encryption would require each user to hold their own
 * private key (generated and stored client-side) so that not even the
 * server could read message content - that's a significantly bigger
 * undertaking (key generation/exchange, secure client-side key storage,
 * the works) and isn't what's implemented here.
 */
function getKey() {
  const keyHex = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      "MESSAGE_ENCRYPTION_KEY must be set in .env as a 64-character hex string (32 bytes)"
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypts a plaintext message.
 * @param {string} plaintext
 * @returns {{ ciphertext: string, iv: string, authTag: string }} all base64-encoded
 */
function encryptMessage(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV, standard for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypts a stored message back to plaintext.
 * @param {{ ciphertext: string, iv: string, authTag: string }} encrypted
 * @returns {string} plaintext
 */
function decryptMessage({ ciphertext, iv, authTag }) {
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

module.exports = { encryptMessage, decryptMessage };
