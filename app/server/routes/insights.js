const express = require("express");
const db = require("../db");
const { forecastNextMonth, monthlyTotals } = require("../lib/ai");

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

router.get("/recommendations", (req, res) => {
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
