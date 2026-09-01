const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  const rows = (await db.find("notifications", n => n.userId === req.userId)).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(rows);
});

router.post("/:id/read", async (req, res) => {
  const note = await db.findOne("notifications", n => n.id === req.params.id && n.userId === req.userId);
  if (!note) return res.status(404).json({ error: "Notification not found." });
  res.json(await db.update("notifications", note.id, { read: true }));
});

module.exports = router;
