/**
 * Lightweight, dependency-free "AI" layer for the finance app:
 *  - anomaly detection on a new transaction (z-score against the user's
 *    trailing history for that category)
 *  - next-month expense forecast per category (simple linear regression
 *    over monthly totals; falls back to a moving average with < 3 points)
 *  - budget-aware savings suggestions
 *
 * This mirrors the AIModel / AnomalyDetectionModel / ExpensePredictionModel
 * roles from the Review 0 class diagram, implemented directly rather than
 * mocked, so the "accept/reject recommendation" and drift-tracking metrics
 * from the Review 0 GQ(I)M plan (Sub-Goal 1) have something real to log.
 */

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / (xs.length || 1); }
function std(xs) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
}

/** z-score anomaly check for a single new transaction amount within its category history */
function detectAnomaly(newAmount, historyAmounts) {
  if (historyAmounts.length < 4) {
    return { isAnomaly: false, zScore: 0, reason: "Not enough category history yet to judge." };
  }
  const m = mean(historyAmounts);
  const s = std(historyAmounts) || 1;
  const z = (newAmount - m) / s;
  const isAnomaly = Math.abs(z) >= 2.5;
  return {
    isAnomaly,
    zScore: Number(z.toFixed(2)),
    reason: isAnomaly
      ? `This transaction is ${Math.abs(z).toFixed(1)}x the typical spread for this category (avg ₹${m.toFixed(0)}).`
      : "Within the normal range for this category.",
  };
}

/** monthly totals -> { key: "YYYY-MM", total } sorted ascending */
function monthlyTotals(transactions) {
  const byMonth = {};
  for (const t of transactions) {
    const key = t.date.slice(0, 7);
    byMonth[key] = (byMonth[key] || 0) + t.amount;
  }
  return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }));
}

/** simple linear regression forecast of next month's spend from monthly totals */
function forecastNextMonth(transactions) {
  const series = monthlyTotals(transactions);
  if (series.length === 0) return { forecast: 0, method: "none", confidence: "low", history: series };
  if (series.length < 3) {
    return { forecast: Number(mean(series.map(s => s.total)).toFixed(2)), method: "moving-average", confidence: "low", history: series };
  }
  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series.map(s => s.total);
  const xBar = mean(xs), yBar = mean(ys);
  const num = xs.reduce((acc, x, i) => acc + (x - xBar) * (ys[i] - yBar), 0);
  const den = xs.reduce((acc, x) => acc + (x - xBar) ** 2, 0) || 1;
  const slope = num / den;
  const intercept = yBar - slope * xBar;
  const forecast = Math.max(0, intercept + slope * n);
  return { forecast: Number(forecast.toFixed(2)), method: "linear-regression", confidence: n >= 6 ? "medium" : "low", history: series, slope: Number(slope.toFixed(2)) };
}

module.exports = { detectAnomaly, forecastNextMonth, monthlyTotals, mean, std };
