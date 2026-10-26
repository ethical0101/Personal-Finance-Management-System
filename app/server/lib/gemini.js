/**
 * Thin wrapper around the Gemini API (generateContent) for natural-language
 * financial recommendations. Falls back to null on any failure (missing key,
 * network error, quota, bad response) so callers can fall back to the
 * rule-based recommendations in lib/ai.js -- the AI Insights tab must never
 * go blank just because the LLM call failed.
 */
const MODEL = "gemini-3.6-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function buildPrompt({ user, summary, budgets, forecasts, anomalies }) {
  return `You are a careful, encouraging personal-finance assistant embedded in a budgeting app called Wealthline.
Given this user's real financial snapshot for the current month, write 2-4 short, specific, actionable recommendations.

User: ${user.name}
Net worth: ₹${summary.netWorth}
Income this month: ₹${summary.incomeThisMonth}
Expense this month: ₹${summary.expenseThisMonth}
Savings rate this month: ${summary.savingsRateThisMonth}%
Spend by category: ${summary.spendByCategory.map(c => `${c.categoryName}: ₹${c.total}`).join(", ") || "none"}
Budgets (category, limit, spent so far): ${budgets.map(b => `${b.categoryName || b.categoryId}: limit ₹${b.monthlyLimit}, spent ₹${b.spent}`).join("; ") || "none set"}
Forecasted next-month spend by category: ${forecasts.map(f => `${f.categoryName}: ₹${f.forecast} (${f.confidence} confidence)`).join("; ") || "not enough history"}
Recent anomalous transactions: ${anomalies.map(a => `₹${a.amount} in ${a.categoryName || "a category"} on ${a.date} (z=${a.zScore})`).join("; ") || "none"}

Rules:
- Be specific to the numbers above, not generic advice.
- Each recommendation must be one sentence, plain language, no markdown, no emoji.
- If everything looks healthy, say so briefly instead of inventing a problem.
- Return ONLY a JSON array of strings, nothing else. Example: ["...", "..."]`;
}

async function generateRecommendations(context) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, reason: "no-api-key", recommendations: [] };

  const prompt = buildPrompt(context);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 128 },
        },
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { ok: false, reason: `http-${res.status}`, detail: errBody.slice(0, 300), recommendations: [] };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    const cleaned = text.trim().replace(/^```json\s*|^```\s*|```$/g, "");
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      const match = cleaned.match(/\[[\s\S]*\]/);
      parsed = match ? JSON.parse(match[0]) : null;
    }
    if (!Array.isArray(parsed)) return { ok: false, reason: "unparseable-response", recommendations: [] };

    return { ok: true, recommendations: parsed.filter(s => typeof s === "string" && s.trim()).slice(0, 4) };
  } catch (e) {
    clearTimeout(timeout);
    return { ok: false, reason: e.name === "AbortError" ? "timeout" : "network-error", detail: String(e.message || e), recommendations: [] };
  }
}

/**
 * Generic one-shot call used by the receipt scanner and the "Ask AI" chat.
 * `parts` is the Gemini parts array (text and/or inlineData images).
 * Returns { ok, text } or { ok:false, reason, detail }.
 */
async function callGemini(parts, { json = false, maxTokens = 1024, thinkingBudget = 128, timeoutMs = 45000, temperature = 0.2, attempts = 3 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, reason: "no-api-key" };
  const body = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      thinkingConfig: { thinkingBudget },
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  });
  let last = { ok: false, reason: "unknown" };
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1200 * i)); // back off on transient overload
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
        return { ok: true, text: text.trim() };
      }
      const errBody = await res.text().catch(() => "");
      last = { ok: false, reason: `http-${res.status}`, detail: errBody.slice(0, 300) };
      if (![429, 500, 502, 503, 504].includes(res.status)) return last; // permanent error: don't retry
    } catch (e) {
      clearTimeout(timeout);
      last = { ok: false, reason: e.name === "AbortError" ? "timeout" : "network-error", detail: String(e.message || e) };
    }
  }
  return last;
}

function parseJsonLoose(text) {
  const cleaned = text.replace(/^```json\s*|^```\s*|```$/g, "").trim();
  try { return JSON.parse(cleaned); } catch (e) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* fall through */ } }
    return null;
  }
}

/** Reads a receipt/bill photo and returns structured fields. */
async function extractReceipt({ image, mimeType, categoryNames, today }) {
  const prompt = `You are a precise receipt and bill parser for a personal finance app (currency is Indian Rupees unless the bill shows otherwise).
Read the attached image and extract:
- merchant: the shop/vendor/biller name
- date: purchase or bill date as YYYY-MM-DD (if the year is missing assume the year of ${today}; if no date is visible use ${today})
- total: the final amount payable/paid as a plain number (grand total including taxes, not subtotal)
- currency: ISO code, default INR
- category: exactly one of [${categoryNames.join(", ")}] -- the best fit for this purchase
- items: up to 8 line items as {"name": string, "amount": number}
- confidence: your confidence 0-1 that merchant, date and total are all correct
If the image is not a receipt, bill or invoice, return {"error":"not_a_receipt"}.
Return ONLY a JSON object.`;
  const r = await callGemini(
    [{ text: prompt }, { inlineData: { mimeType, data: image } }],
    { json: true, maxTokens: 1500, thinkingBudget: 256, timeoutMs: 45000, temperature: 0.1 },
  );
  if (!r.ok) return r;
  const parsed = parseJsonLoose(r.text);
  if (!parsed) return { ok: false, reason: "unparseable-response" };
  return { ok: true, data: parsed };
}

/** Answers a free-form question using only the supplied financial snapshot. */
async function askFinance({ question, snapshot }) {
  const prompt = `You are Wealthline's finance assistant. Answer the user's question using ONLY the data below. Quote exact figures in rupees (₹). Be concise (under 120 words), plain text, no markdown headings. If the data cannot answer the question, say so plainly instead of guessing.

DATA (JSON):
${JSON.stringify(snapshot)}

QUESTION: ${question}`;
  const r = await callGemini([{ text: prompt }], { maxTokens: 900, thinkingBudget: 256, timeoutMs: 30000, temperature: 0.3 });
  return r;
}

module.exports = { generateRecommendations, callGemini, extractReceipt, askFinance };
