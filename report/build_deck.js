/* Builds Wealthline_Presentation.pptx (16:9). Section order follows the faculty's PPT specification. */
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const ROOT = path.resolve(__dirname, "..");
const SH = path.join(__dirname, "screenshots_v2");
const FIG = path.join(__dirname, "figures");
const CH = path.join(ROOT, "charts");
const A = f => JSON.parse(fs.readFileSync(path.join(ROOT, "analysis", f)));
const em = A("eval_models.json"), es = A("eval_scan.json").summary, tcv = A("eval_tree_cv.json"), bn = A("bn_results.json");

const INK = "14161C", SUB = "4B5563", ORANGE = "4C5CF0", SOFT = "E7E9FF", BG = "F5F6FA", WHITE = "FFFFFF", GREEN = "047857", LINE = "D1D5DB";
const FONT = "Calibri";
const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pptx.title = "Wealthline";

let n = 0;
function slide(title, kicker) {
  const s = pptx.addSlide(); n++;
  s.background = { color: WHITE };
  s.addShape("rect", { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: ORANGE }, line: { color: ORANGE } });
  if (kicker) s.addText(kicker.toUpperCase(), { x: 0.6, y: 0.3, w: 9, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: ORANGE, charSpacing: 2 });
  s.addText(title, { x: 0.6, y: 0.58, w: 12.2, h: 0.8, fontFace: FONT, fontSize: 30, bold: true, color: INK });
  s.addText(String(n), { x: 12.4, y: 7.0, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 11, color: SUB, align: "right" });
  s.addText("Wealthline", { x: 0.6, y: 7.0, w: 3, h: 0.3, fontFace: FONT, fontSize: 11, color: SUB });
  return s;
}
function bullets(s, items, o = {}) {
  s.addText(items.map(t => ({ text: t, options: { bullet: { indent: 18 }, breakLine: true, paraSpaceAfter: 8 } })),
    { x: o.x ?? 0.6, y: o.y ?? 1.6, w: o.w ?? 12, h: o.h ?? 5, fontFace: FONT, fontSize: o.size ?? 18, color: INK, valign: "top" });
}
function img(s, file, x, y, w) {
  const d = fs.readFileSync(file).subarray(16, 24); const iw = d.readUInt32BE(0), ih = d.readUInt32BE(4);
  s.addImage({ path: file, x, y, w, h: w * ih / iw });
  return w * ih / iw;
}
function card(s, x, y, w, h, head, body, o = {}) {
  s.addShape("roundRect", { x, y, w, h, fill: { color: o.fill ?? BG }, line: { color: o.line ?? LINE, width: 1 }, rectRadius: 0.08 });
  s.addText(head, { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.4, fontFace: FONT, fontSize: o.hs ?? 17, bold: true, color: o.hc ?? ORANGE });
  s.addText(body, { x: x + 0.2, y: y + 0.55, w: w - 0.4, h: h - 0.65, fontFace: FONT, fontSize: o.bs ?? 14, color: INK, valign: "top" });
}
function table(s, rows, x, y, w, colW, o = {}) {
  const data = rows.map((r, i) => r.map(c => ({ text: String(c), options: { bold: i === 0, color: i === 0 ? WHITE : INK, fill: { color: i === 0 ? INK : i % 2 ? WHITE : BG }, fontFace: FONT, fontSize: o.size ?? 14 } })));
  s.addTable(data, { x, y, w, colW, border: { type: "solid", color: LINE, pt: 0.75 }, margin: 0.06 });
}

/* 1. TEAM */
{
  const s = pptx.addSlide(); n++;
  s.background = { color: INK };
  s.addShape("rect", { x: 0, y: 0, w: 0.35, h: 7.5, fill: { color: ORANGE }, line: { color: ORANGE } });
  s.addText("WEALTHLINE", { x: 0.9, y: 1.0, w: 11, h: 0.9, fontFace: FONT, fontSize: 54, bold: true, color: WHITE });
  s.addText("Software Metrics-Driven, AI-Powered Personal Finance Management System", { x: 0.9, y: 1.95, w: 11, h: 0.9, fontFace: FONT, fontSize: 24, color: "B8C0FF" });
  s.addText("TEAM", { x: 0.9, y: 3.55, w: 4, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: "8D98FF", charSpacing: 3 });
  const team = [["K Druthendra", "23MIS0213"], ["G Sai Santhosh", "23MIS0227"], ["P Siva Kiran", "23MIS0674"], ["Shaik Nihal", "23MIS0491"]];
  team.forEach(([nm, id], i) => {
    s.addShape("roundRect", { x: 0.9 + i * 3.0, y: 4.05, w: 2.8, h: 1.2, fill: { color: "1F2937" }, line: { color: "374151" }, rectRadius: 0.08 });
    s.addText(nm, { x: 1.0 + i * 3.0, y: 4.15, w: 2.6, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: WHITE });
    s.addText(id, { x: 1.0 + i * 3.0, y: 4.7, w: 2.6, h: 0.4, fontFace: "Consolas", fontSize: 16, color: "B8C0FF" });
  });
  s.addText("Live: wealthline-eight.vercel.app   ·   Code: github.com/ethical0101/Personal-Finance-Management-System", { x: 0.9, y: 6.4, w: 12, h: 0.4, fontFace: FONT, fontSize: 14, color: "9CA3AF" });
}

