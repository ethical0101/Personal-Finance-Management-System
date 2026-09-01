const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  res.json(await db.find("goals", g => g.userId === req.userId));
});

router.post("/", async (req, res) => {
  const { name, targetAmount, deadline } = req.body || {};
  if (!name || !targetAmount) return res.status(400).json({ error: "name and targetAmount are required." });
  res.status(201).json(await db.insert("goals", {
    userId: req.userId, name, targetAmount: Number(targetAmount),
    currentAmount: 0, deadline: deadline || null,
  }));
});

router.post("/:id/contribute", async (req, res) => {
  const { amount } = req.body || {};
  const goal = await db.findOne("goals", g => g.id === req.params.id && g.userId === req.userId);
  if (!goal) return res.status(404).json({ error: "Goal not found." });
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return res.status(400).json({ error: "amount must be a positive number." });
  res.json(await db.update("goals", goal.id, { currentAmount: Number((goal.currentAmount + numericAmount).toFixed(2)) }));
});

router.delete("/:id", async (req, res) => {
  const goal = await db.findOne("goals", g => g.id === req.params.id && g.userId === req.userId);
  if (!goal) return res.status(404).json({ error: "Goal not found." });
  await db.remove("goals", goal.id);
  res.status(204).end();
});

module.exports = router;
