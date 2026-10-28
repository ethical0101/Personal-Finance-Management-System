/* Builds Wealthline_Project_Report.docx -- Times New Roman, headings 14pt, body 12pt.
   Section order follows the faculty's specification. Numbers come from analysis/*.json. */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ImageRun, PageBreak, Footer, PageNumber, LevelFormat,
} = require("docx");

const ROOT = path.resolve(__dirname, "..");
const SH = path.join(__dirname, "screenshots_v3");
const FIG = path.join(__dirname, "figures");
const CH = path.join(ROOT, "charts");
const A = f => JSON.parse(fs.readFileSync(path.join(ROOT, "analysis", f)));
const res = A("results.json"), bn = A("bn_results.json"), em = A("eval_models.json"), es = A("eval_scan.json"), tcv = A("eval_tree_cv.json");
const lat = fs.readFileSync(path.join(ROOT, "analysis", "eval_latency.txt"), "utf8").trim().split("\n").map(l => { const i = l.indexOf(" "); return [l.slice(0, i), JSON.parse(l.slice(i + 1))]; });

const FONT = "Times New Roman", BODY = 24, HEAD = 28;
const run = (text, o = {}) => new TextRun({ text, font: FONT, size: BODY, color: "000000", ...o });
const P = (text, o = {}) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 140, line: 300 }, children: Array.isArray(text) ? text : [run(text, o)] });
const H = text => new Paragraph({ spacing: { before: 320, after: 140 }, keepNext: true, children: [run(text, { bold: true, size: HEAD })] });
const H2 = text => new Paragraph({ spacing: { before: 200, after: 100 }, keepNext: true, children: [run(text, { bold: true, size: HEAD })] });
const B = text => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 70 }, alignment: AlignmentType.JUSTIFIED, children: [run(text)] });
const BR = () => new Paragraph({ children: [new PageBreak()] });
const CAP = text => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 }, children: [run(text, { italics: true, size: 22 })] });

function dims(file) { const d = fs.readFileSync(file).subarray(16, 24); return [d.readUInt32BE(0), d.readUInt32BE(4)]; }
function IMG(file, caption, maxW = 600) {
  if (process.env.NOIMG) return [CAP(caption)];
  const [w, h] = dims(file);
  const width = Math.min(maxW, w), height = Math.round(width * h / w);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120 }, children: [new ImageRun({ type: "png", data: fs.readFileSync(file), transformation: { width, height } })] }),
    CAP(caption),
  ];
}

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
function cell(t, { head = false, w } = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: BORDERS,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({ children: [run(String(t), { size: 21, bold: head })] })],
  });
}
function T(headers, rows, widths) {
  const sum = widths.reduce((a, b) => a + b, 0);
  return [new Table({
    width: { size: sum, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, { head: true, w: widths[i] })) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, { w: widths[i],  })) }))],
  }), new Paragraph({ spacing: { after: 160 }, children: [] })];
}
const pct = x => (x * 100).toFixed(1) + "%";

const c = [];
/* ---------------- 1. TITLE ---------------- */
const center = (text, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [run(text, o)] });
c.push(new Paragraph({ spacing: { before: 1800 }, children: [] }));
c.push(center("WEALTHLINE", { bold: true, size: 56 }));
c.push(center("Software Metrics-Driven, AI-Powered Personal Finance Management System", { bold: true, size: 32 }));
c.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
c.push(center("Project Report", { size: 28 }));
c.push(center("Software Metrics (Modules 1 – 4) with Application Implementation", { size: 24 }));
c.push(new Paragraph({ spacing: { before: 500 }, children: [] }));
c.push(center("Submitted by", { bold: true, size: 26 }));
for (const t of ["K Druthendra — 23MIS0213", "G Sai Santhosh — 23MIS0227", "P Siva Kiran — 23MIS0674", "Shaik Nihal — 23MIS0491"]) c.push(center(t, { size: 26 }));
c.push(new Paragraph({ spacing: { before: 500 }, children: [] }));
c.push(center("Live application: https://wealthline-eight.vercel.app", { size: 22 }));
c.push(center("Source code: https://github.com/ethical0101/Personal-Finance-Management-System", { size: 22 }));
c.push(BR());

/* ---------------- 2. PROBLEM STATEMENT ---------------- */
c.push(H("1. Problem Statement"));
c.push(P("Most people already have a money-tracking app. What they do not have is the habit of using it. Typing in every expense by hand takes time, so the records end up incomplete, a budget gets set once and then forgotten, and the overspend is only noticed after the month is over. Many apps also just show charts without saying what the user should do next, and the ones that add AI usually do not check what the AI produces."));
c.push(P("This is also a software engineering project, and a project that is not measured is hard to manage. So we had two questions to answer together:"));
c.push(B("Product question: how can a personal finance system cut down the effort of recording spending (for example by reading a photo of a bill), keep the budget up to date by itself, and give the user a real reason to open it every day?"));
c.push(B("Engineering question: how can software metrics (GQ(I)M, ISO/IEC 25010 quality attributes, defect taxonomy, statistical and probabilistic models) be used to plan, monitor and predict the quality and risk of building that product?"));
c.push(P("This report describes Wealthline, a working full-stack system built to answer both questions, along with the measurements showing how well each part works and where it falls short."));

