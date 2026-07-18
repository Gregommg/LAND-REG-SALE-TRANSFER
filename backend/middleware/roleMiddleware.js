/**
 * Restricts a route to a fixed set of roles.
 * Usage: router.post("/", protect, authorize("admin", "registrar"), handler)
 * @param  {...string} allowedRoles
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role(s): ${allowedRoles.join(", ")}`,
      });
    }
    next();
  };
}

module.exports = authorize;
