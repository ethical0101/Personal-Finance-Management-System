const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(db.find("accounts", a => a.userId === req.userId));
});

router.post("/", (req, res) => {
  const { name, type, balance } = req.body || {};
  if (!name || !type) return res.status(400).json({ error: "Account name and type are required." });
  if (!["Savings", "Checking", "CreditCard"].includes(type)) {
    return res.status(400).json({ error: "Type must be Savings, Checking or CreditCard." });
  }
  const account = db.insert("accounts", { userId: req.userId, name, type, balance: Number(balance) || 0 });
  res.status(201).json(account);
});

router.delete("/:id", (req, res) => {
  const account = db.findOne("accounts", a => a.id === req.params.id && a.userId === req.userId);
  if (!account) return res.status(404).json({ error: "Account not found." });
  const hasTx = db.findOne("transactions", t => t.accountId === account.id);
  if (hasTx) return res.status(409).json({ error: "Cannot delete an account that has transactions." });
  db.remove("accounts", account.id);
  res.status(204).end();
});

module.exports = router;