/* ---------------- 3. INTRODUCTION & ABSTRACT ---------------- */
c.push(H("2. Introduction and Abstract"));
c.push(H2("Abstract"));
c.push(P(`Wealthline is a web-based personal finance management system that combines everyday money tools with software metrics analysis. The user can scan a photo of a bill. A vision model reads the merchant, date, total, category and line items, and the server then works out what saving that bill would do to the matching budget, checks whether it is a duplicate, and asks the user to confirm. The application also gives a safe-to-spend daily amount, subscription detection, goal completion estimates, a what-if simulator, a month-end projection, automatic budget suggestions, a 0 to 100 financial health score, and an Ask AI assistant that answers only from the user's own data. Unusual expenses are found with a z-score rule and next month's spending is forecast with exponential smoothing. For the engineering side, a Python pipeline applies GQ(I)M, decision tree classification, box plots, an individuals and moving range control chart, three correlation measures and two Bayesian networks to the project data, and the resulting dashboard is embedded in the application. On our test sets the bill reader got the exact total on ${es.summary.totalExactMatch}% of ${es.summary.receipts} bills and rejected the one image that was not a bill. The anomaly rule reached a precision of ${em.anomalyDetector.byThreshold["2.5"].precision} at a recall of ${em.anomalyDetector.byThreshold["2.5"].recall}, and exponential smoothing brought the forecasting error (MAPE) down from ${em.forecaster.overall.linearRegression.MAPE}% with linear regression to ${em.forecaster.overall.exponentialSmoothing.MAPE}%.`));
c.push(H2("Introduction"));
c.push(P("Personal finance management is partly about everyday usability and partly about data analysis. Three things shaped our design. First, the biggest problem in tracking money is data entry, so reducing the typing helps more than adding another chart. Second, numbers only matter when they change a decision; a user wants to know whether they can afford something today, not only what they spent last month. Third, any AI feature that deals with money needs limits: the model can read and suggest, but ordinary code should check the result and the user should confirm it."));
c.push(P("The project was done over four review modules. Modules 1 and 2 set the goals and the measurement plan using the Goal-Question-(Indicator)-Metric approach and linked them to the ISO/IEC 25010 quality model. Module 3 collected and analysed software metrics (classification, distribution, control and correlation analysis). Module 4 used Bayesian networks for project risk and defect prediction. In this final stage we turned the plan into a deployed application, and added direct bill scanning, budget updates from scanned bills, more everyday features, a redesigned interface and a measured evaluation."));

/* ---------------- 4. SUMMARY ---------------- */
c.push(H("3. Summary"));
c.push(...T(["Aspect", "What was done"], [
  ["Application", "React 19 single-page app + Node/Express API on Vercel, MongoDB Atlas storage, JWT authentication"],
  ["Direct bill scanning", "Photo, then Gemini vision reads merchant, date, total, category and items, then budget impact, duplicate and date checks, then the user confirms"],
  ["Budget manipulation", "Scanned or manual expenses update the category budget instantly; auto-budget suggests limits from history; the scan screen warns before a limit would be exceeded"],
  ["Why use it daily", "Safe-to-spend today, subscription detector, goal ETA, what-if simulator, month-end projection, health score, Ask AI"],
  ["AI methods", "z-score anomaly detection, exponential-smoothing forecast, LLM extraction / recommendations / Q&A with model fallback and caching"],
  ["Metrics program", "GQ(I)M, ISO 25010, error→fault→failure→bug taxonomy, decision tree, box plot, I-MR chart, Pearson/Spearman/Kendall, two Bayesian networks"],
  ["Evaluation", "10 labelled bills + 1 non-bill; 300 simulated anomaly trials; 2,400 forecast backtests; leave-one-out decision-tree test; API latency"],
  ["UI", "Interface redesigned with a warm background and pastel tiles, a collapsible sidebar, a docked AI assistant panel, light and dark themes and a mobile layout"],
], [2300, 7060]));
c.push(P("The main findings are as follows. Bill totals were read exactly on every test bill, and the date check caught the one date the model got wrong. The anomaly rule is very precise but misses small anomalies. Exponential smoothing did better than linear regression. The decision tree scores 91.7% on the data it was trained on but only 58.3% under leave-one-out testing, so with 12 modules it only explains the data and cannot be relied on to predict."));