/* 2. PROBLEM */
{
  const s = slide("People stop tracking money because it is tedious", "Problem statement");
  card(s, 0.6, 1.7, 3.9, 2.5, "Manual entry kills the habit", "Typing every expense is slow, so records go stale and budgets are ignored.");
  card(s, 4.7, 1.7, 3.9, 2.5, "Numbers without decisions", "Charts show last month. Users need “can I afford this today?”");
  card(s, 8.8, 1.7, 3.9, 2.5, "Unchecked AI", "AI that touches money must be verified by code and confirmed by the user.");
  s.addShape("roundRect", { x: 0.6, y: 4.55, w: 12.1, h: 1.9, fill: { color: SOFT }, line: { color: ORANGE, width: 1 }, rectRadius: 0.08 });
  s.addText([
    { text: "Our two questions\n", options: { bold: true, color: ORANGE, fontSize: 16 } },
    { text: "Product: how do we cut the effort of recording spending, keep budgets current automatically, and give users a reason to open the app daily?\n", options: { fontSize: 16 } },
    { text: "Engineering: how do we use software metrics to plan, monitor and predict the quality and risk of building it?", options: { fontSize: 16 } },
  ], { x: 0.85, y: 4.6, w: 11.6, h: 1.8, fontFace: FONT, color: INK, valign: "middle" });
}

/* 3. INTRO & ABSTRACT */
{
  const s = slide("Scan a bill. Stay on budget. Measure the engineering.", "Introduction and abstract");
  bullets(s, [
    "Wealthline: a full-stack web app (React + Node + MongoDB, deployed on Vercel) for personal finance.",
    "Photograph a bill → AI reads merchant, date, total, category, items → server shows the budget impact and duplicate warning → user confirms.",
    "Everyday tools: safe-to-spend, subscription detector, goal ETA, what-if, health score, Ask AI.",
    "Anomaly detection (z-score) and spending forecast (exponential smoothing).",
    "A Python metrics program (GQ(I)M, decision tree, control chart, correlations, Bayesian networks) is embedded in the app.",
    "Measured on our test sets and reported honestly, including what does not work.",
  ], { size: 19, h: 5.2 });
}

/* 4. SUMMARY */
{
  const s = slide("What was built and what we measured", "Summary");
  table(s, [
    ["Area", "Delivered"],
    ["Bill scanning", "Photo → Gemini vision → verified fields → budget impact → confirm"],
    ["Budget manipulation", "Saved bills update the category budget; auto-budget from history"],
    ["Daily-use features", "Safe-to-spend, subscriptions, goal ETA, what-if, month-end projection, health score, Ask AI"],
    ["AI methods", "z-score anomalies, exponential-smoothing forecast, LLM extraction / advice / Q&A"],
    ["Metrics program", "GQ(I)M, ISO 25010, defect taxonomy, decision tree, I-MR chart, 3 correlations, 2 Bayesian networks"],
    ["UI", "Full redesign: warm canvas, pastel tiles, icon rail, docked AI assistant; light / dark / mobile"],
  ], 0.6, 1.6, 12.1, [2.8, 9.3], { size: 15 });
  s.addText(`Bill totals exact on ${es.totalExactMatch}% of ${es.receipts} test bills  ·  anomaly precision ${em.anomalyDetector.byThreshold["2.5"].precision}  ·  forecast MAPE ${em.forecaster.overall.exponentialSmoothing.MAPE}% vs ${em.forecaster.overall.linearRegression.MAPE}% (regression)`, { x: 0.6, y: 6.2, w: 12.1, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: ORANGE });
}

