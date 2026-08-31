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

module.exports = { generateRecommendations };