/* ---------------- 5. METHODOLOGY ---------------- */
c.push(H("4. Methodology (with Classification Methods)"));
c.push(H2("4.1 Measurement planning — GQ(I)M and ISO/IEC 25010"));
c.push(P("We used the Goal-Question-(Indicator)-Metric method (Park, Goethert and Florac, 1996). A business goal is broken into questions, each question into indicators (how the answer will be shown) and then into metrics that can actually be collected. The overall goal was to deliver a reliable, maintainable finance application on time. The sub-goals covered code quality, defect behaviour, schedule and delivery, and AI accuracy. The ISO/IEC 25010 quality characteristics were matched to things we can measure: functional suitability (extraction accuracy), performance efficiency (API latency), reliability (fault handling, retry and fallback), maintainability (complexity, coupling, cohesion, coverage) and security (hashed passwords, token authentication)."));
c.push(H2("4.2 Defect taxonomy"));
c.push(P("We keep four terms apart and measure each one. An error is a mistake made by a person. A fault is the wrong code that results from it. A failure is the wrong behaviour the user sees when the fault runs. A bug is the report that gets tracked. The module dataset records errors logged, fault count, defect count and failures observed for each module, which lets us calculate defect density (defects per thousand lines of code, KLOC)."));
c.push(H2("4.3 Classification methods used"));
c.push(...T(["Task", "Classes", "Method", "Rule / parameters"], [
  ["Defect-proneness of a module", "High / Low", "Decision tree (CART, scikit-learn)", "Label = defect density above / below median; features: complexity, CBO, LCOM, coverage; max depth 3, min leaf 2"],
  ["Is an expense unusual?", "Normal / Anomaly", "z-score rule", "z = (x − μ) ÷ σ over the same user's previous expenses in that category; anomaly if |z| ≥ 2.5 and at least 4 prior transactions"],
  ["Process stability", "In control / Out of control", "I-MR control chart", "Limits = mean ± 2.66 × average moving range; points outside flagged"],
  ["Bill category", "One of the user's categories", "Large language model, constrained output", "Model must return exactly one category name from the user's list; the server falls back to “Other” if no match"],
  ["Is this image a bill?", "Bill / Not a bill", "Large language model", "Returns {\"error\":\"not_a_receipt\"}; server answers HTTP 422"],
  ["Project risk", "Low / Medium / High", "Bayesian network (variable elimination)", "Nodes: requirement volatility, team experience, schedule delay, defect density, project risk"],
  ["Forecast confidence", "Low / Medium", "History length rule", "Medium with 6 or more months of history, otherwise Low"],
], [1900, 1500, 2300, 3660]));
c.push(H2("4.4 Statistical analyses"));
c.push(B("Box plot: distribution, median, inter-quartile range and outliers of the metrics for each module."));
c.push(B("Individuals and moving range (I-MR) control chart over the sprint metrics to detect special-cause variation (week 12 was flagged)."));
c.push(B("Correlation: Pearson (linear), Spearman (rank) and Kendall (concordance) on the same pairs. With small samples any single coefficient can mislead, so we report all three and call a finding robust only when they agree."));
c.push(B("Hypothesis test: a two-sample t-test comparing defect density in low-coverage and high-coverage modules."));
c.push(H2("4.5 Forecasting"));
c.push(P("Monthly spending for each category is forecast with simple exponential smoothing, S(t) = a x(t) + (1 - a) S(t-1), with a = 0.4. We first used linear regression, but when we compared it with three simpler baselines (Section 9) it was the weakest of the trend-following methods on noisy household data, so we replaced it."));
c.push(H2("4.6 Bill scanning method"));
c.push(P("The photo is resized in the browser and sent to the API. The server first looks in the cache for an identical earlier request. If there is none, it sends the image and the user's category list to a Gemini vision model with a prompt that asks for strict JSON (merchant, date, total, currency, category, items, confidence). If one model is out of quota or unavailable, a fallback chain tries the next one, and a request is retried once if the server is overloaded. The reply is then checked by normal code: the total must be positive, the date must be valid and within about a year of today (otherwise the user sees a check-the-date warning), the category must exist, and an existing transaction with the same date and amount raises a duplicate warning. The budget impact is calculated from the stored transactions. Nothing is saved until the user presses Confirm, and the image itself is never stored."));
c.push(H2("4.7 Bayesian networks"));
c.push(P("Network 1 models project risk. Requirement volatility (R) and team experience (T) affect schedule delay (S) and defect density (D), and those two together decide the project risk (P). The posterior probabilities are calculated by exact enumeration for different sets of evidence. Network 2 predicts whether a module is defect-prone from its code complexity and test coverage."));
c.push(H2("4.8 Evaluation protocol"));
c.push(B("Bill scanning: 10 labelled bill images (8 clean and 2 deliberately hard, one rotated 5 degrees with blur and low contrast and one in a handwriting-style font, with the correct answers in report/eval_receipts/ground_truth.json) plus one image that is not a bill. Fields compared: total (exact), date (exact), merchant (token overlap ≥ 60%), category (exact)."));
c.push(B("Anomaly detector: 300 simulated users with 200 transactions each, 10% of the transactions multiplied by a random factor between 1.5 and 5, thresholds 2.0, 2.5 and 3.0."));
c.push(B("Forecaster: 300 simulated monthly series (three trend slopes) with 8 one-step-ahead forecasts each, 2,400 forecasts in total, compared with last-month, 3-month moving average and linear regression using MAPE."));
c.push(B("Decision tree: leave-one-out cross-validation on the 12 modules, compared with the majority-class baseline."));
c.push(B("API latency: 11 timed requests per endpoint after one warm-up, on the local server and on the Vercel deployment."));

