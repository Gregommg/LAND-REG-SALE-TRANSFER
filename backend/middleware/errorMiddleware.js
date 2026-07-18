/**
 * Catches requests to unknown routes.
 */
function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

/**
 * Centralized error handler. Express recognizes this by its 4 arguments.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err.stack);

  // PostgreSQL unique violation
  if (err.code === "23505") {
    return res.status(409).json({ message: "A record with these details already exists." });
  }
  // PostgreSQL foreign key violation
  if (err.code === "23503") {
    return res.status(400).json({ message: "Referenced record does not exist." });
  }

  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    message: err.message || "Internal server error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
}

module.exports = { notFound, errorHandler };
