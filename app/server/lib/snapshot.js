/**
 * Builds a compact, privacy-minimal snapshot of one user's finances
 * (aggregates plus the 15 most recent transactions) that is handed to the
 * Gemini "Ask AI" assistant as its only source of truth.
 */
const db = require("../db");
const { forecastNextMonth } = require("./ai");

async function buildSnapshot(userId) {
  const month = new Date().toISOString().slice(0, 7);
  const [user, categories, accounts, txAll, budgets, goals, bills] = await Promise.all([
    db.findOne("users", u => u.id === userId),
    db.find("categories", c => c.userId === userId),
    db.find("accounts", a => a.userId === userId),
    db.find("transactions", t => t.userId === userId),
    db.find("budgets", b => b.userId === userId && b.month === month),
    db.find("goals", g => g.userId === userId),
    db.find("bills", b => b.userId === userId),
  ]);
  const catName = id => (categories.find(c => c.id === id) || {}).name || "Other";

  const thisMonth = txAll.filter(t => t.date.slice(0, 7) === month);
  const sum = (rows, type) => rows.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);
  const spendByCat = {};
  for (const t of thisMonth.filter(t => t.type === "expense")) spendByCat[catName(t.categoryId)] = (spendByCat[catName(t.categoryId)] || 0) + t.amount;

  const byMonth = {};
  for (const t of txAll) {
    const k = t.date.slice(0, 7);
    byMonth[k] = byMonth[k] || { income: 0, expense: 0 };
    byMonth[k][t.type] += t.amount;
  }

  const forecasts = categories.filter(c => c.name !== "Income").map(c => {
    const ex = txAll.filter(t => t.categoryId === c.id && t.type === "expense");
    return ex.length ? { category: c.name, nextMonthForecast: forecastNextMonth(ex).forecast } : null;
  }).filter(Boolean);

  return {
    today: new Date().toISOString().slice(0, 10),
    userName: user ? user.name : "User",
    currency: "INR",
    netWorth: Number(accounts.reduce((s, a) => s + a.balance, 0).toFixed(2)),
    accounts: accounts.map(a => ({ name: a.name, type: a.type, balance: a.balance })),
    thisMonth: { month, income: sum(thisMonth, "income"), expense: sum(thisMonth, "expense"), spendByCategory: spendByCat },
    monthlyHistory: byMonth,
    budgets: budgets.map(b => ({ category: catName(b.categoryId), limit: b.monthlyLimit, spent: Number((spendByCat[catName(b.categoryId)] || 0).toFixed(2)) })),
    goals: goals.map(g => ({ name: g.name, target: g.targetAmount, saved: g.currentAmount, deadline: g.deadline })),
    recurringBills: bills.map(b => ({ name: b.name, amount: b.amount, dueDayOfMonth: b.dueDay })),
    flaggedAnomalies: txAll.filter(t => t.flaggedAnomaly).slice(-5).map(t => ({ amount: t.amount, category: catName(t.categoryId), date: t.date })),
    recentTransactions: txAll.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15)
      .map(t => ({ date: t.date, type: t.type, amount: t.amount, category: catName(t.categoryId), note: t.description })),
    forecasts,
  };
}

module.exports = { buildSnapshot };
