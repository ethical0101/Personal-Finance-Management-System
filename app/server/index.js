require("dotenv").config();
const fs = require("fs");
const path = require("path");
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

// Module 3/4 Metrics Command Deck, served in-app so the React "Metrics" tab can iframe it.
const DASHBOARD_DIR = path.join(__dirname, "..", "..", "dashboard");
if (fs.existsSync(DASHBOARD_DIR)) {
  app.use("/metrics", express.static(DASHBOARD_DIR));
}

// Serves the built React app (run `npm run build` in app/web first; app/web/dist is gitignored).
const STATIC_ROOT = path.join(__dirname, "..", "web", "dist");

app.use(express.static(STATIC_ROOT));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/metrics/")) {
    return res.status(404).json({ error: "Not found." });
  }
  if (!fs.existsSync(path.join(STATIC_ROOT, "index.html"))) {
    return res.status(503).send("React app not built yet. Run: cd app/web && npm install && npm run build");
  }
  res.sendFile(path.join(STATIC_ROOT, "index.html"));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Finance app server listening on http://localhost:${PORT} (serving ${path.relative(process.cwd(), STATIC_ROOT) || "."})`));
