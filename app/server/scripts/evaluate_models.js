/**
 * Offline evaluation of the two statistical models in lib/ai.js.
 * Everything is synthetic and seeded, so results are reproducible:
 *
 *   node app/server/scripts/evaluate_models.js
 *
 * 1. Anomaly detector (z-score, threshold 2.5): simulated users with 24
 *    "normal" past expenses per category; then 200 new expenses of which 10%
 *    are injected anomalies (1.5x-5x the category mean). Reports
 *    precision / recall / F1 / false-positive rate at thresholds 2.0, 2.5, 3.0.
 * 2. Forecaster (exponential smoothing, alpha 0.4): rolling-origin one-step-ahead
 *    forecasts on synthetic 12-month series, compared with three baselines
 *    (linear regression -- the original implementation -- naive "same as last
 *    month", and a 3-month moving average) using MAPE (Hyndman & Koehler, 2006).
 */
const fs = require("fs");
const path = require("path");
const { detectAnomaly, forecastNextMonth } = require("../lib/ai");

// mulberry32 PRNG + Box-Muller normal
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(20261026);
const normal = (mu, sd) => { let u = 0, v = 0; while (u === 0) u = R(); while (v === 0) v = R(); return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

// ---------------- 1. anomaly detector ----------------
function evalAnomaly() {
  const thresholds = [2.0, 2.5, 3.0];
  const cm = Object.fromEntries(thresholds.map(t => [t, { tp: 0, fp: 0, fn: 0, tn: 0 }]));
  const bands = { "1.5-2x": [1.5, 2], "2-3x": [2, 3], "3-5x": [3, 5] };
  const bandHit = Object.fromEntries(Object.keys(bands).map(b => [b, { n: 0, caught: 0 }]));
  const TRIALS = 300;
  for (let t = 0; t < TRIALS; t++) {
    const mu = 500 + R() * 19500, cv = [0.1, 0.2, 0.3][t % 3];
    const history = Array.from({ length: 24 }, () => Math.max(1, normal(mu, cv * mu)));
    for (let i = 0; i < 200; i++) {
      const isAnom = R() < 0.1;
      let amount, band = null;
      if (isAnom) {
        const mult = 1.5 + R() * 3.5; amount = mu * mult;
        band = Object.keys(bands).find(b => mult >= bands[b][0] && mult < bands[b][1]);
      } else amount = Math.max(1, normal(mu, cv * mu));
      const z = Math.abs(detectAnomaly(amount, history).zScore);
      for (const th of thresholds) {
        const flagged = z >= th;
        const c = cm[th];
        if (isAnom && flagged) c.tp++; else if (isAnom) c.fn++; else if (flagged) c.fp++; else c.tn++;
      }
      if (isAnom) { bandHit[band].n++; if (z >= 2.5) bandHit[band].caught++; }
      history.push(amount); // the real system also learns from every new transaction
    }
  }
  const out = {};
  for (const th of thresholds) {
    const { tp, fp, fn, tn } = cm[th];
    const precision = tp / (tp + fp), recall = tp / (tp + fn);
    out[th] = { tp, fp, fn, tn, precision: +precision.toFixed(3), recall: +recall.toFixed(3), f1: +(2 * precision * recall / (precision + recall)).toFixed(3), falsePositiveRate: +(fp / (fp + tn)).toFixed(4) };
  }
  const recallByBand = Object.fromEntries(Object.entries(bandHit).map(([b, v]) => [b, { injected: v.n, recallAt2_5: +(v.caught / v.n).toFixed(3) }]));
  return { trials: TRIALS, transactionsPerTrial: 200, anomalyRate: 0.1, byThreshold: out, recallByMagnitude: recallByBand };
}

// ---------------- 2. forecaster ----------------
// the original forecaster, kept here as a baseline
function regressionForecast(y) {
  const n = y.length, x = y.map((_, i) => i), xb = mean(x), yb = mean(y);
  const b = x.reduce((s, v, i) => s + (v - xb) * (y[i] - yb), 0) / x.reduce((s, v) => s + (v - xb) ** 2, 0);
  return Math.max(0, yb - b * xb + b * n);
}

function evalForecast() {
  const SERIES = 300, MONTHS = 12;
  const err = { smoothing: [], regression: [], naive: [], movingAvg: [] };
  let smBeatsReg = 0, smBeatsNaive = 0, smBeatsMA = 0, cases = 0;
  const bySlope = {};
  for (let s = 0; s < SERIES; s++) {
    const base = 1000 + R() * 19000, slope = [-0.01, 0, 0.02][s % 3], cv = 0.08 + R() * 0.12;
    const vals = Array.from({ length: MONTHS }, (_, m) => Math.max(1, normal(base * (1 + slope * m), cv * base)));
    const tx = vals.map((v, m) => ({ date: `2025-${String(m + 1).padStart(2, "0")}-15`, amount: v }));
    for (let t = 4; t < MONTHS; t++) {
      const actual = vals[t];
      const sm = forecastNextMonth(tx.slice(0, t)).forecast;
      const reg = regressionForecast(vals.slice(0, t));
      const naive = vals[t - 1];
      const ma = mean(vals.slice(t - 3, t));
      const ape = f => Math.abs(actual - f) / actual * 100;
      err.smoothing.push(ape(sm)); err.regression.push(ape(reg)); err.naive.push(ape(naive)); err.movingAvg.push(ape(ma));
      cases++; if (ape(sm) < ape(reg)) smBeatsReg++; if (ape(sm) < ape(naive)) smBeatsNaive++; if (ape(sm) < ape(ma)) smBeatsMA++;
      const key = `slope ${slope >= 0 ? "+" : ""}${slope * 100}%/mo`;
      (bySlope[key] = bySlope[key] || { smoothing: [], regression: [], movingAvg: [], naive: [] });
      bySlope[key].smoothing.push(ape(sm)); bySlope[key].regression.push(ape(reg)); bySlope[key].movingAvg.push(ape(ma)); bySlope[key].naive.push(ape(naive));
    }
  }
  const summ = a => ({ MAPE: +mean(a).toFixed(2), sd: +sd(a).toFixed(2) });
  return {
    series: SERIES, forecastsPerSeries: MONTHS - 4, totalForecasts: cases,
    overall: { exponentialSmoothing: summ(err.smoothing), linearRegression: summ(err.regression), movingAverage3: summ(err.movingAvg), naiveLastMonth: summ(err.naive) },
    smoothingBeatsRegression: +(smBeatsReg / cases).toFixed(3), smoothingBeatsNaive: +(smBeatsNaive / cases).toFixed(3), smoothingBeatsMovingAvg: +(smBeatsMA / cases).toFixed(3),
    bySlope: Object.fromEntries(Object.entries(bySlope).map(([k, v]) => [k, { smoothingMAPE: summ(v.smoothing).MAPE, regressionMAPE: summ(v.regression).MAPE, movingAvgMAPE: summ(v.movingAvg).MAPE, naiveMAPE: summ(v.naive).MAPE }])),
  };
}

const results = { generatedAt: new Date().toISOString(), seed: 20261026, anomalyDetector: evalAnomaly(), forecaster: evalForecast() };
const outFile = path.join(__dirname, "..", "..", "..", "analysis", "eval_models.json");
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
