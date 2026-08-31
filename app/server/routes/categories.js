const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(db.find("categories", c => c.userId === req.userId));
});

router.post("/", (req, res) => {
  const { name, icon } = req.body || {};
  if (!name) return res.status(400).json({ error: "Category name is required." });
  res.status(201).json(db.insert("categories", { userId: req.userId, name, icon: icon || "dots" }));
});

module.exports = router;