/* ---------------- 6. RELATED WORK ---------------- */
c.push(H("5. Related Work"));
c.push(P("Measurement planning. The GQM family was introduced by Basili and colleagues, and the SEI guidebook by Park, Goethert and Florac added indicators to it; that is the version we used in Modules 1 and 2 [1]. ISO/IEC 25010 gives the vocabulary for what to measure [2]."));
c.push(P("Code metrics and defect prediction. McCabe's cyclomatic complexity [3] and the Chidamber and Kemerer object-oriented metrics (coupling between objects, lack of cohesion) [4] are the usual code-level predictors. Fenton and Neil reviewed defect prediction models and found that simple size and complexity measures predict defects only weakly, and that causal models such as Bayesian networks explain more [5]. Our results point the same way: lack of cohesion was the strongest signal and the tree did not generalise."));
c.push(P("Anomaly detection. Chandola, Banerjee and Kumar survey statistical anomaly detection and note that simple parametric rules such as z-scores work well when the data are roughly Gaussian and some history exists, but are poor at small deviations [6]. This is what we saw in our own tests."));
c.push(P("Forecasting. Hyndman and Koehler discuss MAPE and other accuracy measures, and why naive and smoothing baselines are hard to beat on short, noisy series [7]. This is why we compared against baselines."));
c.push(P("Receipt understanding. The ICDAR 2019 SROIE competition defined the task of extracting the company, date, address and total from scanned receipts, which is close to the set of fields we extract [8]. Older systems used OCR followed by rule-based or sequence-labelling models. Large multimodal models such as Gemini can read the image directly and also guess the purchase category [9]. We did not build a new recogniser. What we added is the checking around it: ordinary code checks, budget impact, duplicate and date warnings, caching, model fallback and a measured evaluation."));
c.push(P("Authentication. Sessions use JSON Web Tokens as specified in RFC 7519 [10]."));

/* ---------------- 7. ARCHITECTURE ---------------- */
c.push(H("6. Architecture Diagram"));
c.push(P("Figure 1 shows the whole system. The browser loads a React single-page application from the Vercel CDN. Requests to /api are rewritten to one serverless Express function, which checks the JWT, runs the route, and reads or writes MongoDB through a small data layer. The AI routes build a compact snapshot of the user's data, look in a MongoDB-backed cache, and only then call the Gemini API. The Python metrics pipeline runs offline, and its self-contained dashboard is served as static content inside the Metrics tab."));
c.push(...IMG(path.join(FIG, "architecture.png"), "Figure 1. Wealthline system architecture (detailed)", 620));
c.push(P("Figure 2 expands the bill-scanning path from the photo to the budget decision."));
c.push(...IMG(path.join(FIG, "scan_flow.png"), "Figure 2. Bill-scanning pipeline", 620));
c.push(H2("Component responsibilities"));
c.push(...T(["Component", "Responsibility", "Key design decision"], [
  ["React SPA", "All screens, charts, theme, image resize", "Plain CSS design tokens; light/dark by media query and toggle"],
  ["Express routes", "Auth, CRUD, dashboard, insights, scan", "express-async-errors so a failed database call returns an error instead of crashing"],
  ["db.js", "Collection access and AI cache", "Predicate-based interface kept from the first version; fine for small per-user data"],
  ["ai.js", "Anomaly z-score, exponential-smoothing forecast", "Pure functions, unit-testable, evaluated by simulation"],
  ["gemini.js", "Every LLM call", "Model fallback chain, retry on 5xx, “quota” reason, never throws"],
  ["aicache.js", "Cache AI answers by request hash", "Repeated identical requests cost no quota and answer in about 150 ms"],
  ["Python pipeline", "Module 3 and 4 analyses", "Self-contained HTML output embedded in the app"],
], [1900, 3300, 4160]));

