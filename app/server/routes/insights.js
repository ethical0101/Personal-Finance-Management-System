const express = require("express");
const db = require("../db");
const { forecastNextMonth, monthlyTotals } = require("../lib/ai");
const { generateRecommendations } = require("../lib/gemini");

const router = express.Router();

router.get("/forecast", (req, res) => {
  const categories = db.find("categories", c => c.userId === req.userId && c.name !== "Income");
  const results = categories.map(cat => {
    const expenses = db.find("transactions", t => t.userId === req.userId && t.categoryId === cat.id && t.type === "expense");
    if (expenses.length === 0) return null;
    const { forecast, method, confidence, history } = forecastNextMonth(expenses);
    return { categoryId: cat.id, categoryName: cat.name, forecast, method, confidence, history };
  }).filter(Boolean);
  res.json(results);
});

router.get("/recommendations", async (req, res) => {
  const categories = db.find("categories", c => c.userId === req.userId);
  const budgets = db.find("budgets", b => b.userId === req.userId && b.month === new Date().toISOString().slice(0, 7));
  const recs = [];

  for (const budget of budgets) {
    const cat = categories.find(c => c.id === budget.categoryId);
    if (!cat) continue;
    const expenses = db.find("transactions", t => t.userId === req.userId && t.categoryId === cat.id && t.type === "expense");
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

  const anomalies = db.find("transactions", t => t.userId === req.userId && t.flaggedAnomaly)
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

  const totalIncome = db.find("transactions", t => t.userId === req.userId && t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = db.find("transactions", t => t.userId === req.userId && t.type === "expense").reduce((s, t) => s + t.amount, 0);
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
  const user = db.findOne("users", u => u.id === req.userId);
  const accounts = db.find("accounts", a => a.userId === req.userId);
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);
  const month = new Date().toISOString().slice(0, 7);
  const txThisMonth = db.find("transactions", t => t.userId === req.userId && t.date.slice(0, 7) === month);
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

  const forecasts = categories.filter(c => c.name !== "Income").map(cat => {
    const expenses = db.find("transactions", t => t.userId === req.userId && t.categoryId === cat.id && t.type === "expense");
    if (expenses.length === 0) return null;
    const { forecast, confidence } = forecastNextMonth(expenses);
    return { categoryName: cat.name, forecast, confidence };
  }).filter(Boolean);

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

router.post("/recommendations/:id/action", (req, res) => {
  // Accept/reject event logging -- feeds the Recommendation Acceptance Rate
  // metric defined in the Review 0 GQ(I)M plan (Sub-Goal 1).
  const { action } = req.body || {};
  if (!["accepted", "dismissed"].includes(action)) return res.status(400).json({ error: "action must be 'accepted' or 'dismissed'." });
  const row = db.insert("notifications", {
    userId: req.userId, type: "recommendation-event",
    message: `Recommendation ${req.params.id} ${action}`, read: true, recommendationId: req.params.id, action,
  });
  res.status(201).json(row);
});

module.exports = router;
