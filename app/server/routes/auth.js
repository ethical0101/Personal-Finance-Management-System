const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { sign } = require("../middleware/auth");

const router = express.Router();

const DEFAULT_CATEGORIES = [
  { name: "Groceries", icon: "cart" },
  { name: "Rent", icon: "home" },
  { name: "Utilities", icon: "bolt" },
  { name: "Dining", icon: "utensils" },
  { name: "Transport", icon: "car" },
  { name: "Entertainment", icon: "film" },
  { name: "Health", icon: "heart" },
  { name: "Income", icon: "wallet" },
  { name: "Other", icon: "dots" },
];

router.post("/signup", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const existing = db.findOne("users", u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) return res.status(409).json({ error: "An account with this email already exists." });

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = db.insert("users", { name, email, passwordHash });

  for (const c of DEFAULT_CATEGORIES) db.insert("categories", { userId: user.id, ...c });
  db.insert("accounts", { userId: user.id, name: "Primary Checking", type: "Checking", balance: 0 });

  const token = sign(user);
  return res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  const user = db.findOne("users", u => u.email.toLowerCase() === (email || "").toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  const token = sign(user);
  return res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

module.exports = router;