/* 5. METHODOLOGY (two slides) */
{
  const s = slide("Plan with GQ(I)M, classify with measurable rules", "Methodology — planning and classification");
  card(s, 0.6, 1.6, 4.0, 2.4, "GQ(I)M + ISO 25010", "Goal → Questions → Indicators → Metrics. Quality attributes: suitability, efficiency, reliability, maintainability, security.", { bs: 14 });
  card(s, 4.75, 1.6, 4.0, 2.4, "Defect taxonomy", "Error (human) → Fault (code) → Failure (behaviour) → Bug (report). Defect density = defects per KLOC.", { bs: 14 });
  card(s, 8.9, 1.6, 3.8, 2.4, "Statistics", "Box plot, I-MR control chart, Pearson / Spearman / Kendall, t-test.", { bs: 14 });
  table(s, [
    ["Task", "Classes", "Method"],
    ["Module defect-proneness", "High / Low", "Decision tree (depth 3)"],
    ["Unusual expense", "Normal / Anomaly", "z = (x − μ) / σ, flag if |z| ≥ 2.5"],
    ["Bill category / is it a bill?", "User's categories / Bill, not a bill", "Vision LLM, constrained output, checked by server"],
    ["Project risk", "Low / Medium / High", "Bayesian network"],
  ], 0.6, 4.25, 12.1, [3.6, 3.6, 4.9], { size: 14 });
}
{
  const s = slide("Bill scanning: AI reads, code checks, user confirms", "Methodology — scanning and forecasting");
  bullets(s, [
    "Cache lookup (hash of image + categories) → Gemini vision with model fallback and retry → JSON fields.",
    "Server checks: total > 0, date plausible (flags dates far from today), category exists, duplicate (same date and amount).",
    "Budget impact computed from stored transactions: spent before / after, % of limit, over-by amount.",
    "Nothing saved until the user confirms; image never stored.",
    "Forecast: exponential smoothing S(t) = 0.4·x(t) + 0.6·S(t−1) — chosen after a 2,400-forecast backtest beat linear regression.",
    "Bayesian risk model: requirement volatility + team experience → schedule delay + defect density → project risk.",
  ], { size: 18 });
}

/* 6. ARCHITECTURE */
{
  const s = slide("System architecture", "Architecture diagram (detailed)");
  img(s, path.join(FIG, "architecture.png"), 1.35, 1.35, 8.6 * 1.0);
  s.addText("Client → Vercel edge (CDN + rewrite) → Express API (JWT) → AI services (z-score, smoothing, Gemini with fallback + cache) → MongoDB Atlas. Python metrics pipeline is embedded as the Metrics tab.", { x: 10.0, y: 1.6, w: 3.1, h: 4.5, fontFace: FONT, fontSize: 13, color: SUB, valign: "top" });
}
{
  const s = slide("Bill-scanning pipeline", "Architecture diagram — scan flow");
  img(s, path.join(FIG, "scan_flow.png"), 0.6, 1.9, 12.1);
}

/* 7. PROPOSED SYSTEM */
{
  const s = slide("Proposed system: the app does the boring work", "Proposed system");
  const f = [
    ["Scan a bill", "Photo → ready-to-save expense with budget impact"],
    ["Safe to spend today", "One daily number you can trust"],
    ["Subscription detector", "Finds forgotten recurring charges"],
    ["Goal ETA + what-if", "Turns advice into a decision"],
    ["Health score", "0–100 with a four-part breakdown"],
    ["Ask AI", "Plain-English questions on your own data"],
  ];
  f.forEach(([h, b], i) => card(s, 0.6 + (i % 3) * 4.1, 1.6 + Math.floor(i / 3) * 2.2, 3.9, 2.0, h, b, { bs: 15, fill: i === 0 ? SOFT : BG, line: i === 0 ? ORANGE : LINE }));
  s.addText("Also: auto-budget, month-end projection, anomaly alerts, CSV export, light / dark / mobile, Metrics tab.", { x: 0.6, y: 6.2, w: 12.1, h: 0.5, fontFace: FONT, fontSize: 16, color: SUB });
}