/* ---------------- 8. PROPOSED SYSTEM ---------------- */
c.push(H("7. Proposed System"));
c.push(P("The proposed system is Wealthline. The main idea is that the app should do the boring work and tell the user what matters today."));
c.push(H2("7.1 Why a user needs it — features and the reason for each"));
c.push(...T(["Feature", "What the user gets", "Why they would open the app"], [
  ["Scan a bill", "Photo becomes a ready-to-save expense", "Saves typing; shows the budget effect before saving"],
  ["Safe to spend today", "One number: what can be spent today without breaking the plan", "Answers the daily question “can I afford this?”"],
  ["Budget auto-update and warnings", "Budgets move as bills are saved; the scan screen warns when a bill would push a budget over its limit", "Prevents overspending before it happens"],
  ["Auto-budget", "Suggested limits from past spending", "No blank-page budgeting"],
  ["Subscription detector", "Finds recurring charges and yearly cost", "Often finds forgotten subscriptions"],
  ["Goal ETA", "Date a savings goal will be reached at the current pace", "Makes goals concrete"],
  ["What-if simulator", "Effect of cutting a category by x%", "Turns advice into a decision"],
  ["Month-end projection", "Where this month will finish at the current rate", "Early warning"],
  ["Financial health score", "0–100 with four-part breakdown", "A single number to improve"],
  ["Ask AI", "Plain-English questions about the user's own money", "Faster than reading charts; answers only from the user's data"],
  ["Anomaly alerts and forecast", "Unusual expenses flagged; next-month spend predicted", "Catches mistakes and fraud, prepares the next month"],
  ["Account settings", "Edit profile, change password, theme, export or clear data, delete account", "Users stay in control of their data"],
  ["Live camera capture", "Webcam preview on desktop, native camera on phones, upload fallback", "Scan a bill without leaving the app"],
  ["Metrics tab", "Engineering-quality dashboard of the project itself", "Shows the system is engineered and measured"],
], [2200, 3700, 3460]));
c.push(H2("7.2 Screens of the working system"));
const shots = [
  ["01-auth-login.png", "Figure 3. Sign-in screen"],
  ["02-dashboard.png", "Figure 4. Dashboard: health score, safe-to-spend, trend, upcoming bills"],
  ["03-scan-idle.png", "Figure 5. Scan Bill — choose a photo, use the camera, or try a sample"],
  ["04-scan-result.png", "Figure 6. Scan result — extracted fields, budget impact warning and confirmation"],
  ["05-transactions.png", "Figure 7. Transactions with search, filters and CSV export"],
  ["06-budgets.png", "Figure 8. Budgets with live spent / remaining"],
  ["07-auto-budget.png", "Figure 9. Auto-budget suggestions"],
  ["08-goals.png", "Figure 10. Goals with estimated completion date"],
  ["09-bills.png", "Figure 11. Recurring bills"],
  ["10-insights.png", "Figure 12. Insights: anomalies, forecast, subscriptions and recommendations"],
  ["11-ask-ai.png", "Figure 13. Ask AI answering from the user's own data"],
  ["12-notifications.png", "Figure 14. Notifications"],
  ["13-metrics.png", "Figure 15. Metrics tab (Modules 3 and 4 dashboard embedded in the app)"],
  ["09b-accounts.png", "Figure 16. Accounts"],
  ["17-settings.png", "Figure 17. Account settings: profile, password, theme, data export, clear data, delete account"],
  ["18-sidebar-collapsed.png", "Figure 18. Collapsible sidebar (icon rail) — the page content moves with it and is never covered"],
  ["14-dashboard-dark.png", "Figure 19. Dark theme"],
];
for (const [f, cap] of shots) c.push(...IMG(path.join(SH, f), cap, 560));
c.push(...IMG(path.join(SH, "16-mobile-dashboard.png"), "Figure 20. Mobile layout", 200));
c.push(H2("7.3 Security and privacy"));
c.push(B("Passwords are hashed with bcrypt; sessions use signed JWTs; every route except sign-in and sign-up checks the token and filters data by user."));
c.push(B("Bill images are processed in memory and are not stored. Only the extracted fields the user confirms are saved."));
c.push(B("Ask AI sends a compact summary of the user's own data, never other users' data, and is instructed to answer only from that summary."));
c.push(B("API keys and database credentials live in environment variables and are excluded from the repository."));

/* ---------------- 9. DATASET ---------------- */
c.push(H("8. Dataset / Data / Database"));
c.push(H2("8.1 Application database (MongoDB Atlas, database “wealthline”)"));
c.push(...T(["Collection", "Main fields", "Purpose"], [
  ["users", "id, name, email, passwordHash", "Accounts and login"],
  ["accounts", "userId, name, type, balance", "Savings, checking, credit card"],
  ["categories", "userId, name, colour", "Spending categories (Income + expense categories)"],
  ["transactions", "userId, accountId, categoryId, type, amount, date, note", "Income and expenses (scanned bills become expenses)"],
  ["budgets", "userId, categoryId, month, monthlyLimit", "Monthly category limits"],
  ["goals", "userId, name, target, saved, deadline", "Savings goals"],
  ["bills", "userId, name, amount, dueDay", "Recurring bills"],
  ["notifications / recommendation events", "userId, message, status", "Alerts; accepted / dismissed recommendations"],
  ["aicache", "key, value, expiresAt", "Cached AI responses (scan 30 days, insights 1 day)"],
], [2300, 3900, 3160]));
c.push(P("A demo account with realistic data (demo@gmail.com) is created by app/server/scripts/seed_demo.js, with all dates generated relative to today so that the current month is never empty."));
c.push(H2("8.2 Software-metrics datasets (data/ folder)"));
c.push(B("module_metrics.csv — 12 application modules; columns: LOC, cyclomatic complexity, coupling (CBO), lack of cohesion (LCOM), test coverage %, features delivered, errors logged, fault count, defect count, failures observed, delay days, average severity, defect density per KLOC."));
c.push(B("sprint_metrics.csv — 16 weekly sprint observations used for the control chart and trend analysis."));
c.push(P("Both files are generated by analysis/generate_data.py from a fixed random seed. They are synthetic project data made for this course and are not measurements from a real industrial project, so any conclusions drawn from them are only illustrative."));
c.push(H2("8.3 Evaluation datasets"));
c.push(B("report/eval_receipts/ — 11 generated images (e01–e11) and ground_truth.json. The bills are synthetic renderings of typical Indian retail formats (grocery, restaurant, fuel, pharmacy, utility, etc.); two are degraded on purpose; e11 is a non-bill image."));
c.push(B("Simulated anomaly and forecast series are produced inside analysis scripts with a fixed seed (20261026) so the results can be reproduced with node app/server/scripts/evaluate_models.js."));
c.push(P("Source code, data and scripts: https://github.com/ethical0101/Personal-Finance-Management-System"));

