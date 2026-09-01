const express = require("express");
const db = require("../db");

const router = express.Router();

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

router.get("/", async (req, res) => {
  const month = req.query.month || currentMonth();
  const budgets = await db.find("budgets", b => b.userId === req.userId && b.month === month);
  const spendByCategory = {};
  for (const t of await db.find("transactions", t => t.userId === req.userId && t.type === "expense" && t.date.slice(0, 7) === month)) {
    spendByCategory[t.categoryId] = (spendByCategory[t.categoryId] || 0) + t.amount;
  }
  const withSpend = budgets.map(b => ({
    ...b,
    spent: Number((spendByCategory[b.categoryId] || 0).toFixed(2)),
    remaining: Number((b.monthlyLimit - (spendByCategory[b.categoryId] || 0)).toFixed(2)),
    percentUsed: b.monthlyLimit > 0 ? Math.round(((spendByCategory[b.categoryId] || 0) / b.monthlyLimit) * 100) : 0,
  }));
  res.json(withSpend);
});

router.post("/", async (req, res) => {
  const { categoryId, monthlyLimit, month } = req.body || {};
  if (!categoryId || !monthlyLimit) return res.status(400).json({ error: "categoryId and monthlyLimit are required." });
  const targetMonth = month || currentMonth();
  const existing = await db.findOne("budgets", b => b.userId === req.userId && b.categoryId === categoryId && b.month === targetMonth);
  if (existing) {
    return res.json(await db.update("budgets", existing.id, { monthlyLimit: Number(monthlyLimit) }));
  }
  res.status(201).json(await db.insert("budgets", { userId: req.userId, categoryId, monthlyLimit: Number(monthlyLimit), month: targetMonth }));
});

router.delete("/:id", async (req, res) => {
  const budget = await db.findOne("budgets", b => b.id === req.params.id && b.userId === req.userId);
  if (!budget) return res.status(404).json({ error: "Budget not found." });
  await db.remove("budgets", budget.id);
  res.status(204).end();
});

module.exports = router;
