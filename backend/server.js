require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const landRoutes = require("./routes/landRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const userRoutes = require("./routes/userRoutes");
const auditRoutes = require("./routes/auditRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

// Make sure upload directories exist before anything tries to read/write them
["uploads/photos", "uploads/documents"].forEach((dir) => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

const app = express();

// --- Security & core middleware -------------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Basic rate limiting to slow down brute force / abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", apiLimiter);

// --- Profile photos (public) ------------------------------------------------------
// Only the photos folder is exposed - National ID/passport PDFs are never
// served statically and only leave the server via the authenticated
// GET /api/users/:id/id-document route.
app.use(
  "/uploads/photos",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "uploads/photos"))
);

// --- Health check -----------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "land-registration-backend", time: new Date().toISOString() });
});

// --- Routes -------------------------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/land", landRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/messages", messageRoutes);

// --- Error handling -------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Land Registration API server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});

module.exports = app;
