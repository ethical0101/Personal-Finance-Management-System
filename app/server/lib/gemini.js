/**
 * Gemini API client: one place for every LLM call the app makes.
 *
 * Reliability features (all added after hitting real limits in testing):
 *  - Model fallback chain. Free-tier quotas are enforced per model, so when a
 *    model answers 429 (quota) we immediately try the next one in
 *    GEMINI_MODELS before giving up. Order = preferred first.
 *  - Retry once on transient 5xx/overload (503 "high demand").
 *  - Callers (routes) cache results in MongoDB (lib/aicache.js) so repeated
 *    identical requests don't spend quota at all.
 *  - Returns { ok:false, reason } -- never throws -- so the UI can always fall
 *    back to its rule-based behaviour. reason = "quota" when every model is
 *    exhausted.
 */
const DEFAULT_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"];
const MODELS = (process.env.GEMINI_MODELS ? process.env.GEMINI_MODELS.split(",") : DEFAULT_MODELS).map(s => s.trim()).filter(Boolean);
const endpoint = model => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

async function callGemini(parts, { json = false, maxTokens = 1024, thinkingBudget = 128, timeoutMs = 40000, temperature = 0.2 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, reason: "no-api-key" };
  const deadline = Date.now() + timeoutMs;
  let last = { ok: false, reason: "unknown" };
  let allQuota = true;
  const finish = () => ({ ...last, reason: allQuota && last.reason === "http-429" ? "quota" : last.reason });

  for (const model of MODELS) {
    // flash-lite style models may reject thinkingConfig; only send it where it's supported
    const body = JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature, maxOutputTokens: maxTokens,
        ...(model.includes("lite") ? {} : { thinkingConfig: { thinkingBudget } }),
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 1500) return finish();
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(remaining, 25000));
      try {
        const res = await fetch(`${endpoint(model)}?key=${encodeURIComponent(apiKey)}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
          if (text.trim()) return { ok: true, text: text.trim(), model };
          last = { ok: false, reason: "empty-response" }; allQuota = false;
          break; // try the next model
        }
        const errBody = await res.text().catch(() => "");
        last = { ok: false, reason: `http-${res.status}`, detail: errBody.slice(0, 200) };
        if (res.status === 429) break;                        // this model's quota is gone -> next model
        allQuota = false;
        if (res.status === 404 || res.status === 400) break;  // model unavailable / bad request for it -> next model
        // 5xx: retry once on the same model
      } catch (e) {
        clearTimeout(timer);
        allQuota = false;
        last = { ok: false, reason: e.name === "AbortError" ? "timeout" : "network-error", detail: String(e.message || e) };
      }
    }
  }
  return finish();
}

function parseJsonLoose(text) {
  const cleaned = text.replace(/^```json\s*|^```\s*|```$/g, "").trim();
  try { return JSON.parse(cleaned); } catch (e) {
    const m = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* fall through */ } }
    return null;
  }
}

function recommendationPrompt({ user, summary, budgets, forecasts, anomalies }) {
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

/** 2-4 one-line recommendations from the user's monthly snapshot. */
async function generateRecommendations(context) {
  const r = await callGemini([{ text: recommendationPrompt(context) }], { json: true, maxTokens: 1024, thinkingBudget: 128, timeoutMs: 25000, temperature: 0.4 });
  if (!r.ok) return { ok: false, reason: r.reason, detail: r.detail, recommendations: [] };
  const parsed = parseJsonLoose(r.text);
  if (!Array.isArray(parsed)) return { ok: false, reason: "unparseable-response", recommendations: [] };
  return { ok: true, model: r.model, recommendations: parsed.filter(s => typeof s === "string" && s.trim()).slice(0, 4) };
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
  const r = await callGemini([{ text: prompt }, { inlineData: { mimeType, data: image } }],
    { json: true, maxTokens: 1500, thinkingBudget: 256, timeoutMs: 45000, temperature: 0.1 });
  if (!r.ok) return r;
  const parsed = parseJsonLoose(r.text);
  if (!parsed || Array.isArray(parsed)) return { ok: false, reason: "unparseable-response" };
  return { ok: true, data: parsed, model: r.model };
}

/** Answers a free-form question using only the supplied financial snapshot. */
async function askFinance({ question, snapshot }) {
  const prompt = `You are Wealthline's finance assistant. Answer the user's question using ONLY the data below. Quote exact figures in rupees (₹). Be concise (under 120 words), plain text, no markdown headings. If the data cannot answer the question, say so plainly instead of guessing.

DATA (JSON):
${JSON.stringify(snapshot)}

QUESTION: ${question}`;
  return callGemini([{ text: prompt }], { maxTokens: 900, thinkingBudget: 256, timeoutMs: 30000, temperature: 0.3 });
}

module.exports = { generateRecommendations, callGemini, extractReceipt, askFinance, MODELS };
