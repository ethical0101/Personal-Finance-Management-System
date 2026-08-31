const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(db.find("bills", b => b.userId === req.userId));
});

router.post("/", (req, res) => {
  const { name, amount, dueDay, categoryId } = req.body || {};
  if (!name || !amount || !dueDay) return res.status(400).json({ error: "name, amount and dueDay are required." });
  const day = Number(dueDay);
  if (!Number.isInteger(day) || day < 1 || day > 28) return res.status(400).json({ error: "dueDay must be an integer between 1 and 28." });
  res.status(201).json(db.insert("bills", { userId: req.userId, name, amount: Number(amount), dueDay: day, categoryId: categoryId || null }));
});

router.delete("/:id", (req, res) => {
  const bill = db.findOne("bills", b => b.id === req.params.id && b.userId === req.userId);
  if (!bill) return res.status(404).json({ error: "Recurring bill not found." });
  db.remove("bills", bill.id);
  res.status(204).end();
});

module.exports = router;
