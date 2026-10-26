const express = require("express");
const db = require("../db");
const { forecastNextMonth, monthlyTotals } = require("../lib/ai");
const { generateRecommendations, askFinance } = require("../lib/gemini");
const { buildSnapshot } = require("../lib/snapshot");

const router = express.Router();

router.get("/forecast", async (req, res) => {
  const categories = await db.find("categories", c => c.userId === req.userId && c.name !== "Income");
  const results = (await Promise.all(categories.map(async cat => {
    const expenses = await db.find("transactions", t => t.userId === req.userId && t.categoryId === cat.id && t.type === "expense");
    if (expenses.length === 0) return null;
    const { forecast, method, confidence, history } = forecastNextMonth(expenses);
    return { categoryId: cat.id, categoryName: cat.name, forecast, method, confidence, history };
  }))).filter(Boolean);
  res.json(results);
});

router.get("/recommendations", async (req, res) => {
  const categories = await db.find("categories", c => c.userId === req.userId);
  const budgets = await db.find("budgets", b => b.userId === req.userId && b.month === new Date().toISOString().slice(0, 7));
  const recs = [];

  for (const budget of budgets) {
    const cat = categories.find(c => c.id === budget.categoryId);
    if (!cat) continue;
    const expenses = await db.find("transactions", t => t.userId === req.userId && t.categoryId === cat.id && t.type === "expense");
    const { forecast } = forecastNextMonth(expenses);
    if (forecast > budget.monthlyLimit) {
      recs.push({
        id: `forecast-${budget.id}`,
        type: "forecast-over-budget",
        severity: "warn",
        message: `Projected ${cat.name} spend (₹${forecast.toFixed(0)}) is on track to exceed your ₹${budget.monthlyLimit.toFixed(0)} budget this month.`,
        suggestion: `Trim discretionary ${cat.name} purchases by ~₹${(forecast - budget.monthlyLimit).toFixed(0)} to stay on budget.`,
      });
    }
  }

  const anomalies = (await db.find("transactions", t => t.userId === req.userId && t.flaggedAnomaly))
    .slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  for (const a of anomalies) {
    const cat = categories.find(c => c.id === a.categoryId);
    recs.push({
      id: `anomaly-${a.id}`,
      type: "anomaly",
      severity: "critical",
      message: `Flagged as unusual: ₹${a.amount.toFixed(2)} in ${cat ? cat.name : "Uncategorized"} on ${a.date} (z = ${a.anomalyZScore}).`,
      suggestion: "Review this transaction to confirm it wasn't fraudulent or a data-entry error.",
    });
  }

  const totalIncome = (await db.find("transactions", t => t.userId === req.userId && t.type === "income")).reduce((s, t) => s + t.amount, 0);
  const totalExpense = (await db.find("transactions", t => t.userId === req.userId && t.type === "expense")).reduce((s, t) => s + t.amount, 0);
  if (totalIncome > 0) {
    const savingsRate = (totalIncome - totalExpense) / totalIncome;
    if (savingsRate < 0.1) {
      recs.push({
        id: "savings-rate-low",
        type: "savings-rate",
        severity: "warn",
        message: `Your overall savings rate is ${(savingsRate * 100).toFixed(0)}% of income, below the recommended 10-20%.`,
        suggestion: "Consider automating a fixed transfer to a savings goal right after each income transaction.",
      });
    }
  }

  // Gemini-generated recommendations layer -- built from the same real data,
  // appended after the deterministic rules above (which never fail/timeout).
  const user = await db.findOne("users", u => u.id === req.userId);
  const accounts = await db.find("accounts", a => a.userId === req.userId);
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);
  const month = new Date().toISOString().slice(0, 7);
  const txThisMonth = await db.find("transactions", t => t.userId === req.userId && t.date.slice(0, 7) === month);
  const incomeThisMonth = txThisMonth.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenseThisMonth = txThisMonth.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const spendMap = {};
  for (const t of txThisMonth.filter(t => t.type === "expense")) spendMap[t.categoryId] = (spendMap[t.categoryId] || 0) + t.amount;
  const spendByCategory = Object.entries(spendMap).map(([categoryId, total]) => ({
    categoryName: (categories.find(c => c.id === categoryId) || {}).name || "Other", total: Number(total.toFixed(2)),
  }));

  const budgetsWithSpend = budgets.map(b => ({
    categoryId: b.categoryId,
    categoryName: (categories.find(c => c.id === b.categoryId) || {}).name,
    monthlyLimit: b.monthlyLimit,
    spent: Number((spendMap[b.categoryId] || 0).toFixed(2)),
  }));

  const forecasts = (await Promise.all(categories.filter(c => c.name !== "Income").map(async cat => {
    const expenses = await db.find("transactions", t => t.userId === req.userId && t.categoryId === cat.id && t.type === "expense");
    if (expenses.length === 0) return null;
    const { forecast, confidence } = forecastNextMonth(expenses);
    return { categoryName: cat.name, forecast, confidence };
  }))).filter(Boolean);

  const anomalyContext = anomalies.map(a => ({
    amount: a.amount, date: a.date, zScore: a.anomalyZScore,
    categoryName: (categories.find(c => c.id === a.categoryId) || {}).name,
  }));

  if (user) {
    const gemini = await generateRecommendations({
      user: { name: user.name },
      summary: {
        netWorth: Number(netWorth.toFixed(2)),
        incomeThisMonth: Number(incomeThisMonth.toFixed(2)),
        expenseThisMonth: Number(expenseThisMonth.toFixed(2)),
        savingsRateThisMonth: incomeThisMonth > 0 ? Number((((incomeThisMonth - expenseThisMonth) / incomeThisMonth) * 100).toFixed(1)) : 0,
        spendByCategory,
      },
      budgets: budgetsWithSpend,
      forecasts,
      anomalies: anomalyContext,
    });

    if (gemini.ok && gemini.recommendations.length) {
      gemini.recommendations.forEach((text, i) => recs.push({
        id: `gemini-${month}-${i}`, type: "gemini", severity: "good", source: "gemini-3.6-flash",
        message: text, suggestion: "",
      }));
    } else if (!gemini.ok && gemini.reason !== "no-api-key") {
      // Surface the failure quietly in server logs; the deterministic recs above still render.
      console.warn("Gemini recommendations unavailable:", gemini.reason, gemini.detail || "");
    }
  }

  res.json(recs);
});

