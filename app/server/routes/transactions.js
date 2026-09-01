const express = require("express");
const db = require("../db");
const { detectAnomaly } = require("../lib/ai");

const router = express.Router();

router.get("/", async (req, res) => {
  const { accountId, categoryId, limit } = req.query;
  let rows = await db.find("transactions", t => t.userId === req.userId);
  if (accountId) rows = rows.filter(t => t.accountId === accountId);
  if (categoryId) rows = rows.filter(t => t.categoryId === categoryId);
  rows = rows.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  if (limit) rows = rows.slice(0, Number(limit));
  res.json(rows);
});

router.post("/", async (req, res) => {
  const { accountId, categoryId, amount, type, description, date } = req.body || {};
  if (!accountId || !categoryId || !amount || !type || !date) {
    return res.status(400).json({ error: "accountId, categoryId, amount, type and date are required." });
  }
  if (!["income", "expense"].includes(type)) {
    return res.status(400).json({ error: "type must be 'income' or 'expense'." });
  }
  const account = await db.findOne("accounts", a => a.id === accountId && a.userId === req.userId);
  if (!account) return res.status(404).json({ error: "Account not found." });
  const category = await db.findOne("categories", c => c.id === categoryId && c.userId === req.userId);
  if (!category) return res.status(404).json({ error: "Category not found." });

  const numericAmount = Math.abs(Number(amount));
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number." });
  }

  // anomaly check against this category's expense history, before recording the new one
  let anomaly = { isAnomaly: false, zScore: 0, reason: "" };
  if (type === "expense") {
    const history = (await db
      .find("transactions", t => t.userId === req.userId && t.categoryId === categoryId && t.type === "expense"))
      .map(t => t.amount);
    anomaly = detectAnomaly(numericAmount, history);
  }

  const tx = await db.insert("transactions", {
    userId: req.userId, accountId, categoryId, amount: numericAmount, type,
    description: description || "", date, flaggedAnomaly: anomaly.isAnomaly, anomalyZScore: anomaly.zScore,
  });

  const delta = type === "income" ? numericAmount : -numericAmount;
  await db.update("accounts", account.id, { balance: Number((account.balance + delta).toFixed(2)) });

  if (anomaly.isAnomaly) {
    await db.insert("notifications", {
      userId: req.userId,
      type: "anomaly",
      message: `Unusual ${category.name} transaction of ₹${numericAmount.toFixed(2)} — ${anomaly.reason}`,
      read: false,
    });
  }

  res.status(201).json({ transaction: tx, anomaly });
});

router.delete("/:id", async (req, res) => {
  const tx = await db.findOne("transactions", t => t.id === req.params.id && t.userId === req.userId);
  if (!tx) return res.status(404).json({ error: "Transaction not found." });
  const account = await db.findOne("accounts", a => a.id === tx.accountId);
  if (account) {
    const delta = tx.type === "income" ? -tx.amount : tx.amount;
    await db.update("accounts", account.id, { balance: Number((account.balance + delta).toFixed(2)) });
  }
  await db.remove("transactions", tx.id);
  res.status(204).end();
});

module.exports = router;