/* 8. DATASET */
{
  const s = slide("Dataset and database", "Dataset / database description");
  table(s, [
    ["Source", "Content"],
    ["MongoDB Atlas “wealthline”", "users, accounts, categories, transactions, budgets, goals, bills, notifications, recommendation events, aicache"],
    ["data/module_metrics.csv", "12 modules: LOC, complexity, CBO, LCOM, coverage, errors, faults, defects, failures, delay, defect density"],
    ["data/sprint_metrics.csv", "16 weekly sprint observations for the control chart"],
    ["report/eval_receipts/", "10 labelled bills (2 hard) + 1 non-bill, with ground truth"],
    ["Simulations (seed 20261026)", "300 anomaly trials × 200 transactions; 300 forecast series × 8 forecasts"],
  ], 0.6, 1.6, 12.1, [3.8, 8.3], { size: 15 });
  s.addText("Metrics datasets and evaluation bills are synthetic, created for this course. Demo login: demo@gmail.com / 12345678", { x: 0.6, y: 6.0, w: 12.1, h: 0.6, fontFace: FONT, fontSize: 15, color: SUB });
}

/* 9. SCREENSHOTS */
{
  const s = slide("Working model", "Screenshot of working model");
  img(s, path.join(SH, "02-dashboard.png"), 0.6, 1.5, 6.0);
  img(s, path.join(SH, "04-scan-result.png"), 6.75, 1.5, 6.0);
  s.addText("Dashboard: health score, safe-to-spend, trend", { x: 0.6, y: 5.35, w: 6, h: 0.4, fontFace: FONT, fontSize: 14, color: SUB, align: "center" });
  s.addText("Scan result: extracted fields + budget impact warning", { x: 6.75, y: 5.35, w: 6, h: 0.4, fontFace: FONT, fontSize: 14, color: SUB, align: "center" });
}
{
  const s = slide("Insights, Ask AI and mobile", "Screenshot of working model");
  img(s, path.join(SH, "10-insights.png"), 0.6, 1.5, 4.9);
  img(s, path.join(SH, "11-ask-ai.png"), 5.65, 1.5, 4.9);
  img(s, path.join(SH, "16-mobile-dashboard.png"), 10.8, 1.4, 1.9);
  s.addText("AI Insights", { x: 0.6, y: 4.6, w: 4.9, h: 0.4, fontFace: FONT, fontSize: 14, color: SUB, align: "center" });
  s.addText("Ask AI", { x: 5.65, y: 4.6, w: 4.9, h: 0.4, fontFace: FONT, fontSize: 14, color: SUB, align: "center" });
  s.addText("Mobile", { x: 10.4, y: 6.4, w: 2.7, h: 0.4, fontFace: FONT, fontSize: 14, color: SUB, align: "center" });
}
{
  const s = slide("Budgets, goals, subscriptions and dark theme", "Screenshot of working model");
  [["06-budgets.png", "Budgets"], ["08-goals.png", "Goals + ETA"], ["09-bills.png", "Subscriptions"], ["14-dashboard-dark.png", "Dark theme"]].forEach(([f, l], i) => {
    const x = 0.6 + (i % 2) * 6.15, y = 1.45 + Math.floor(i / 2) * 2.85;
    img(s, path.join(SH, f), x, y, 4.0);
    s.addText(l, { x: x + 4.05, y: y + 1.0, w: 2.0, h: 0.4, fontFace: FONT, fontSize: 14, color: SUB });
  });
}

