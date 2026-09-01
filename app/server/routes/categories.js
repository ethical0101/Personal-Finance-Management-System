const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  res.json(await db.find("categories", c => c.userId === req.userId));
});

router.post("/", async (req, res) => {
  const { name, icon } = req.body || {};
  if (!name) return res.status(400).json({ error: "Category name is required." });
  res.status(201).json(await db.insert("categories", { userId: req.userId, name, icon: icon || "dots" }));
});

module.exports = router;
