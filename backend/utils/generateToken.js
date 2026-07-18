const jwt = require("jsonwebtoken");

/**
 * Generates a signed JWT for an authenticated user.
 * @param {object} user - user record containing id, email, role
 * @returns {string} signed JWT
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

module.exports = generateToken;
