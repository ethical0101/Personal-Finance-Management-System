const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/summary", async (req, res) => {
  const accounts = await db.find("accounts", a => a.userId === req.userId);
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);
  const month = new Date().toISOString().slice(0, 7);
  const txThisMonth = await db.find("transactions", t => t.userId === req.userId && t.date.slice(0, 7) === month);
  const income = txThisMonth.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = txThisMonth.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const categories = await db.find("categories", c => c.userId === req.userId);
  const byCategory = {};
  for (const t of txThisMonth.filter(t => t.type === "expense")) {
    byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
  }
  const spendByCategory = Object.entries(byCategory)
    .map(([categoryId, total]) => ({ categoryId, categoryName: (categories.find(c => c.id === categoryId) || {}).name || "Other", total: Number(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  const unreadNotifications = (await db.find("notifications", n => n.userId === req.userId && !n.read && n.type !== "recommendation-event")).length;
  const transactionCount = (await db.find("transactions", t => t.userId === req.userId)).length;

  res.json({
    netWorth: Number(netWorth.toFixed(2)),
    accounts,
    incomeThisMonth: Number(income.toFixed(2)),
    expenseThisMonth: Number(expense.toFixed(2)),
    savingsRateThisMonth: income > 0 ? Number((((income - expense) / income) * 100).toFixed(1)) : 0,
    spendByCategory,
    unreadNotifications,
    transactionCount,
  });
});

module.exports = router;
