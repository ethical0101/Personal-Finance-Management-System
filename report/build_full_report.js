const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, ImageRun, PageBreak, LevelFormat,
} = require("docx");

const ROOT = "E:/Software-Metric";
const SHOTS = path.join(ROOT, "report", "screenshots");
const results = JSON.parse(fs.readFileSync(path.join(ROOT, "analysis/results.json")));
const bn = JSON.parse(fs.readFileSync(path.join(ROOT, "analysis/bn_results.json")));

const ACCENT = "00625E";
const GREY = "4C5B55";

function h(text, level) { return new Paragraph({ text, heading: level, spacing: { before: 280, after: 120 } }); }
function p(text, opts = {}) { return new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 140 } }); }
function bullet(text) { return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 60 } }); }
function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

function cell(text, opts = {}) {
  const { header = false, width = 2000, shade = null } = opts;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: shade ? { type: ShadingType.CLEAR, fill: shade } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold: header, color: header ? "FFFFFF" : undefined, size: 18 })] })],
  });
}
function table(headerRow, rows, widths) {
  const wSum = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: wSum, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headerRow.map((t, i) => cell(t, { header: true, width: widths[i], shade: ACCENT })) }),
      ...rows.map((r, ri) => new TableRow({ children: r.map((t, i) => cell(t, { width: widths[i], shade: ri % 2 === 1 ? "F2F5F3" : undefined })) })),
    ],
  });
}
function image(dir, file, widthIn, heightIn, opts = {}) {
  const data = fs.readFileSync(path.join(dir, file));
  return new Paragraph({
    children: [new ImageRun({ type: "png", data, transformation: { width: widthIn * 96, height: heightIn * 96 } })],
    spacing: { after: 100 }, alignment: AlignmentType.CENTER, ...opts,
  });
}
function caption(text) {
  return new Paragraph({ children: [new TextRun({ text, italics: true, size: 18, color: GREY })], alignment: AlignmentType.CENTER, spacing: { after: 260 } });
}

// ---------- data pulled from Module 3/4 analysis ----------
const mods = results.dataset_summary.modules;
const totals = results.dataset_summary.totals;
const moduleRows = mods.slice().sort((a, b) => b.defect_density_per_kloc - a.defect_density_per_kloc).map(m => [
  m.module, String(m.loc), String(m.cyclomatic_complexity), String(m.coupling_cbo),
  String(m.test_coverage_pct), String(m.features_delivered), String(m.errors_logged),
  String(m.fault_count), String(m.defect_count), String(m.delay_days),
]);
const corrRows = results.correlation.tests.map(t => [t.pair, String(t.r), String(t.p_value), t.significant ? "Yes (p<0.05)" : "No"]);
const bnScenarioRows = bn.network1_project_risk.scenarios.map(s => [
  s.scenario, Object.keys(s.evidence).length ? Object.entries(s.evidence).map(([k, v]) => `${k}=${v}`).join(", ") : "none (prior)",
  `${(s.posterior_P.Low * 100).toFixed(1)}%`, `${(s.posterior_P.Medium * 100).toFixed(1)}%`, `${(s.posterior_P.High * 100).toFixed(1)}%`,
]);
const defectPredRows = bn.network2_defect_prediction.predictions.map(pr => [pr.CodeComplexity, pr.TestCoverage, `${(pr.P_DefectProne.No * 100).toFixed(0)}%`, `${(pr.P_DefectProne.Yes * 100).toFixed(0)}%`]);
const riskRows = bn.risk_register.map(r => [r.risk, r.likelihood, r.impact, r.mitigation]);

