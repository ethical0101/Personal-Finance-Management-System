/**
 * Writes the exact synthetic dataset behind the |z| >= 2.5 choice to a CSV
 * (same seed and same generator as evaluate_models.js, so the counts match
 * analysis/eval_models.json):
 *   node app/server/scripts/export_anomaly_dataset.js
 */
const fs = require("fs");
const path = require("path");
const { detectAnomaly } = require("../lib/ai");

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(20261026);
const normal = (mu, sd) => { let u = 0, v = 0; while (u === 0) u = R(); while (v === 0) v = R(); return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

const rows = ["user_id,step,usual_spend_mean,spread_cv,history_size,amount,is_injected_anomaly,spike_multiplier,z_score,flag_at_2_0,flag_at_2_5,flag_at_3_0"];
for (let t = 0; t < 300; t++) {
  const mu = 500 + R() * 19500, cv = [0.1, 0.2, 0.3][t % 3];
  const history = Array.from({ length: 24 }, () => Math.max(1, normal(mu, cv * mu)));
  for (let i = 0; i < 200; i++) {
    const isAnom = R() < 0.1;
    let amount, mult = "";
    if (isAnom) { mult = 1.5 + R() * 3.5; amount = mu * mult; } else amount = Math.max(1, normal(mu, cv * mu));
    const hist = history.length;
    const z = detectAnomaly(amount, history).zScore, az = Math.abs(z);
    rows.push([t + 1, i + 1, mu.toFixed(2), cv, hist, amount.toFixed(2), isAnom ? 1 : 0, mult === "" ? "" : mult.toFixed(3), z, az >= 2 ? 1 : 0, az >= 2.5 ? 1 : 0, az >= 3 ? 1 : 0].join(","));
    history.push(amount);
  }
}
const out = path.join(__dirname, "..", "..", "..", "analysis", "anomaly_simulation_dataset.csv");
fs.writeFileSync(out, rows.join("\n") + "\n");
console.log("wrote", rows.length - 1, "rows to", out);
