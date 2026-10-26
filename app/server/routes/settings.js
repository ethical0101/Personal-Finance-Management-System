/**
 * Account settings: profile, password, data export, clear data, delete account.
 * Everything is scoped to req.userId (set by requireAuth).
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();
const USER_COLLECTIONS = ["accounts", "categories", "transactions", "budgets", "goals", "bills", "notifications"];
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });

router.get("/me", async (req, res) => {
  const user = await db.findOne("users", u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: "Account not found." });
  const [tx, goals, budgets] = await Promise.all([
    db.find("transactions", t => t.userId === req.userId),
    db.find("goals", g => g.userId === req.userId),
    db.find("budgets", b => b.userId === req.userId),
  ]);
  res.json({ ...publicUser(user), stats: { transactions: tx.length, goals: goals.length, budgets: budgets.length } });
});

router.put("/profile", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Name must be 2–60 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  const clash = await db.findOne("users", u => u.email.toLowerCase() === email && u.id !== req.userId);
  if (clash) return res.status(409).json({ error: "That email is already used by another account." });
  const updated = await db.update("users", req.userId, { name, email });
  res.json({ user: publicUser(updated) });
});

router.post("/password", async (req, res) => {
  const { current, next } = req.body || {};
  if (!current || !next) return res.status(400).json({ error: "Enter your current and new password." });
  if (String(next).length < 8) return res.status(400).json({ error: "New password must be at least 8 characters." });
  const user = await db.findOne("users", u => u.id === req.userId);
  if (!user || !bcrypt.compareSync(current, user.passwordHash)) return res.status(401).json({ error: "Current password is incorrect." });
  await db.update("users", req.userId, { passwordHash: bcrypt.hashSync(next, 10) });
  res.json({ ok: true });
});

router.get("/export", async (req, res) => {
  const user = await db.findOne("users", u => u.id === req.userId);
  const out = { exportedAt: new Date().toISOString(), user: publicUser(user) };
  for (const c of USER_COLLECTIONS) out[c] = await db.find(c, r => r.userId === req.userId);
  res.setHeader("Content-Disposition", 'attachment; filename="wealthline-export.json"');
  res.json(out);
});

// Wipes transactions, budgets, goals, bills and notifications; keeps the login, categories and accounts (balances reset to 0).
router.post("/clear-data", async (req, res) => {
  const removed = {};
  for (const c of ["transactions", "budgets", "goals", "bills", "notifications"]) removed[c] = await db.removeByUser(c, req.userId);
  const accounts = await db.find("accounts", a => a.userId === req.userId);
  for (const a of accounts) await db.update("accounts", a.id, { balance: 0 });
  res.json({ ok: true, removed });
});

router.delete("/account", async (req, res) => {
  const user = await db.findOne("users", u => u.id === req.userId);
  if (!user || !bcrypt.compareSync(String(req.body?.password || ""), user.passwordHash)) return res.status(401).json({ error: "Password is incorrect." });
  for (const c of USER_COLLECTIONS) await db.removeByUser(c, req.userId);
  await db.remove("users", req.userId);
  res.json({ ok: true });
});

module.exports = router;