// ---------- Module 1: Ten scopes (verbatim from Review 0) ----------
const tenScopes = [
  ["1", "Cost and Effort Estimation", "Predicting the manpower, time, and budget required to design, build, and deploy each module of the system.", "Applied at the planning stage using COCOMO II / Function Point Analysis to estimate effort for the Transaction Engine, AI Recommendation Engine, Dashboard and Security modules; used to plan sprint capacity and cloud/GPU budget for AI model training."],
  ["2", "Productivity Measures", "Quantifying the output rate of the development team relative to effort expended.", "Story points completed per sprint, function points delivered per person-month and lines-of-code per person-day are tracked across the Agile sprints that build the finance app, helping compare planned vs. actual velocity."],
  ["3", "Data Collection", "Establishing the infrastructure, tools and procedures to gather raw metric data throughout the lifecycle.", "Git/JIRA logs, CI/CD pipeline results, static-analysis output, application/server logs and ML training logs are collected automatically to feed every other metrics scope, especially the chosen Quality Models and Measures scope."],
  ["4", "Quality Models and Measures", "Defining quality attributes (correctness, reliability, security, usability, maintainability) and quality models (e.g., ISO/IEC 25010) used to evaluate the product.", "SELECTED SCOPE — used to evaluate AI-prediction accuracy, data-security posture, usability of the finance dashboard and defect-free transaction processing (elaborated fully in Module 2)."],
  ["5", "Reliability Models", "Modeling and predicting failure occurrence and system dependability over time.", "Software Reliability Growth Models (e.g., Musa's model) and MTBF/MTTR statistics are applied to the transaction-processing and authentication services to guarantee banking-grade uptime for fund transfers and bill payments."],
  ["6", "Performance Evaluation and Models", "Measuring throughput, latency, and resource utilization of the running system.", "Load-testing of REST APIs, database query response time, and AI-model inference latency are measured under concurrent user load to ensure the recommendation engine responds within acceptable SLAs during peak usage."],
  ["7", "Structural and Complexity Metrics", "Quantifying internal code structure such as size, coupling, cohesion and control-flow complexity.", "Cyclomatic Complexity, Halstead metrics, coupling/cohesion (CBO, LCOM) are measured on the AI-engine and transaction-service source code to flag modules that need refactoring before release (implemented in Module 3's Decision Tree / Correlation analysis)."],
  ["8", "Capability-Maturity Assessment", "Assessing the maturity of the organization's/team's software processes.", "The development team's process maturity is benchmarked against CMMI levels to ensure disciplined, repeatable engineering practices, important for regulatory audit-readiness in a fintech product."],
  ["9", "Management by Metrics", "Using quantitative indicators/KPIs as the basis for managerial decision-making.", "Sprint burndown, defect density, customer satisfaction (CSAT) and ROI dashboards are reviewed by product leadership to decide feature prioritization, release readiness and resourcing for AI model retraining."],
  ["10", "Evaluation of Methods and Tools", "Comparing development methodologies, frameworks, and tools using objective metrics.", "Agile vs. Waterfall, TensorFlow vs. PyTorch, and competing CI/CD/testing tools are compared using metrics such as defect-leakage rate and time-to-market before being adopted."],
];

