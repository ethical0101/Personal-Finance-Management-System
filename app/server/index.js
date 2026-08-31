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

app.use(express.static(path.join(__dirname, "..", "public")));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found." });
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Finance app server listening on http://localhost:${PORT}`));