router.post("/recommendations/:id/action", async (req, res) => {
  // Accept/reject event logging -- feeds the Recommendation Acceptance Rate
  // metric defined in the Review 0 GQ(I)M plan (Sub-Goal 1).
  const { action } = req.body || {};
  if (!["accepted", "dismissed"].includes(action)) return res.status(400).json({ error: "action must be 'accepted' or 'dismissed'." });
  const row = await db.insert("notifications", {
    userId: req.userId, type: "recommendation-event",
    message: `Recommendation ${req.params.id} ${action}`, read: true, recommendationId: req.params.id, action,
  });
  res.status(201).json(row);
});

// Detects subscription-like charges: the same description, in 3+ distinct
// months, at most ~1.5 times a month on average, with amounts within +/-10% of
// their median. Reports the yearly cost and whether it is already tracked as
// a recurring bill.
router.get("/subscriptions", async (req, res) => {
  const [tx, bills] = await Promise.all([
    db.find("transactions", t => t.userId === req.userId && t.type === "expense" && t.description),
    db.find("bills", b => b.userId === req.userId),
  ]);
  const groups = {};
  for (const t of tx) {
    const key = t.description.trim().toLowerCase();
    (groups[key] = groups[key] || []).push(t);
  }
  const median = a => { const s = a.slice().sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const out = [];
  for (const [key, rows] of Object.entries(groups)) {
    const months = [...new Set(rows.map(r => r.date.slice(0, 7)))];
    if (months.length < 3 || rows.length / months.length > 1.5) continue;
    const med = median(rows.map(r => r.amount));
    if (!rows.every(r => Math.abs(r.amount - med) <= 0.1 * med)) continue;
    const last = rows.map(r => r.date).sort().pop();
    out.push({
      name: rows[0].description.trim(), amount: Number(med.toFixed(2)), monthsSeen: months.length,
      lastCharged: last, yearlyCost: Number((med * 12).toFixed(2)),
      categoryId: rows[0].categoryId,
      tracked: bills.some(b => b.name.toLowerCase().includes(key) || key.includes(b.name.toLowerCase())),
    });
  }
  out.sort((a, b) => b.yearlyCost - a.yearlyCost);
  res.json(out);
});

// Free-form "Ask AI" questions, answered by Gemini from a snapshot of this
// user's own data only (see lib/snapshot.js).
router.post("/ask", async (req, res) => {
  const question = String((req.body || {}).question || "").trim().slice(0, 500);
  if (!question) return res.status(400).json({ error: "Type a question first." });
  const snapshot = await buildSnapshot(req.userId);
  const r = await askFinance({ question, snapshot });
  if (!r.ok) {
    return res.status(r.reason === "no-api-key" ? 503 : 502).json({
      error: r.reason === "no-api-key" ? "The AI assistant isn't configured on this server." : "The assistant couldn't answer just now. Please try again.",
    });
  }
  res.json({ answer: r.text });
});

module.exports = router;
