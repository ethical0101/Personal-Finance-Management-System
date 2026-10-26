/**
 * Bill / receipt scanning.
 *
 *   POST /api/scan/receipt  { image: <base64, no data: prefix>, mimeType }
 *
 * The image is sent to Gemini (vision) which returns merchant, date, total,
 * category and line items. We then work out, server-side, what saving this as
 * an expense would do to the user's budget for that category and whether it
 * looks like a duplicate of something already recorded -- so the user can
 * confirm with full information. The image itself is never stored.
 */
const express = require("express");
const db = require("../db");
const { extractReceipt } = require("../lib/gemini");

const router = express.Router();

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BASE64_CHARS = 4_000_000; // ~3 MB of image; client downsizes well below this

router.post("/receipt", async (req, res) => {
  const { image, mimeType } = req.body || {};
  if (typeof image !== "string" || !image) return res.status(400).json({ error: "Attach a photo of the bill." });
  if (!ALLOWED.includes(mimeType)) return res.status(400).json({ error: "Only JPEG, PNG or WebP images are supported." });
  if (image.length > MAX_BASE64_CHARS) return res.status(413).json({ error: "Image is too large. Try a smaller photo." });

  const categories = await db.find("categories", c => c.userId === req.userId && c.name !== "Income");
  const today = new Date().toISOString().slice(0, 10);

  const out = await extractReceipt({ image, mimeType, categoryNames: categories.map(c => c.name), today });
  if (!out.ok) {
    const msg = out.reason === "no-api-key"
      ? "Bill scanning isn't configured on this server (missing GEMINI_API_KEY)."
      : out.reason === "timeout"
        ? "Scanning took too long. Please try again."
        : "Couldn't read that image. Try a clearer photo, or add the expense manually.";
    return res.status(out.reason === "no-api-key" ? 503 : 502).json({ error: msg, reason: out.reason });
  }
  const d = out.data;
  if (d.error === "not_a_receipt") {
    return res.status(422).json({ error: "That doesn't look like a bill or receipt. Try another photo." });
  }

  const total = Math.abs(Number(d.total));
  if (!Number.isFinite(total) || total <= 0) {
    return res.status(422).json({ error: "Couldn't find a total amount on that bill. Try a clearer photo." });
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d.date || "") ? d.date : today;
  const category = categories.find(c => c.name.toLowerCase() === String(d.category || "").toLowerCase())
    || categories.find(c => c.name === "Other") || categories[0];

  // ---- what would saving this do to the budget? ----
  const month = date.slice(0, 7);
  let budgetImpact = null;
  if (category) {
    const budget = await db.findOne("budgets", b => b.userId === req.userId && b.categoryId === category.id && b.month === month);
    if (budget) {
      const spent = (await db.find("transactions", t => t.userId === req.userId && t.type === "expense" && t.categoryId === category.id && t.date.slice(0, 7) === month))
        .reduce((s, t) => s + t.amount, 0);
      const after = spent + total;
      budgetImpact = {
        categoryName: category.name, month, limit: budget.monthlyLimit,
        spentBefore: Number(spent.toFixed(2)), spentAfter: Number(after.toFixed(2)),
        percentBefore: Math.round((spent / budget.monthlyLimit) * 100),
        percentAfter: Math.round((after / budget.monthlyLimit) * 100),
        overBy: after > budget.monthlyLimit ? Number((after - budget.monthlyLimit).toFixed(2)) : 0,
      };
    }
  }

  const duplicate = await db.findOne("transactions", t => t.userId === req.userId && t.type === "expense" && t.date === date && Math.abs(t.amount - total) < 0.01);

  res.json({
    merchant: String(d.merchant || "").slice(0, 80),
    date,
    total: Number(total.toFixed(2)),
    currency: String(d.currency || "INR").slice(0, 3).toUpperCase(),
    categoryId: category ? category.id : null,
    categoryName: category ? category.name : null,
    items: Array.isArray(d.items) ? d.items.slice(0, 8).map(i => ({ name: String(i.name || "").slice(0, 60), amount: Number(i.amount) || 0 })) : [],
    confidence: Math.max(0, Math.min(1, Number(d.confidence) || 0)),
    budgetImpact,
    possibleDuplicate: !!duplicate,
  });
});

module.exports = router;