/* ---------------- 10. PERFORMANCE ---------------- */
c.push(H("9. Performance Metrics, Working Model and Prediction Model Description"));
c.push(H2("9.1 Bill scanning accuracy"));
const s = es.summary;
c.push(...T(["Measure", "Result"], [
  ["Bills evaluated (clean + degraded)", `${s.receipts} (including 2 degraded)`],
  ["Total amount exactly correct", s.totalExactMatch + "%"],
  ["Category correct", s.categoryMatch + "%"],
  ["Date exactly correct", s.dateExactMatch + "%"],
  ["Merchant matched (≥60% word overlap)", s.merchantMatch + "%"],
  ["All four fields correct", s.allFourFieldsCorrect + "%"],
  ["Non-bill image rejected", `${s.nonReceiptRejected} of ${s.nonReceiptImages}`],
  ["Wrong date caught by date sanity check", s.wrongDatesFlaggedBySanityCheck],
  ["Latency, first (uncached) run, mean", "about 3.3 s per bill"],
  ["Latency, repeated identical bill (cache hit), mean / max", `${s.meanLatencyMs} ms / ${s.maxLatencyMs} ms`],
], [5200, 4160]));
c.push(P("The only error (bill e04) was a fuel receipt with the date printed as 18-10-26. The model read it as 2018 instead of 2026. The server's date check now flags any date more than about a year from today, and the scan screen shows a check-the-date warning, so this kind of error cannot be saved without the user noticing. The model reported a confidence of 1.0 on every bill, including the wrong one, so the confidence value is not a reliable signal and the app does not depend on it."));
c.push(P("Limitations: ten bills is a small test, and the bills are synthetic renderings and not photos taken with a phone, so results will be lower on crumpled, rotated or handwritten bills. The Gemini free tier allows only a limited number of requests per day for each model, which is why we added caching and a fallback chain. When every model is out of quota the app shows a clear message and the user can add the expense by hand."));
c.push(H2("9.2 Anomaly detector"));
const at = em.anomalyDetector.byThreshold;
c.push(...T(["Threshold |z|", "Precision", "Recall", "F1", "False-positive rate"], ["2", "2.5", "3"].map(k => [k + (k === "2.5" ? " (used)" : ""), at[k].precision, at[k].recall, at[k].f1, at[k].falsePositiveRate]), [2200, 1700, 1700, 1700, 2060]));
const rm = em.anomalyDetector.recallByMagnitude;
c.push(...T(["Injected anomaly size", "Number injected", "Recall at |z| ≥ 2.5"], Object.entries(rm).map(([k, v]) => [k + " normal spend", v.injected, pct(v.recallAt2_5)]), [3400, 2800, 3160]));
c.push(P("At the chosen threshold almost every alert is a real one (precision 98%), but only 63% of the injected anomalies are found. The detector is very good with large spikes (95% of expenses that were 3 to 5 times normal) and poor with mild ones (7% of those 1.5 to 2 times normal). That is acceptable for a notification feature, where false alarms annoy users, but it should be called a large unusual expense detector and not a general fraud detector."));
c.push(H2("9.3 Spending forecaster"));
const fo = em.forecaster.overall;
c.push(...T(["Method", "MAPE (lower is better)", "Std. deviation"], [
  ["Exponential smoothing, α = 0.4 (used)", fo.exponentialSmoothing.MAPE + "%", fo.exponentialSmoothing.sd],
  ["3-month moving average", fo.movingAverage3.MAPE + "%", fo.movingAverage3.sd],
  ["Linear regression (previous method)", fo.linearRegression.MAPE + "%", fo.linearRegression.sd],
  ["Naive (last month repeated)", fo.naiveLastMonth.MAPE + "%", fo.naiveLastMonth.sd],
], [4600, 2600, 2160]));
c.push(P(`Over ${em.forecaster.totalForecasts} forecasts, exponential smoothing did better than linear regression in ${pct(em.forecaster.smoothingBeatsRegression)} of cases and better than the naive baseline in ${pct(em.forecaster.smoothingBeatsNaive)}. Its advantage over the 3-month moving average is small (${pct(em.forecaster.smoothingBeatsMovingAvg)} win rate), so smoothing and moving averages are about equally good, and both beat regression on short noisy history. These series are simulated, so the real accuracy still has to be checked on real user data.`));
c.push(H2("9.4 Module 3 — metrics analysis results"));
c.push(P(`Decision tree. The tree classifies modules as High or Low defect risk. It reaches ${pct(res.decision_tree.accuracy_on_training_data)} accuracy on the data it was trained on, but leave-one-out cross-validation gives only ${pct(tcv.loocv_accuracy)} against a ${pct(tcv.majority_baseline)} majority-class baseline (n = ${tcv.n}). Lack of cohesion carries ${pct(res.decision_tree.feature_importances.cohesion_lcom)} of the importance and coupling ${pct(res.decision_tree.feature_importances.coupling_cbo)}. With only 12 modules the tree helps explain the data but should not be trusted as a predictor.`));
c.push(...IMG(path.join(CH, "decision_tree.png"), "Figure 21. Decision tree for defect-proneness", 560));
c.push(P("Box plot and control chart. The box plot shows the spread of each metric across the modules. The individuals and moving range chart over the sprint series puts week 12 outside the control limits, which means it is special-cause variation that needs to be investigated and not normal noise."));
c.push(...IMG(path.join(CH, "box_plot.png"), "Figure 22. Box plot of module metrics", 520));
c.push(...IMG(path.join(CH, "control_chart.png"), "Figure 23. I-MR control chart", 520));
c.push(P("Correlation. The same three pairs were tested with all three coefficients."));
c.push(...T(["Pair", "Pearson r (p)", "Spearman ρ (p)", "Kendall τ (p)"], res.correlation.tests.map(t => [t.pair, `${t.pearson.r} (${t.pearson.p_value})`, `${t.spearman.rho} (${t.spearman.p_value})`, `${t.kendall.tau} (${t.kendall.p_value})`]), [3300, 2000, 2000, 2060]));
c.push(P(`Complexity against defect density is positive under all three measures, and the Spearman (p = 0.043) and Kendall (p = 0.033) tests are significant at 5%. Coupling against delay is also positive under all three, but only Pearson reaches 5%. Test coverage against defect density is negative but not significant under any of the measures, and the t-test between low-coverage and high-coverage modules is not significant either (t = ${res.correlation.t_test_low_vs_high_coverage.t_stat}, p = ${res.correlation.t_test_low_vs_high_coverage.p_value}), so we do not claim that coverage reduces defects on this dataset.`));
c.push(...IMG(path.join(CH, "correlation_three_types.png"), "Figure 24. Pearson, Spearman and Kendall comparison", 520));
c.push(H2("9.5 Module 4 — Bayesian network results"));
const sc = bn.network1_project_risk.scenarios;
c.push(...T(["Scenario (evidence)", "P(Low)", "P(Medium)", "P(High)"], sc.map(x => [x.scenario, x.posterior_P.Low, x.posterior_P.Medium, x.posterior_P.High]), [5200, 1300, 1400, 1460]));
c.push(P("The network puts numbers on how the risk changes. With no evidence the probability of High project risk is 28.1%. Volatile requirements with an inexperienced team raise it to 55.0%, and upskilling the team under the same volatile requirements brings it back to 26.5%, which gives a measurable reason for doing that mitigation. Network 2 predicts a module as defect-prone with probability 0.75 when complexity is high and coverage is low, and 0.0 when both are low. The conditional probability tables were set by us and not learned from data, so these results show how to reason with the model and do not prove its numbers."));
c.push(H2("9.6 System performance (API latency)"));
c.push(...T(["Endpoint", "Local p50 / p95 (ms)", "Vercel p50 / p95 (ms)"], Object.keys(lat[0][1]).map(k => [k, `${lat[0][1][k].p50} / ${lat[0][1][k].p95}`, `${lat[1][1][k].p50} / ${lat[1][1][k].p95}`]), [3600, 2880, 2880]));
c.push(P("The Vercel times include the network round trip from the test machine and a data layer that filters in memory. Every endpoint answers in under one second at the median, which is fine for this scale. If the data grows, the filters should be moved into the MongoDB queries."));
c.push(H2("9.7 Working model of the application (end-to-end)"));
c.push(B("A user signs in, sees the dashboard with health score and safe-to-spend, taps Scan Bill, and selects a photo."));
c.push(B("The server returns the merchant, date, total and category, the effect on that category's budget (for example a category going from under its limit to over it, with the over-by amount), and whether it looks like a duplicate."));
c.push(B("The user edits any field and confirms; the transaction is stored, the account balance and budgets update, and an unusually large expense raises a notification through the anomaly check against the user's history."));
c.push(B("The Insights page then shows the forecast, anomalies, subscriptions and AI recommendations, and Ask AI answers questions from the same data."));

