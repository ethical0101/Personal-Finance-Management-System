const express = require("express");
const db = require("../db");

const router = express.Router();

function monthKey(d) { return d.toISOString().slice(0, 7); }

/** The last `n` calendar months (oldest first) as YYYY-MM keys, ending with the current one. */
function lastMonths(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return out;
}

/**
 * Financial health score, 0-100, from four transparent components:
 *   savings rate this month ........ 40 pts (full marks at a 20%+ savings rate)
 *   budget adherence ............... 30 pts (share of this month's budgets still within limit)
 *   no unusual spending ............ 15 pts (-5 per flagged anomaly this month)
 *   goals in progress .............. 15 pts (average % progress across goals, 0 if none)
 * Documented here and shown component-by-component in the UI so it is auditable.
 */
function healthScore({ savingsRate, budgets, anomaliesThisMonth, goals }) {
  const savings = Math.max(0, Math.min(1, savingsRate / 20)) * 40;
  const within = budgets.length ? budgets.filter(b => b.percentUsed <= 100).length / budgets.length : 1;
  const adherence = within * 30;
  const calm = Math.max(0, 15 - 5 * anomaliesThisMonth);
  const goalPct = goals.length
    ? goals.reduce((s, g) => s + Math.min(1, g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0), 0) / goals.length
    : 0;
  const goalPts = goalPct * 15;
  const score = Math.round(savings + adherence + calm + goalPts);
  const grade = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs attention";
  return {
    score, grade,
    breakdown: [
      { label: "Savings rate", points: Math.round(savings), max: 40 },
      { label: "Budget adherence", points: Math.round(adherence), max: 30 },
      { label: "No unusual spending", points: Math.round(calm), max: 15 },
      { label: "Goal progress", points: Math.round(goalPts), max: 15 },
    ],
  };
}

router.get("/summary", async (req, res) => {
  const [accounts, allTx, categories, notifications, budgetsRaw, goals, bills] = await Promise.all([
    db.find("accounts", a => a.userId === req.userId),
    db.find("transactions", t => t.userId === req.userId),
    db.find("categories", c => c.userId === req.userId),
    db.find("notifications", n => n.userId === req.userId),
    db.find("budgets", b => b.userId === req.userId),
    db.find("goals", g => g.userId === req.userId),
    db.find("bills", b => b.userId === req.userId),
  ]);

  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);
  const month = monthKey(new Date());
  const txThisMonth = allTx.filter(t => t.date.slice(0, 7) === month);
  const income = txThisMonth.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = txThisMonth.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const byCategory = {};
  for (const t of txThisMonth.filter(t => t.type === "expense")) {
    byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
  }
  const spendByCategory = Object.entries(byCategory)
    .map(([categoryId, total]) => ({ categoryId, categoryName: (categories.find(c => c.id === categoryId) || {}).name || "Other", total: Number(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

  // ---- 6-month income vs expense trend ----
  const months = lastMonths(6);
  const trend = months.map(m => {
    const rows = allTx.filter(t => t.date.slice(0, 7) === m);
    return {
      month: m,
      income: Number(rows.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0).toFixed(2)),
      expense: Number(rows.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0).toFixed(2)),
    };
  });

  // ---- budgets this month (for the score) ----
  const budgetsNow = budgetsRaw.filter(b => b.month === month).map(b => ({
    ...b, percentUsed: b.monthlyLimit > 0 ? ((byCategory[b.categoryId] || 0) / b.monthlyLimit) * 100 : 0,
  }));
  const anomaliesThisMonth = txThisMonth.filter(t => t.flaggedAnomaly).length;
  const health = healthScore({ savingsRate, budgets: budgetsNow, anomaliesThisMonth, goals });

  // ---- next recurring bills ----
  const today = new Date();
  const upcomingBills = bills.map(b => {
    let due = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), b.dueDay));
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    if (due < todayUtc) due = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, b.dueDay));
    return {
      id: b.id, name: b.name, amount: b.amount,
      dueDate: due.toISOString().slice(0, 10),
      dueInDays: Math.round((due - todayUtc) / 86400000),
    };
  }).sort((a, b) => a.dueInDays - b.dueInDays).slice(0, 4);

  // ---- safe-to-spend + month-end projection ----
  // remaining budget across this month's budgets / days left (incl. today).
  // Projection = spent so far + typical monthly spend (avg of last 3 full months)
  // scaled by the fraction of the month still to come.
  const daysInMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
  const dayOfMonth = today.getUTCDate();
  const daysLeft = daysInMonth - dayOfMonth + 1;
  const remainingBudget = budgetsNow.reduce((s, b) => s + Math.max(0, b.monthlyLimit - (byCategory[b.categoryId] || 0)), 0);
  const prior = trend.slice(0, -1).slice(-3).filter(t => t.expense > 0);
  const typicalMonthlyExpense = prior.length ? prior.reduce((s, t) => s + t.expense, 0) / prior.length : expense;
  const billsDueThisMonth = bills.filter(b => b.dueDay >= dayOfMonth).reduce((s, b) => s + b.amount, 0);
  const safeToSpend = {
    perDay: budgetsNow.length ? Math.floor(remainingBudget / daysLeft) : null,
    remainingBudget: Number(remainingBudget.toFixed(2)),
    daysLeft,
    billsDueThisMonth: Number(billsDueThisMonth.toFixed(2)),
    typicalMonthlyExpense: Number(typicalMonthlyExpense.toFixed(2)),
    projectedMonthExpense: Number((expense + typicalMonthlyExpense * ((daysLeft - 1) / daysInMonth)).toFixed(2)),
    budgetsOver: budgetsNow.filter(b => b.percentUsed > 100).length,
    budgetCount: budgetsNow.length,
  };

  res.json({
    netWorth: Number(netWorth.toFixed(2)),
    accounts,
    incomeThisMonth: Number(income.toFixed(2)),
    expenseThisMonth: Number(expense.toFixed(2)),
    savingsRateThisMonth: income > 0 ? Number(savingsRate.toFixed(1)) : 0,
    spendByCategory,
    unreadNotifications: notifications.filter(n => !n.read && n.type !== "recommendation-event").length,
    transactionCount: allTx.length,
    trend,
    health,
    upcomingBills,
    safeToSpend,
  });
});

module.exports = router;
