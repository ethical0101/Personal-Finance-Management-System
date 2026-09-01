/**
 * The Express app itself, with no .listen() call -- so it can be required
 * both by index.js (local dev, one process serves API + static files) and
 * by /api/index.js (Vercel serverless function, API routes only; static
 * files are served directly by Vercel's CDN from app/web/dist).
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { requireAuth } = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/accounts", requireAuth, require("./routes/accounts"));
app.use("/api/categories", requireAuth, require("./routes/categories"));
app.use("/api/transactions", requireAuth, require("./routes/transactions"));
app.use("/api/budgets", requireAuth, require("./routes/budgets"));
app.use("/api/goals", requireAuth, require("./routes/goals"));
app.use("/api/bills", requireAuth, require("./routes/bills"));
app.use("/api/notifications", requireAuth, require("./routes/notifications"));
app.use("/api/insights", requireAuth, require("./routes/insights"));
app.use("/api/dashboard", requireAuth, require("./routes/dashboard"));

app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

module.exports = app;