// ---------- Module 2: GQ(I)M sub-goals (condensed from Review 0) ----------
const subGoals = [
  {
    title: "Sub-Goal 1 — Accuracy and Reliability of AI-Driven Financial Predictions",
    goal: "Enhance user trust and financial decision-making by delivering highly accurate, AI-driven expense predictions, budget forecasts and personalized financial recommendations.",
    indicators: "MAPE trend chart over time; Recommendation Acceptance Rate (%) dashboard gauge; Model-Drift alert indicator flagging when current MAPE exceeds the training-time baseline by a set margin.",
    measures: "MAPE = (1/n) Σ |Actual − Predicted| / Actual × 100; Recommendation Acceptance Rate = (Accepted / Total Shown) × 100; Drift Score = Current-Period MAPE − Baseline MAPE.",
    implemented: "Implemented live: server/lib/ai.js forecasts each category by linear regression; every AI Insights recommendation carries an Accept/Dismiss action that POSTs to /api/insights/recommendations/:id/action — the exact Recommendation-Acceptance-Rate event this sub-goal specifies.",
  },
  {
    title: "Sub-Goal 2 — Data Security and Privacy of User Financial Information",
    goal: "Protect users' sensitive financial and personal data to comply with regulations (GDPR, PCI-DSS) and preserve user trust in the platform.",
    indicators: "Vulnerability Density (per KLOC) trend; Mean-Time-to-Patch (MTTP) chart; Encrypted-Sensitive-Fields (%) gauge; Failed-Login-Attempt anomaly graph.",
    measures: "Vulnerability Density = Total Vulnerabilities / KLOC; MTTP = Σ(Resolution Date − Discovery Date) / Number of Incidents; Encryption Coverage % = (Encrypted Fields / Total Sensitive Fields) × 100.",
    implemented: "Implemented live: AuthenticationService issues bcrypt-hashed passwords and JWT-bearer sessions; every API route except signup/login runs through requireAuth middleware; the Gemini API key and JWT secret are kept in a gitignored .env, never in source control.",
  },
  {
    title: "Sub-Goal 3 — Usability and User Experience of the Finance Dashboard",
    goal: "Increase user engagement and retention by providing an intuitive, easy-to-use personal-finance interface.",
    indicators: "Average Task-Completion-Time trend; SUS-Score gauge; Screen-level Drop-off-Rate funnel chart; UI-related Ticket-Volume trend.",
    measures: "Average Task-Completion Time = Σ(Task End − Task Start) / Number of Sessions; SUS Score via the standard 10-item questionnaire (0–100 scale); Drop-off Rate = (Users Exiting at Screen X / Users Entering Screen X) × 100.",
    implemented: "Implemented live: a single React SPA (app/web) with a persistent sidebar, one-click Add-Transaction modal from both Dashboard and Transactions, and a responsive mobile overlay nav — designed to minimize the clicks-per-task this sub-goal measures.",
  },
  {
    title: "Sub-Goal 4 — Functional Correctness and Reliable Transaction Processing",
    goal: "Ensure the system processes financial transactions accurately and reliably, without data loss or corruption, to maintain regulatory and user trust.",
    indicators: "Defect-Density (per KLOC) trend chart; System-Availability (%) gauge; Transaction-Failure-Rate trend; Test-Coverage (%) bar chart.",
    measures: "Defect Density = Total Defects in Module / KLOC; Availability % = (Total Uptime / Total Time) × 100; Transaction-Failure Rate = (Failed Transactions / Total Transactions) × 100; Test Coverage % = (Lines Covered / Total Lines) × 100.",
    implemented: "Implemented live: this exact sub-goal is fully instrumented in Module 3 below — real defect-density data across 12 modules, a decision tree classifying defect risk, and an I-MR control chart that catches a simulated transaction-failure regression in real time.",
  },
];

