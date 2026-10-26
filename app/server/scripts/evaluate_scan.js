/**
 * Measures bill-scanning accuracy against the labelled test bills in
 * report/eval_receipts (10 receipts incl. 2 deliberately degraded ones, plus 1
 * image that is NOT a bill and must be rejected).
 *
 *   node app/server/scripts/evaluate_scan.js            # server on :4000
 *   SEED_BASE_URL=https://wealthline-eight.vercel.app/api node ...   # against production
 *
 * Needs the demo account (demo@gmail.com / 12345678) from seed_demo.js.
 */
const fs = require("fs");
const path = require("path");

const BASE = process.env.SEED_BASE_URL || "http://localhost:4000/api";
const DIR = path.join(__dirname, "..", "..", "..", "report", "eval_receipts");
const OUT = path.join(__dirname, "..", "..", "..", "analysis", "eval_scan.json");

const tokens = s => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
function merchantMatch(pred, truth) {
  const p = new Set(tokens(pred)), t = tokens(truth);
  if (!t.length) return false;
  return t.filter(x => p.has(x)).length / t.length >= 0.6;
}

(async () => {
  const login = await (await fetch(BASE + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "demo@gmail.com", password: "12345678" }) })).json();
  const truth = JSON.parse(fs.readFileSync(path.join(DIR, "ground_truth.json"), "utf-8"));
  const rows = [];
  for (const item of truth) {
    const image = fs.readFileSync(path.join(DIR, item.file)).toString("base64");
    const t0 = Date.now();
    const res = await fetch(BASE + "/scan/receipt", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.token}` }, body: JSON.stringify({ image, mimeType: "image/png" }) });
    const ms = Date.now() - t0;
    const data = await res.json();
    if (item.nonReceipt) {
      rows.push({ id: item.id, nonReceipt: true, status: res.status, rejected: res.status === 422, ms });
    } else if (!res.ok) {
      rows.push({ id: item.id, hard: item.hard, status: res.status, error: data.error, ms, totalOk: false, dateOk: false, categoryOk: false, merchantOk: false });
    } else {
      rows.push({
        id: item.id, hard: item.hard, status: res.status, ms,
        predicted: { merchant: data.merchant, date: data.date, total: data.total, category: data.categoryName, confidence: data.confidence },
        expected: item.truth,
        totalOk: Math.abs(data.total - item.truth.total) < 0.01,
        dateOk: data.date === item.truth.date,
        dateFlagged: !!data.dateWarning,
        categoryOk: data.categoryName === item.truth.category,
        merchantOk: merchantMatch(data.merchant, item.truth.merchant),
      });
    }
    console.log(rows[rows.length - 1].id, rows[rows.length - 1].totalOk ?? rows[rows.length - 1].rejected, ms + "ms");
  }
  const real = rows.filter(r => !r.nonReceipt);
  const pct = k => +(real.filter(r => r[k]).length / real.length * 100).toFixed(1);
  const lat = rows.map(r => r.ms).sort((a, b) => a - b);
  const summary = {
    generatedAt: new Date().toISOString(), target: BASE,
    receipts: real.length, nonReceiptImages: rows.length - real.length,
    totalExactMatch: pct("totalOk"), dateExactMatch: pct("dateOk"), categoryMatch: pct("categoryOk"), merchantMatch: pct("merchantOk"),
    wrongDatesFlaggedBySanityCheck: `${real.filter(r => !r.dateOk && r.dateFlagged).length}/${real.filter(r => !r.dateOk).length}`,
    allFourFieldsCorrect: +(real.filter(r => r.totalOk && r.dateOk && r.categoryOk && r.merchantOk).length / real.length * 100).toFixed(1),
    nonReceiptRejected: rows.filter(r => r.nonReceipt && r.rejected).length,
    meanLatencyMs: Math.round(lat.reduce((a, b) => a + b, 0) / lat.length), medianLatencyMs: lat[Math.floor(lat.length / 2)], maxLatencyMs: lat[lat.length - 1],
    meanConfidence: +(real.reduce((s, r) => s + (r.predicted?.confidence || 0), 0) / real.length).toFixed(3),
  };
  fs.writeFileSync(OUT, JSON.stringify({ summary, rows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
