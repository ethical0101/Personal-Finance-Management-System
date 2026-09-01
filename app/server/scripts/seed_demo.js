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

  const transactions = [
    // ---- last month (history, feeds the AI forecast) ----
    { type: "income", amount: 65000, categoryId: catByName["Income"], accountId: checking.id, description: "Monthly salary", date: lastMonth(1) },
    { type: "expense", amount: 1450, categoryId: catByName["Groceries"], accountId: checking.id, description: "Weekly groceries", date: lastMonth(4) },
    { type: "expense", amount: 1620, categoryId: catByName["Groceries"], accountId: checking.id, description: "Weekly groceries", date: lastMonth(11) },
    { type: "expense", amount: 1380, categoryId: catByName["Groceries"], accountId: checking.id, description: "Weekly groceries", date: lastMonth(18) },
    { type: "expense", amount: 1510, categoryId: catByName["Groceries"], accountId: checking.id, description: "Weekly groceries", date: lastMonth(25) },
    { type: "expense", amount: 18000, categoryId: catByName["Rent"], accountId: checking.id, description: "Monthly rent", date: lastMonth(2) },
    { type: "expense", amount: 1150, categoryId: catByName["Utilities"], accountId: checking.id, description: "Electricity bill", date: lastMonth(6) },
    { type: "expense", amount: 699, categoryId: catByName["Utilities"], accountId: checking.id, description: "Internet bill", date: lastMonth(6) },
    { type: "expense", amount: 550, categoryId: catByName["Dining"], accountId: checking.id, description: "Dinner out", date: lastMonth(9) },
    { type: "expense", amount: 780, categoryId: catByName["Dining"], accountId: checking.id, description: "Weekend brunch", date: lastMonth(20) },
    { type: "expense", amount: 1600, categoryId: catByName["Transport"], accountId: checking.id, description: "Fuel", date: lastMonth(14) },
    { type: "expense", amount: 599, categoryId: catByName["Entertainment"], accountId: checking.id, description: "Netflix + Spotify", date: lastMonth(10) },
    { type: "expense", amount: 900, categoryId: catByName["Health"], accountId: checking.id, description: "Pharmacy", date: lastMonth(16) },

    // ---- this month (populates Dashboard + Budgets "this month" views) ----
    { type: "income", amount: 65000, categoryId: catByName["Income"], accountId: checking.id, description: "Monthly salary", date: thisMonth(1) },
    { type: "income", amount: 4000, categoryId: catByName["Income"], accountId: checking.id, description: "Freelance project", date: thisMonth(1) },
    { type: "expense", amount: 1470, categoryId: catByName["Groceries"], accountId: checking.id, description: "Weekly groceries", date: thisMonth(1) },
    { type: "expense", amount: 9800, categoryId: catByName["Groceries"], accountId: checking.id, description: "Big Bazaar bulk order", date: thisMonth(1) }, // anomaly
    { type: "expense", amount: 18000, categoryId: catByName["Rent"], accountId: checking.id, description: "Monthly rent", date: thisMonth(1) },
    { type: "expense", amount: 1200, categoryId: catByName["Utilities"], accountId: checking.id, description: "Electricity bill", date: thisMonth(1) },
    { type: "expense", amount: 650, categoryId: catByName["Dining"], accountId: checking.id, description: "Dinner with friends", date: thisMonth(1) },
    { type: "expense", amount: 320, categoryId: catByName["Dining"], accountId: checking.id, description: "Coffee shop", date: thisMonth(1) },
    { type: "expense", amount: 450, categoryId: catByName["Transport"], accountId: checking.id, description: "Cab rides", date: thisMonth(1) },
    { type: "expense", amount: 599, categoryId: catByName["Entertainment"], accountId: checking.id, description: "Netflix + Spotify", date: thisMonth(1) },
    { type: "expense", amount: 500, categoryId: catByName["Other"], accountId: checking.id, description: "Miscellaneous", date: thisMonth(1) },
  ];

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
