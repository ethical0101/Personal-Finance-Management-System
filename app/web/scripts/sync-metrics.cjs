/**
 * Copies dashboard/index.html (the self-contained Metrics Command Deck,
 * built by dashboard/build_dashboard.py) into app/web/public/metrics/ so
 * Vite serves/bundles it as a plain static file at /metrics/index.html --
 * identical behavior in dev, in the local Express build, and on Vercel
 * (where static files are served directly from app/web/dist, no server
 * function involved).
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "..", "dashboard", "index.html"); // repo-root/dashboard/index.html
const DEST_DIR = path.join(__dirname, "..", "public", "metrics");
const DEST = path.join(DEST_DIR, "index.html");

if (!fs.existsSync(SRC)) {
  console.warn(`sync-metrics: ${SRC} not found -- run "python dashboard/build_dashboard.py" first. Skipping.`);
  process.exit(0);
}

fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(SRC, DEST);
console.log(`sync-metrics: copied dashboard/index.html -> app/web/public/metrics/index.html`);
