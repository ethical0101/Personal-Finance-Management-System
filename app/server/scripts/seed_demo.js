/**
 * Seeds a demo account (demo@gmail.com / 12345678) with realistic sample
 * data across every tab -- accounts, transactions (including one deliberate
 * anomaly), budgets (one intentionally over), goals with contributions, and
 * recurring bills -- so there's something to show on first login instead of
 * an empty app. Idempotent: safe to re-run against an existing account.
 *
 * Usage: node app/server/scripts/seed_demo.js
 * (server must already be running, e.g. `node app/server/index.js`)
 */
const BASE = process.env.SEED_BASE_URL || "http://localhost:4000/api";

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// Dashboard/budgets filter strictly by "this calendar month" (YYYY-MM of today).
// Build dates relative to *this* month and last month so both the forecast
// (wants 2+ months of history) and the dashboard/budgets ("this month" only)
// have real data to show.
const now = new Date();
const thisMonth = (day) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const lastMonth = (day) => `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

async function main() {
  let auth;
  try {
    auth = await api("/auth/signup", { method: "POST", body: { name: "Dhruv", email: "demo@gmail.com", password: "12345678" } });
    console.log("Signed up demo@gmail.com");
  } catch (e) {
    auth = await api("/auth/login", { method: "POST", body: { email: "demo@gmail.com", password: "12345678" } });
    console.log("Account existed, logged in instead");
  }
  const token = auth.token;

  const categories = await api("/categories", { token });
  const catByName = Object.fromEntries(categories.map(c => [c.name, c.id]));

  const accounts = await api("/accounts", { token });
  const checking = accounts.find(a => a.type === "Checking");

  const existingSavings = accounts.find(a => a.name === "HDFC Savings");
  if (!existingSavings) {
    await api("/accounts", { method: "POST", token, body: { name: "HDFC Savings", type: "Savings", balance: 15000 } });
  }
  const existingCC = accounts.find(a => a.name === "SBI Credit Card");
  if (!existingCC) {
    await api("/accounts", { method: "POST", token, body: { name: "SBI Credit Card", type: "CreditCard", balance: 0 } });
  }
  console.log("Accounts ready");

  // Deterministic pseudo-random so every run builds the same demo history.
  let seedState = 20261026;
  const rnd = () => { seedState = (seedState + 0x6D2B79F5) | 0; let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const between = (lo, hi) => Math.round((lo + rnd() * (hi - lo)) / 10) * 10;
  const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const C = (name) => catByName[name];
  const tx = (type, amount, cat, description, date) => ({ type, amount, categoryId: C(cat), accountId: checking.id, description, date });

  const transactions = [];
  // ---- five completed months of history (feeds trends, forecasts, auto-budget) ----
  for (let back = 5; back >= 1; back--) {
    const d0 = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = d0.getFullYear(), m = d0.getMonth();
    transactions.push(tx("income", 65000, "Income", "Monthly salary", ymd(y, m, 1)));
    if (back % 2 === 0) transactions.push(tx("income", between(3000, 6000), "Income", "Freelance project", ymd(y, m, 14)));
    transactions.push(tx("expense", 18000, "Rent", "Monthly rent", ymd(y, m, 2)));
    transactions.push(tx("expense", between(1000, 1350), "Utilities", "Electricity bill", ymd(y, m, 6)));
    transactions.push(tx("expense", 699, "Utilities", "Internet bill", ymd(y, m, 5)));
    for (const day of [4, 11, 18, 25]) transactions.push(tx("expense", between(1300, 1700), "Groceries", "Weekly groceries", ymd(y, m, day)));
    for (const day of [8, 21]) transactions.push(tx("expense", between(400, 950), "Dining", day === 8 ? "Dinner out" : "Weekend brunch", ymd(y, m, day)));
    transactions.push(tx("expense", between(1400, 1900), "Transport", "Fuel", ymd(y, m, 12)));
    transactions.push(tx("expense", between(300, 600), "Transport", "Cab rides", ymd(y, m, 22)));
    transactions.push(tx("expense", 599, "Entertainment", "Netflix + Spotify", ymd(y, m, 10)));
    if (back % 2 === 1) transactions.push(tx("expense", between(500, 900), "Entertainment", "Movie night", ymd(y, m, 19)));
    if (back % 3 === 0) transactions.push(tx("expense", between(800, 1400), "Health", "Pharmacy", ymd(y, m, 16)));
    transactions.push(tx("expense", 1200, "Health", "Gym membership", ymd(y, m, 7))); // a subscription never set up as a bill
  }
  // ---- this month, spread across the days that have already happened ----
  const Y = now.getFullYear(), M = now.getMonth(), today = now.getDate();
  const thisMonthTx = [
    tx("income", 65000, "Income", "Monthly salary", ymd(Y, M, 1)),
    tx("expense", 18000, "Rent", "Monthly rent", ymd(Y, M, 2)),
    tx("expense", 1480, "Groceries", "Weekly groceries", ymd(Y, M, 3)),
    tx("expense", 699, "Utilities", "Internet bill", ymd(Y, M, 5)),
    tx("expense", 1180, "Utilities", "Electricity bill", ymd(Y, M, 6)),
    tx("expense", 720, "Dining", "Dinner with friends", ymd(Y, M, 7)),
    tx("income", 4500, "Income", "Freelance project", ymd(Y, M, 8)),
    tx("expense", 599, "Entertainment", "Netflix + Spotify", ymd(Y, M, 10)),
    tx("expense", 1560, "Groceries", "Weekly groceries", ymd(Y, M, 10)),
    tx("expense", 1750, "Transport", "Fuel", ymd(Y, M, 12)),
    tx("expense", 340, "Dining", "Coffee shop", ymd(Y, M, 14)),
    tx("expense", 1420, "Groceries", "Weekly groceries", ymd(Y, M, 17)),
    tx("expense", 9800, "Groceries", "Big Bazaar bulk order", ymd(Y, M, 19)), // deliberate anomaly
    tx("expense", 450, "Transport", "Cab rides", ymd(Y, M, 20)),
    tx("expense", 640, "Entertainment", "Movie night", ymd(Y, M, 22)),
    tx("expense", 1200, "Health", "Gym membership", ymd(Y, M, 7)),
    tx("expense", 500, "Other", "Gift wrapping & misc", ymd(Y, M, 23)),
  ].filter(t => Number(t.date.slice(8)) <= today);
  transactions.push(...thisMonthTx);
  // history first, then chronological, so the anomaly detector sees a realistic baseline
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  let added = 0, anomalyFlagged = 0;
  for (const tx of transactions) {
    try {
      const result = await api("/transactions", { method: "POST", token, body: tx });
      added++;
      if (result.anomaly?.isAnomaly) anomalyFlagged++;
    } catch (e) {
      console.warn("tx skipped:", e.message);
    }
  }
  console.log(`Added ${added}/${transactions.length} transactions (${anomalyFlagged} flagged as anomaly)`);

  const existingBudgets = await api("/budgets", { token });
  const haveBudget = (catId) => existingBudgets.some(b => b.categoryId === catId);
  const budgetPlan = [
    [catByName["Groceries"], 6000],
    [catByName["Dining"], 3000],
    [catByName["Entertainment"], 2000],
    [catByName["Transport"], 2500],
    [catByName["Utilities"], 2500],
  ];
  for (const [categoryId, monthlyLimit] of budgetPlan) {
    if (!haveBudget(categoryId)) await api("/budgets", { method: "POST", token, body: { categoryId, monthlyLimit } });
  }
  console.log("Budgets set");

  const existingGoals = await api("/goals", { token });
  async function ensureGoal(name, targetAmount, deadline, contribute) {
    let goal = existingGoals.find(g => g.name === name);
    if (!goal) {
      goal = await api("/goals", { method: "POST", token, body: { name, targetAmount, deadline } });
      await api(`/goals/${goal.id}/contribute`, { method: "POST", token, body: { amount: contribute } });
    }
  }
  const futureDate = (months) => { const d = new Date(now); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10); };
  await ensureGoal("Emergency Fund", 100000, futureDate(6), 32000);
  await ensureGoal("Goa Trip", 25000, futureDate(2), 9000);
  await ensureGoal("New Laptop", 80000, null, 15000);
  console.log("Goals ready");

  const existingBills = await api("/bills", { token });
  async function ensureBill(name, categoryId, amount, dueDay) {
    if (!existingBills.some(b => b.name === name)) await api("/bills", { method: "POST", token, body: { name, categoryId, amount, dueDay } });
  }
  await ensureBill("Rent", catByName["Rent"], 18000, 1);
  await ensureBill("Internet", catByName["Utilities"], 699, 5);
  await ensureBill("Netflix + Spotify", catByName["Entertainment"], 599, 10);
  console.log("Recurring bills ready");

  await api("/insights/recommendations", { token });
  console.log("Warmed up AI Insights");

  const summary = await api("/dashboard/summary", { token });
  console.log("Final summary:", JSON.stringify(summary, null, 2));
}

main().catch(e => { console.error("SEED FAILED:", e.message); process.exit(1); });
