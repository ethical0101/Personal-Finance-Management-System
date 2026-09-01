/**
 * Local dev / single-process entrypoint: the API app (app.js) plus static
 * file serving for the React build, all on one port. Not used on Vercel --
 * there, /api/index.js exports app.js directly and Vercel's CDN serves the
 * static files from app/web/dist.
 */
const fs = require("fs");
const path = require("path");
const express = require("express");
const app = require("./app");

const STATIC_ROOT = path.join(__dirname, "..", "web", "dist");

app.use(express.static(STATIC_ROOT));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found." });
  if (!fs.existsSync(path.join(STATIC_ROOT, "index.html"))) {
    return res.status(503).send("React app not built yet. Run: cd app/web && npm install && npm run build");
  }
  res.sendFile(path.join(STATIC_ROOT, "index.html"));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Finance app server listening on http://localhost:${PORT} (serving ${path.relative(process.cwd(), STATIC_ROOT) || "."})`));
