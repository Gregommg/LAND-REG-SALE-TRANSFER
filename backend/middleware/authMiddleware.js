const jwt = require("jsonwebtoken");

/**
 * Verifies the Bearer token on the Authorization header and attaches the
 * decoded payload (id, email, role) to req.user.
 */
function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, token invalid or expired" });
  }
}

module.exports = protect;
