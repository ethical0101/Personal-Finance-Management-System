/**
 * End-to-end API smoke test: exercises every feature the UI uses, against a
 * throwaway account (created, used, and deleted), plus read-only checks on the
 * demo account. Usage: node app/server/scripts/smoke_test.js
 *   SEED_BASE_URL=https://wealthline-eight.vercel.app/api node ...   # production
 */
const BASE = process.env.SEED_BASE_URL || "http://localhost:4000/api";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + extra}`); };

async function call(path, { method = "GET", body, token } = {}) {
  const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await res.json(); } catch { /* none */ }
  return { status: res.status, data };
}
const today = new Date().toISOString().slice(0, 10);

(async () => {
  // ---------- demo account (read-only) ----------
  const demo = await call("/auth/login", { method: "POST", body: { email: "demo@gmail.com", password: "12345678" } });
  ok("demo login", demo.status === 200 && demo.data.token);
  const dt = demo.data.token;
  for (const [name, path] of [["dashboard summary", "/dashboard/summary"], ["transactions", "/transactions?limit=20"], ["accounts", "/accounts"], ["categories", "/categories"], ["budgets", "/budgets"], ["budget suggestions", "/budgets/suggest"], ["goals", "/goals"], ["bills", "/bills"], ["notifications", "/notifications"], ["forecast", "/insights/forecast"], ["subscriptions", "/insights/subscriptions"], ["settings/me", "/settings/me"]]) {
    const r = await call(path, { token: dt });
    ok(`demo GET ${name}`, r.status === 200 && r.data, `status ${r.status}`);
  }
  const sum = (await call("/dashboard/summary", { token: dt })).data;
  ok("demo has this-month data", sum.expenseThisMonth > 0 && sum.incomeThisMonth > 0);
  ok("demo has health score + safe-to-spend", sum.health?.score > 0 && sum.safeToSpend?.perDay > 0);
  const recs = await call("/insights/recommendations", { token: dt });
  ok("demo recommendations", recs.status === 200 && Array.isArray(recs.data) && recs.data.length > 0, JSON.stringify(recs.data).slice(0, 120));
  const subs = (await call("/insights/subscriptions", { token: dt })).data;
  ok("demo detects subscriptions", (subs.subscriptions || subs).length > 0);
  const ask = await call("/insights/ask", { method: "POST", token: dt, body: { question: "How much did I spend this month?" } });
  ok("Ask AI answers", ask.status === 200 && ask.data.answer, `status ${ask.status} ${JSON.stringify(ask.data).slice(0, 120)}`);
  ok("rejects missing token", (await call("/accounts")).status === 401);

  // ---------- throwaway account: full CRUD + settings ----------
  const email = `smoke${Date.now()}@test.local`;
  const su = await call("/auth/signup", { method: "POST", body: { name: "Smoke Test", email, password: "password123" } });
  ok("signup", su.status === 201);
  const t = su.data.token;
  ok("duplicate signup rejected", (await call("/auth/signup", { method: "POST", body: { name: "x y", email, password: "password123" } })).status === 409);
  ok("bad login rejected", (await call("/auth/login", { method: "POST", body: { email, password: "wrongpass" } })).status === 401);

  const cats = (await call("/categories", { token: t })).data;
  const groceries = cats.find(c => c.name === "Groceries"), income = cats.find(c => c.name === "Income");
  ok("default categories", cats.length >= 8 && groceries && income);
  const accts = (await call("/accounts", { token: t })).data;
  ok("default account", accts.length === 1);
  const newAcct = await call("/accounts", { method: "POST", token: t, body: { name: "Savings X", type: "Savings", balance: 1000 } });
  ok("create account", newAcct.status === 201 || newAcct.status === 200, JSON.stringify(newAcct.data));

  const inc = await call("/transactions", { method: "POST", token: t, body: { type: "income", amount: 50000, categoryId: income.id, accountId: accts[0].id, description: "Salary", date: today } });
  ok("add income", inc.status === 201 || inc.status === 200, JSON.stringify(inc.data));
  const exp = await call("/transactions", { method: "POST", token: t, body: { type: "expense", amount: 1200, categoryId: groceries.id, accountId: accts[0].id, description: "Veg", date: today } });
  ok("add expense", exp.status === 201 || exp.status === 200);
  ok("balance updated", (await call("/accounts", { token: t })).data.find(a => a.id === accts[0].id).balance === 48800);
  ok("reject negative amount", (await call("/transactions", { method: "POST", token: t, body: { type: "expense", amount: -5, categoryId: groceries.id, accountId: accts[0].id, date: today } })).status === 400);

  const bud = await call("/budgets", { method: "POST", token: t, body: { categoryId: groceries.id, monthlyLimit: 1000 } });
  ok("set budget", bud.status === 200 || bud.status === 201, JSON.stringify(bud.data));
  const budgets = (await call("/budgets", { token: t })).data;
  ok("budget shows overspend", budgets[0]?.percentUsed > 100, JSON.stringify(budgets[0]));
  const goal = await call("/goals", { method: "POST", token: t, body: { name: "Trip", targetAmount: 20000, deadline: "2027-12-31" } });
  ok("create goal", goal.status === 201 || goal.status === 200, JSON.stringify(goal.data));
  const gid = goal.data.id;
  ok("contribute to goal", (await call(`/goals/${gid}/contribute`, { method: "POST", token: t, body: { amount: 500 } })).status === 200);
  const bill = await call("/bills", { method: "POST", token: t, body: { name: "Wifi", amount: 799, dueDay: 5, categoryId: cats.find(c => c.name === "Utilities").id } });
  ok("create bill", bill.status === 201 || bill.status === 200, JSON.stringify(bill.data));
  ok("dashboard for new user", (await call("/dashboard/summary", { token: t })).status === 200);
  ok("scan rejects non-image", (await call("/scan/receipt", { method: "POST", token: t, body: { image: "abc", mimeType: "text/plain" } })).status === 400);

  const prof = await call("/settings/profile", { method: "PUT", token: t, body: { name: "Smoke Renamed", email } });
  ok("update profile", prof.status === 200 && prof.data.user.name === "Smoke Renamed", JSON.stringify(prof.data));
  ok("profile rejects email clash", (await call("/settings/profile", { method: "PUT", token: t, body: { name: "Smoke", email: "demo@gmail.com" } })).status === 409);
  ok("password wrong current rejected", (await call("/settings/password", { method: "POST", token: t, body: { current: "nope", next: "newpassword1" } })).status === 401);
  ok("change password", (await call("/settings/password", { method: "POST", token: t, body: { current: "password123", next: "newpassword1" } })).status === 200);
  ok("login with new password", (await call("/auth/login", { method: "POST", body: { email, password: "newpassword1" } })).status === 200);
  const exp2 = await call("/settings/export", { token: t });
  ok("export data", exp2.status === 200 && exp2.data.transactions.length === 2 && exp2.data.goals.length === 1, JSON.stringify({t: exp2.data.transactions?.length, g: exp2.data.goals?.length}));
  ok("delete transaction", (await call(`/transactions/${exp.data.transaction?.id || exp.data.id}`, { method: "DELETE", token: t })).status < 300);
  ok("clear data", (await call("/settings/clear-data", { method: "POST", token: t })).status === 200);
  ok("data cleared", (await call("/transactions", { token: t })).data.length === 0 && (await call("/goals", { token: t })).data.length === 0);
  ok("delete account wrong password", (await call("/settings/account", { method: "DELETE", token: t, body: { password: "bad" } })).status === 401);
  ok("delete account", (await call("/settings/account", { method: "DELETE", token: t, body: { password: "newpassword1" } })).status === 200);
  ok("deleted account cannot log in", (await call("/auth/login", { method: "POST", body: { email, password: "newpassword1" } })).status === 401);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