/* 10. PERFORMANCE */
{
  const s = slide("Measured results", "Performance of the working model");
  const at = em.anomalyDetector.byThreshold["2.5"], fo = em.forecaster.overall;
  const kp = [
    [es.totalExactMatch + "%", `exact bill totals (${es.receipts} bills)`],
    [es.nonReceiptRejected + "/" + es.nonReceiptImages, "non-bill image rejected"],
    [at.precision, "anomaly precision (recall " + at.recall + ")"],
    [fo.exponentialSmoothing.MAPE + "%", "forecast MAPE (regression " + fo.linearRegression.MAPE + "%)"],
  ];
  kp.forEach(([v, l], i) => {
    s.addShape("roundRect", { x: 0.6 + i * 3.05, y: 1.55, w: 2.9, h: 1.7, fill: { color: SOFT }, line: { color: ORANGE }, rectRadius: 0.08 });
    s.addText(String(v), { x: 0.6 + i * 3.05, y: 1.65, w: 2.9, h: 0.9, fontFace: FONT, fontSize: 38, bold: true, color: ORANGE, align: "center" });
    s.addText(l, { x: 0.7 + i * 3.05, y: 2.55, w: 2.7, h: 0.65, fontFace: FONT, fontSize: 13, color: INK, align: "center", valign: "top" });
  });
  table(s, [
    ["Test", "Result", "Honest note"],
    ["Bill scan, all 4 fields", es.allFourFieldsCorrect + "%", "1 bill misread date (“18-10-26”); now flagged by a date check"],
    ["Anomaly recall", `95% for 3–5× spikes; 7% for 1.5–2×`, "Great on big spikes, blind to mild ones"],
    ["Decision tree", `training 91.7%, leave-one-out ${(tcv.loocv_accuracy * 100).toFixed(1)}%`, `Baseline 50%: explanatory, not predictive on 12 modules`],
    ["API latency (Vercel p50)", "0.65 – 0.87 s", "Local p50 52 – 174 ms"],
  ], 0.6, 3.6, 12.1, [3.0, 4.2, 4.9], { size: 14 });
}
{
  const s = slide("Module 3 and 4 analysis in the app", "Performance — metrics analysis");
  img(s, path.join(CH, "control_chart.png"), 0.6, 1.5, 4.6);
  img(s, path.join(CH, "decision_tree.png"), 5.4, 1.5, 7.3);
  const sc = bn.network1_project_risk.scenarios;
  s.addText(`I-MR chart flags week 12.  Complexity ↔ defect density positive under Pearson, Spearman and Kendall.  P(High project risk): ${(sc[0].posterior_P.High * 100).toFixed(0)}% baseline → ${(sc[1].posterior_P.High * 100).toFixed(0)}% worst case → ${(sc[5].posterior_P.High * 100).toFixed(0)}% with team upskilling.`, { x: 0.6, y: 5.75, w: 12.1, h: 0.9, fontFace: FONT, fontSize: 16, bold: true, color: INK });
}

/* 11. NOVELTY */
{
  const s = slide("Why this is different — and why it is justified", "Novelty and innovation / justification");
  card(s, 0.6, 1.6, 3.9, 2.55, "AI proposes, code verifies", "The model only reads the bill. Budget impact, duplicate and date checks are deterministic server code; the user confirms.", { bs: 14 });
  card(s, 4.7, 1.6, 3.9, 2.55, "Evidence-based choices", "Forecaster replaced after a backtest. Detector thresholds chosen from precision / recall. Limits reported.", { bs: 14 });
  card(s, 8.8, 1.6, 3.9, 2.55, "Engineering + product in one", "The metrics program that planned the project ships inside the app as the Metrics tab.", { bs: 14 });
  card(s, 0.6, 4.35, 3.9, 2.35, "Reliable on a free tier", "Model fallback chain, retry, MongoDB response cache, clear “quota used up” message.", { bs: 14 });
  card(s, 4.7, 4.35, 3.9, 2.35, "A reason to return daily", "Safe-to-spend, subscriptions, goal ETA, what-if, health score, Ask AI.", { bs: 14 });
  card(s, 8.8, 4.35, 3.9, 2.35, "Privacy-aware", "Bill images never stored; Ask AI sees only the user's own summary; secrets kept out of the repo.", { bs: 14 });
}

/* 12. CONCLUSION & FUTURE */
{
  const s = slide("Conclusion and future work", "Conclusion and future work");
  s.addText("Conclusion", { x: 0.6, y: 1.5, w: 6, h: 0.4, fontFace: FONT, fontSize: 20, bold: true, color: ORANGE });
  bullets(s, [
    "Direct bill scanning cuts entry effort while the user stays in control.",
    "Budgets update from scanned bills and warn before a limit is crossed.",
    "Strong: exact totals, 98% alert precision, forecast beats regression.",
    "Limits: mild anomalies missed, confidence score uninformative, tree does not generalise, free AI quota.",
  ], { x: 0.6, y: 1.95, w: 6.0, h: 4.6, size: 16 });
  s.addText("Future work", { x: 7.0, y: 1.5, w: 6, h: 0.4, fontFace: FONT, fontSize: 20, bold: true, color: ORANGE });
  bullets(s, [
    "Test on 100+ real phone photos; add offline OCR fallback.",
    "Calibrate confidence (line items must sum to total).",
    "Bank / UPI SMS import; multi-currency.",
    "Automated tests + CI coverage; DB-side filtering.",
    "Replace simulated metrics with real repository data; learn Bayesian tables from data.",
    "Regional-language UI and accessibility audit.",
  ], { x: 7.0, y: 1.95, w: 5.8, h: 4.6, size: 16 });
}

pptx.writeFile({ fileName: path.join(__dirname, "Wealthline_Presentation.pptx") }).then(f => console.log("ok", f));