/* ---------------- 11. CONCLUSION ---------------- */
c.push(H("10. Conclusion"));
c.push(P("Wealthline shows that a personal finance system can reduce the effort of data entry by scanning bills directly while still leaving the user in control: the AI reads the bill, normal code checks it, and the user confirms. The system updates budgets from scanned bills, warns before a limit is crossed, and has features that give people a reason to come back every day. The measurements show where it is strong (exact totals on all test bills, 98% precision on anomaly alerts, forecasting better than regression) and where it is weak (small anomalies are missed, the confidence score tells us nothing, the decision tree does not generalise, and the free AI quota limits heavy use). We fixed what we could (the date check, the forecaster, caching and fallback) and reported the rest, which is part of applying software metrics to our own work."));
c.push(P("The software metrics modules gave the project some structure. GQ(I)M connected the goals to the measurements, the defect taxonomy defined what to count, the statistical tools showed which signals hold up (complexity and cohesion) and which do not (coverage on this dataset), and the Bayesian networks turned risk into numbers that can support mitigation decisions."));

/* ---------------- 12. FUTURE WORK ---------------- */
c.push(H("11. Future Work"));
for (const t of [
  "Test bill scanning on real phone photographs (rotated, crumpled, other languages, handwritten) with a larger set of at least 100 bills, and add a local OCR fallback so scanning still works when the cloud quota is used up.",
  "Make the extraction confidence meaningful, for example by checking that the line items add up to the total, so poor reads can be flagged.",
  "Bank-statement and UPI SMS import, and multi-currency support.",
  "Push data filters down into MongoDB queries and add indexes for larger user volumes; add automated unit and integration tests with coverage reporting in CI.",
  "Replace the simulated metrics datasets with real repository data (commits, issues, CI results), repeat the correlation and Bayesian analyses, and learn the Bayesian network tables from data.",
  "Better detection of mild anomalies using robust statistics (median and MAD) or seasonal models, and rules for each merchant.",
  "Shared household budgets, receipts attached to transactions with user consent, and push notifications.",
  "Accessibility audit and localisation (Telugu, Hindi, Tamil) of the interface.",
]) c.push(B(t));