const doc = new Document({
  numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
    children: [
      // ---------------- Title ----------------
      new Paragraph({ text: "SOFTWARE METRICS", heading: HeadingLevel.TITLE, spacing: { after: 60 } }),
      new Paragraph({ text: "Full Project Report — Modules 1 to 4", heading: HeadingLevel.HEADING_2, spacing: { after: 20 } }),
      new Paragraph({ children: [new TextRun({ text: "Software Metrics-Driven AI-Powered Personal Finance Management System", bold: true, size: 26, color: ACCENT })], spacing: { after: 20 } }),
      new Paragraph({ children: [new TextRun({ text: "Wealthline — from the ten scopes of software metrics to a working, deployed product", italics: true, size: 22, color: GREY })], spacing: { after: 260 } }),
      p("Team Members:", { bold: true }),
      bullet("K Druthendra — 23MIS0213"),
      bullet("G Sai Santhosh — 23MIS0227"),
      bullet("P Siva Kiran — 23MIS0674"),
      bullet("Shaik Nihal — 23MIS0491"),

      h("How This Report Is Organized", HeadingLevel.HEADING_1),
      p("This is the consolidated report across all four modules of the syllabus, each tied to a concrete artifact in the shipped project rather than left as theory:"),
      bullet("Module 1 — the ten scopes of software metrics and why Quality Models and Measures was selected (Section 1-2)."),
      bullet("Module 2 — the complete GQ(I)M measurement plan for that scope, across four sub-goals, and the system's class diagram (Section 3-4)."),
      bullet("Module 3 — software metrics data collection, and four classical analysis techniques run on real data (Section 5)."),
      bullet("Module 4 — Bayesian networks for project-risk assessment and defect prediction, with a risk register (Section 6)."),
      bullet("Implementation — screenshots of Wealthline, the working personal-finance product all of the above measures (Section 7)."),

      // ================= MODULE 1 =================
      pageBreak(),
      h("1. Introduction", HeadingLevel.HEADING_1),
      p("The Software Metrics-Driven AI-Powered Personal Finance Management System is a fintech application, built and shipped under the name Wealthline, that helps individual users track income and expenses, manage budgets, monitor financial goals, and receive AI-generated, personalized recommendations (spending forecasts, saving suggestions, anomaly/fraud alerts). What differentiates this system from a conventional finance app is that every stage of its engineering lifecycle — from planning through operation — is governed by quantitative software-metrics practice. Metrics are used not only to manage the software project itself (cost, schedule, productivity) but also to continuously evaluate and improve the quality, reliability, performance, and trustworthiness of the AI components that drive the product's core value proposition."),

      h("2. The Ten Scopes of Software Metrics", HeadingLevel.HEADING_1),
      p("Software measurement is commonly organized into ten scopes covering the full breadth of what can be measured in a software product and process. The table below defines each scope and how it applies to Wealthline."),
      table(["#", "Scope", "Role / Definition", "How It Is Used in This Project"], tenScopes, [500, 2200, 3300, 3800]),

      h("Chosen Scope", HeadingLevel.HEADING_2),
      p("Of the ten scopes above, this report selects Quality Models and Measures for deep analysis. This scope is chosen because the central value proposition of the system — trustworthy AI-driven financial guidance operating on sensitive personal data — is fundamentally a quality problem. Correctness of transaction processing, accuracy and reliability of AI predictions, security/privacy of financial data, and usability of the interface are the attributes on which users will judge, adopt, or abandon the product."),

      // ================= MODULE 2 =================
      pageBreak(),
      h("3. Module 2 — Quality Models and Measures", HeadingLevel.HEADING_1),
      p("Quality Models and Measures is the branch of software metrics concerned with defining what \u201cgood quality software\u201d means for a given product and operationalizing that definition into concrete, collectible measures. The quality model is adapted from ISO/IEC 25010 and instantiated with four measurement sub-goals, each developed using the ten-step GQ(I)M method (Park, Goethert & Florac, Software Engineering Institute)."),

      ...subGoals.flatMap(sg => [
        h(sg.title, HeadingLevel.HEADING_2),
        p(sg.goal),
        table(["Step", "Detail"], [
          ["Indicators", sg.indicators],
          ["Measures", sg.measures],
        ], [1600, 6600]),
        new Paragraph({
          children: [new TextRun({ text: "Traced to implementation: ", bold: true, size: 19 }), new TextRun({ text: sg.implemented, size: 19, color: GREY })],
          spacing: { after: 220 },
        }),
      ]),

      h("4. System Class Diagram", HeadingLevel.HEADING_1),
      p("The class diagram below models the four architectural layers of the system: the Domain Layer (core financial entities), the AI Layer (machine-learning models and the recommendation engine), the Metrics Layer (the software-metrics-driven core implementing the GQ(I)M program at runtime), and the Service Layer (security, notification, and reporting services)."),
      image(SHOTS, "class_diagram.png", 6.3, 4.9),
      caption("Figure 1 — UML class diagram: Domain, AI, Metrics and Service layers."),
      bullet("Domain Layer: User, Account (abstract) with SavingsAccount, CheckingAccount, CreditCardAccount subtypes, Transaction, Category, Budget, FinancialGoal, RecurringBill."),
      bullet("AI Layer: AIModel (abstract) with ExpensePredictionModel and AnomalyDetectionModel subtypes, plus AIRecommendationEngine."),
      bullet("Metrics Layer: MetricsCollector, QualityIndicator, GQIMGoal and MetricRepository."),
      bullet("Service Layer: AuthenticationService, NotificationService, and ReportGenerator."),
      p("Every one of these classes has a direct, working counterpart in the shipped codebase — see Section 7 for the running product and app/README.md for the full API surface."),

      // ================= MODULE 3 =================
      pageBreak(),
      h("5. Module 3 — Software Metrics Data Collection", HeadingLevel.HEADING_1),
      p("The data-collection layer mirrors the pipeline promised in Scope 3 above: Git/JIRA history and CI/CD pipeline results feed structural metrics; static analysis feeds complexity/coupling/cohesion; application and server logs feed the fault/defect/delay record — all writing into a common MetricRepository."),
      p("Vocabulary: Error (root-cause mistake) → Fault (incorrect code artifact) → Defect (QA-confirmed fault); Feature (delivered capability); Delay (schedule slip in days)."),
      p(`Across the 12 modules and 16 sprints captured: ${totals.total_features_delivered} features were delivered, ${totals.total_errors_logged} errors were logged, ${totals.total_faults} were confirmed as faults in code, and ${totals.total_defects} were confirmed as QA defects. Average schedule delay was ${totals.avg_delay_days} days, with ${totals.max_delay_module} carrying the worst delay.`),
      table(["Module", "LOC", "Complexity", "Coupling", "Coverage %", "Features", "Errors", "Faults", "Defects", "Delay (d)"], moduleRows, [1900, 700, 900, 800, 900, 800, 700, 700, 800, 800]),

      h("5.1 Correlation and Statistical Test", HeadingLevel.HEADING_2),
      table(["Metric pair", "Pearson r", "p-value", "Significant?"], corrRows, [4600, 1400, 1400, 2100]),
      image(path.join(ROOT, "charts"), "correlation_heatmap.png", 5.0, 4.3),
      caption("Figure 2 — Correlation matrix across structural metrics, defect density and delay."),

      h("5.2 Decision Tree", HeadingLevel.HEADING_2),
      p(`A depth-3 decision tree classifies each module as High/Low defect risk from complexity, coupling, cohesion and coverage. Training-set accuracy: ${(results.decision_tree.accuracy_on_training_data * 100).toFixed(1)}%.`),
      image(path.join(ROOT, "charts"), "decision_tree.png", 6.0, 3.6),
      caption("Figure 3 — Decision tree classifying modules as High/Low defect risk."),

      h("5.3 Box Plot", HeadingLevel.HEADING_2),
      image(path.join(ROOT, "charts"), "box_plot.png", 5.4, 2.8),
      caption("Figure 4 — Box plots of defect density and schedule delay across the 12 modules."),

      h("5.4 Control Chart (I-MR)", HeadingLevel.HEADING_2),
      p(`Center line = ${results.control_chart.center_line}%, UCL = ${results.control_chart.UCL}%, LCL = ${results.control_chart.LCL}%. Week ${results.control_chart.out_of_control_weeks.join(", ")} breaches the UCL, corresponding to a simulated release regression — exactly the kind of assignable-cause signal Sub-Goal 4 (Section 3) calls for.`),
      image(path.join(ROOT, "charts"), "control_chart.png", 5.4, 3.4),
      caption("Figure 5 — I-MR control chart of weekly transaction failure rate."),

      // ================= MODULE 4 =================
      pageBreak(),
      h("6. Module 4 — Metrics for Decision Support", HeadingLevel.HEADING_1),
      p("Correlation tells us two variables move together; it does not tell us what happens to project risk if we change one of them. Bayesian networks close that gap: a small directed acyclic graph of conditional probability tables (CPTs) lets us ask \u201cwhat is P(ProjectRisk = High) if requirements are volatile AND the team is inexperienced?\u201d and get an exact answer by enumeration."),

      h("6.1 Network 1 — Project Risk Assessment", HeadingLevel.HEADING_2),
      p("Requirement Volatility (R) and Team Experience (T) are root causes; they determine Schedule Delay (S) and Defect Density (D) — the same observables Module 3 measures directly; S and D jointly determine Project Risk (P)."),
      table(["Scenario", "Evidence", "P(Low)", "P(Medium)", "P(High)"], bnScenarioRows, [3600, 2300, 1200, 1200, 1200]),
      p("The worst-case scenario (volatile requirements + inexperienced team) pushes P(High risk) to 55.0%, more than double the 28.1% baseline. Upskilling the team back to High experience — holding requirements volatility constant — pulls P(High risk) back to 26.5%, below baseline: the network shows which lever actually moves the outcome."),

      h("6.2 Network 2 — Software Defect Prediction", HeadingLevel.HEADING_2),
      p("Calibrated directly against the Module 3 dataset: Code Complexity and Test Coverage are split at their sample median across the 12 modules."),
      table(["Code complexity", "Test coverage", "P(DefectProne=No)", "P(DefectProne=Yes)"], defectPredRows, [2600, 2600, 2600, 2600]),

      h("6.3 Risk Register and Overcome Ideas", HeadingLevel.HEADING_2),
      table(["Risk", "Likelihood", "Impact", "Overcome idea"], riskRows, [2600, 1300, 1100, 5400]),

      // ================= IMPLEMENTATION =================
      pageBreak(),
      h("7. Implementation — The Working Product", HeadingLevel.HEADING_1),
      p("Every class in Section 4's diagram and every measure in Sections 5-6 is backed by a real, running application: a React 19 + Vite single-page frontend (app/web) talking to a Node/Express REST API (app/server) with JWT authentication, bcrypt password hashing, and a Gemini-API-powered recommendation layer. The screenshots below are taken directly from the deployed app, not mock-ups."),

      h("7.1 Authentication", HeadingLevel.HEADING_2),
      p("AuthenticationService from the class diagram, implemented with bcrypt-hashed passwords and JWT bearer sessions (server/routes/auth.js)."),
      image(SHOTS, "01-auth-login.png", 6.3, 4.0),
      caption("Figure 6 — Login screen."),

      h("7.2 Dashboard", HeadingLevel.HEADING_2),
      p("Net worth, monthly income/expense, savings rate, spend-by-category and recent transactions — all computed live from the User's Accounts and Transactions (server/routes/dashboard.js)."),
      image(SHOTS, "03-dashboard.png", 6.3, 3.9),
      caption("Figure 7 — Dashboard."),

      h("7.3 Transactions and Anomaly Detection", HeadingLevel.HEADING_2),
      p("Every new expense is scored by the AnomalyDetectionModel (z-score against the category's trailing history, |z| \u2265 2.5 flags it) — visible below as the \u20b96,000 outlier flagged z=137.31 against a normal \u20b9400-500 grocery history."),
      image(SHOTS, "04-transactions.png", 6.3, 3.9),
      caption("Figure 8 — Transactions, with the anomaly flag visible."),

      h("7.4 AI Insights — Gemini-Powered Recommendations", HeadingLevel.HEADING_2),
      p("The AIRecommendationEngine combines the deterministic forecast/budget/anomaly rules with live calls to the Gemini API (gemini-3.6-flash), which reads the user's real financial snapshot and returns specific, actionable recommendations. Each carries Accept/Dismiss actions that log the Recommendation Acceptance Rate metric from Sub-Goal 1 (Section 3)."),
      image(SHOTS, "07-ai-insights.png", 6.3, 4.6),
      caption("Figure 9 — AI Insights, showing rule-based and Gemini-generated recommendations (dark theme)."),

      h("7.5 Budgets and Goals", HeadingLevel.HEADING_2),
      image(SHOTS, "05-budgets.png", 6.3, 3.9),
      caption("Figure 10 — Budgets, tracked live against category spend."),
      image(SHOTS, "06-goals.png", 6.3, 3.9),
      caption("Figure 11 — Financial goals with contribution tracking."),

      h("7.6 Metrics Command Deck — Embedded In-App", HeadingLevel.HEADING_2),
      p("The Module 3/4 metrics dashboard from this report is not a separate document to dig up during the review — it is served by the same Express server under /metrics and embedded directly as a tab inside Wealthline, so the whole measurement program is one click away from the product it measures."),
      image(SHOTS, "09-metrics-tab.png", 6.3, 3.9),
      caption("Figure 12 — The Metrics Command Deck, open as an in-app tab."),

      h("7.7 Notifications", HeadingLevel.HEADING_2),
      image(SHOTS, "08-notifications.png", 6.3, 3.9),
      caption("Figure 13 — Notifications, driven by the anomaly detector."),

      h("8. Conclusion", HeadingLevel.HEADING_1),
      p("Across all four modules, every measurement plan in this report has a working counterpart in the shipped product: the ten scopes framed the problem (Module 1); the GQ(I)M plan for Quality Models and Measures made it concrete and traceable to specific classes in the architecture (Module 2); the data-collection pipeline and classical analysis techniques evaluated real, generated data for that architecture (Module 3); and Bayesian networks turned that data into an actionable, causal risk model with a mitigation plan (Module 4). Wealthline — the React/Express personal-finance app in Section 7 — is the object all of this measures, running end-to-end from signup to AI-generated financial advice."),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(path.join(ROOT, "report/Full_Project_Report_Modules_1-4.docx"), buf);
  console.log("wrote report, bytes:", buf.length);
});