/* ---------------- 13. REFERENCES ---------------- */
c.push(H("12. References"));
const refs = [
  "[1] R. E. Park, W. B. Goethert, W. A. Florac, “Goal-Driven Software Measurement — A Guidebook,” CMU/SEI-96-HB-002, Software Engineering Institute, 1996. https://insights.sei.cmu.edu/library/goal-driven-software-measurement-a-guidebook/",
  "[2] ISO/IEC 25010:2011, “Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models.” https://www.iso.org/standard/35733.html",
  "[3] T. J. McCabe, “A Complexity Measure,” IEEE Transactions on Software Engineering, vol. SE-2, no. 4, pp. 308–320, 1976. https://doi.org/10.1109/TSE.1976.233837",
  "[4] S. R. Chidamber and C. F. Kemerer, “A Metrics Suite for Object Oriented Design,” IEEE Transactions on Software Engineering, vol. 20, no. 6, pp. 476–493, 1994. https://doi.org/10.1109/32.295895",
  "[5] N. E. Fenton and M. Neil, “A Critique of Software Defect Prediction Models,” IEEE Transactions on Software Engineering, vol. 25, no. 5, pp. 675–689, 1999. https://doi.org/10.1109/32.815326",
  "[6] V. Chandola, A. Banerjee, V. Kumar, “Anomaly Detection: A Survey,” ACM Computing Surveys, vol. 41, no. 3, article 15, 2009. https://doi.org/10.1145/1541880.1541882",
  "[7] R. J. Hyndman and A. B. Koehler, “Another look at measures of forecast accuracy,” International Journal of Forecasting, vol. 22, no. 4, pp. 679–688, 2006. https://doi.org/10.1016/j.ijforecast.2006.03.001",
  "[8] Z. Huang et al., “ICDAR2019 Competition on Scanned Receipt OCR and Information Extraction,” ICDAR 2019. https://doi.org/10.1109/ICDAR.2019.00244 (task description also at arXiv:2103.10213)",
  "[9] Gemini Team, Google, “Gemini: A Family of Highly Capable Multimodal Models,” arXiv:2312.11805, 2023. https://arxiv.org/abs/2312.11805",
  "[10] M. Jones, J. Bradley, N. Sakimura, “JSON Web Token (JWT),” RFC 7519, IETF, 2015. https://www.rfc-editor.org/rfc/rfc7519",
  "[11] Project repository and live application: https://github.com/ethical0101/Personal-Finance-Management-System ; https://wealthline-eight.vercel.app",
];
for (const r of refs) c.push(new Paragraph({ spacing: { after: 100 }, indent: { left: 360, hanging: 360 }, children: [run(r)] }));

const doc = new Document({
  creator: "Wealthline Team",
  title: "Wealthline Project Report",
  numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  styles: { default: { document: { run: { font: FONT, size: BODY } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1300, right: 1300 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["Page ", PageNumber.CURRENT], font: FONT, size: 20, color: "000000" })] })] }) },
    children: process.env.LIMIT ? c.slice(0, +process.env.LIMIT) : c,
  }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(path.join(__dirname, process.env.OUT||"Wealthline_Project_Report.docx"), b); console.log("ok", (b.length / 1e6).toFixed(1) + " MB"); });
