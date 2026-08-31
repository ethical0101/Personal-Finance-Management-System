(() => {
  "use strict";

  const API = "/api";
  let TOKEN = localStorage.getItem("wealthline_token") || null;
  let ME = JSON.parse(localStorage.getItem("wealthline_user") || "null");
  let categoriesCache = [];
  let accountsCache = [];

  // ---------------- API helper ----------------
  async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(API + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status}).`;
      throw new Error(message);
    }
    return data;
  }

  // ---------------- toasts ----------------
  function toast(message, kind = "") {
    const wrap = document.getElementById("toastWrap");
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  // ---------------- theme ----------------
  (function initTheme() {
    const root = document.documentElement;
    const saved = localStorage.getItem("wealthline_theme");
    if (saved) root.setAttribute("data-theme", saved);
    document.getElementById("themeToggle").addEventListener("click", () => {
      const cur = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = cur === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("wealthline_theme", next);
    });
  })();

  // ---------------- auth screen wiring ----------------
  const authTabs = document.querySelectorAll("[data-authtab]");
  authTabs.forEach(btn => btn.addEventListener("click", () => {
    authTabs.forEach(b => b.setAttribute("aria-selected", b === btn ? "true" : "false"));
    document.getElementById("loginForm").classList.toggle("hidden", btn.dataset.authtab !== "login");
    document.getElementById("signupForm").classList.toggle("hidden", btn.dataset.authtab !== "signup");
  }));

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("loginError");
    errEl.textContent = "";
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: {
          email: document.getElementById("loginEmail").value.trim(),
          password: document.getElementById("loginPassword").value,
        },
      });
      onAuthed(data);
    } catch (err) { errEl.textContent = err.message; }
  });

  document.getElementById("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("signupError");
    errEl.textContent = "";
    try {
      const data = await api("/auth/signup", {
        method: "POST",
        body: {
          name: document.getElementById("signupName").value.trim(),
          email: document.getElementById("signupEmail").value.trim(),
          password: document.getElementById("signupPassword").value,
        },
      });
      onAuthed(data);
      toast("Account created. Welcome to Wealthline.", "success");
    } catch (err) { errEl.textContent = err.message; }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    TOKEN = null; ME = null;
    localStorage.removeItem("wealthline_token");
    localStorage.removeItem("wealthline_user");
    document.getElementById("appShell").classList.add("hidden");
    document.getElementById("authScreen").classList.remove("hidden");
  });

  function onAuthed(data) {
    TOKEN = data.token; ME = data.user;
    localStorage.setItem("wealthline_token", TOKEN);
    localStorage.setItem("wealthline_user", JSON.stringify(ME));
    enterApp();
  }

  // ---------------- mobile sidebar toggle ----------------
  const sidebarEl = document.querySelector("aside.sidebar");
  const scrimEl = document.getElementById("sidebarScrim");
  function closeSidebar() { sidebarEl.classList.remove("open"); scrimEl.classList.remove("open"); }
  document.getElementById("mobileNavToggle").addEventListener("click", () => {
    sidebarEl.classList.add("open"); scrimEl.classList.add("open");
  });
  scrimEl.addEventListener("click", closeSidebar);

  // ---------------- nav / view router ----------------
  const navlinks = document.querySelectorAll(".navlink[data-view]");
  navlinks.forEach(btn => btn.addEventListener("click", () => { showView(btn.dataset.view); closeSidebar(); }));

  function showView(id) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    navlinks.forEach(b => b.classList.toggle("active", b.dataset.view === id));
    const loaders = {
      dashboardView: loadDashboard, transactionsView: loadTransactions, accountsView: loadAccounts,
      budgetsView: loadBudgets, goalsView: loadGoals, billsView: loadBills,
      insightsView: loadInsights, notificationsView: loadNotifications,
    };
    (loaders[id] || (() => {}))();
  }

  // ---------------- modal helper ----------------
  function openModal(title, fieldsHtml, onSubmit) {
    const root = document.getElementById("modalRoot");
    root.innerHTML = `
      <div class="modal-backdrop" id="modalBackdrop">
        <div class="modal">
          <h3>${title}</h3>
          <form id="modalForm">${fieldsHtml}
            <div class="form-error" id="modalError"></div>
            <div class="modal-foot">
              <button type="button" class="btn btn-ghost" id="modalCancel">Cancel</button>
              <button type="submit" class="btn btn-primary" id="modalSubmit">Save</button>
            </div>
          </form>
        </div>
      </div>`;
    const close = () => { root.innerHTML = ""; };
    document.getElementById("modalCancel").addEventListener("click", close);
    document.getElementById("modalBackdrop").addEventListener("click", (e) => { if (e.target.id === "modalBackdrop") close(); });
    document.getElementById("modalForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("modalError");
      errEl.textContent = "";
      try {
        await onSubmit(new FormData(e.target));
        close();
      } catch (err) { errEl.textContent = err.message; }
    });
    return close;
  }

  function categoryOptions(selectedId) {
    return categoriesCache.map(c => `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
  }
  function accountOptions(selectedId) {
    return accountsCache.map(a => `<option value="${a.id}" ${a.id === selectedId ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("");
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }
  function money(n) {
    const sign = n < 0 ? "-" : "";
    return `${sign}₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  function todayStr() { return new Date().toISOString().slice(0, 10); }

  // ================= DASHBOARD =================
  async function loadDashboard() {
    const s = await api("/dashboard/summary");
    const kpis = [
      { label: "Net worth", value: money(s.netWorth), delta: `${s.transactionCount} total transactions`, cls: "" },
      { label: "Income (month)", value: money(s.incomeThisMonth), delta: "this calendar month", cls: "good" },
      { label: "Expense (month)", value: money(s.expenseThisMonth), delta: "this calendar month", cls: "" },
      { label: "Savings rate", value: `${s.savingsRateThisMonth}%`, delta: "of income kept", cls: s.savingsRateThisMonth < 10 ? "critical" : "good" },
    ];
    document.getElementById("kpiGrid").innerHTML = kpis.map(k => `
      <div class="card kpi"><span class="label">${k.label}</span><span class="value ${k.cls}">${k.value}</span><span class="delta">${k.delta}</span></div>`).join("");

    const max = Math.max(1, ...s.spendByCategory.map(c => c.total));
    document.getElementById("spendByCategory").innerHTML = s.spendByCategory.length
      ? s.spendByCategory.map(c => `
        <div class="bar-row">
          <span class="name">${escapeHtml(c.categoryName)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${(c.total / max) * 100}%"></div></div>
          <span class="pct">${money(c.total)}</span>
        </div>`).join("")
      : `<div class="empty">No expenses logged this month yet.</div>`;

    const recent = await api("/transactions?limit=6");
    document.getElementById("recentTransactions").innerHTML = recent.length
      ? recent.map(t => txRowMini(t)).join("")
      : `<div class="empty">No transactions yet — add your first one.</div>`;
  }

  function txRowMini(t) {
    const cat = categoriesCache.find(c => c.id === t.categoryId);
    return `<div class="bar-row" style="grid-template-columns: 1fr auto;">
      <span class="name">${escapeHtml(t.description || (cat ? cat.name : "Transaction"))} · ${t.date}</span>
      <span class="pct amount ${t.type}">${t.type === "income" ? "+" : "-"}${money(t.amount)}</span>
    </div>`;
  }

  // ================= TRANSACTIONS =================
  async function loadTransactions() {
    const [tx, cats, accs] = await Promise.all([api("/transactions"), api("/categories"), api("/accounts")]);
    categoriesCache = cats; accountsCache = accs;
    document.getElementById("txTableBody").innerHTML = tx.length ? tx.map(t => {
      const cat = cats.find(c => c.id === t.categoryId);
      const acc = accs.find(a => a.id === t.accountId);
      const flag = t.flaggedAnomaly
        ? `<span class="chip critical"><span class="dot"></span>Anomaly z=${t.anomalyZScore}</span>`
        : `<span class="chip neutral">Normal</span>`;
      return `<tr>
        <td>${t.date}</td>
        <td>${escapeHtml(t.description || "—")}</td>
        <td>${cat ? escapeHtml(cat.name) : "—"}</td>
        <td>${acc ? escapeHtml(acc.name) : "—"}</td>
        <td class="num amount ${t.type}">${t.type === "income" ? "+" : "-"}${money(t.amount)}</td>
        <td>${flag}</td>
        <td><button class="btn btn-sm btn-ghost" data-del-tx="${t.id}">Delete</button></td>
      </tr>`;
    }).join("") : `<tr><td colspan="7"><div class="empty">No transactions yet.</div></td></tr>`;

    document.querySelectorAll("[data-del-tx]").forEach(btn => btn.addEventListener("click", async () => {
      try { await api(`/transactions/${btn.dataset.delTx}`, { method: "DELETE" }); loadTransactions(); }
      catch (e) { toast(e.message, "error"); }
    }));
  }

  document.getElementById("openAddTx").addEventListener("click", async () => {
    if (categoriesCache.length === 0) { categoriesCache = await api("/categories"); }
    if (accountsCache.length === 0) { accountsCache = await api("/accounts"); }
    openModal("Add transaction", `
      <div class="field"><label>Type</label>
        <select name="type"><option value="expense">Expense</option><option value="income">Income</option></select></div>
      <div class="field"><label>Amount</label><input name="amount" type="number" step="0.01" min="0.01" required></div>
      <div class="field"><label>Category</label><select name="categoryId">${categoryOptions()}</select></div>
      <div class="field"><label>Account</label><select name="accountId">${accountOptions()}</select></div>
      <div class="field"><label>Description</label><input name="description" type="text" placeholder="e.g. Grocery run"></div>
      <div class="field"><label>Date</label><input name="date" type="date" value="${todayStr()}" required></div>
    `, async (fd) => {
      const result = await api("/transactions", {
        method: "POST",
        body: {
          type: fd.get("type"), amount: Number(fd.get("amount")), categoryId: fd.get("categoryId"),
          accountId: fd.get("accountId"), description: fd.get("description"), date: fd.get("date"),
        },
      });
      toast(result.anomaly.isAnomaly ? "Transaction added — flagged as unusual." : "Transaction added.", result.anomaly.isAnomaly ? "error" : "success");
      loadTransactions(); refreshNotifBadge();
    });
  });

  // ================= ACCOUNTS =================
  async function loadAccounts() {
    const accs = await api("/accounts");
    accountsCache = accs;
    document.getElementById("accountsGrid").innerHTML = accs.length ? accs.map(a => `
      <div class="card">
        <div class="section-title"><h3>${escapeHtml(a.name)}</h3><span class="chip neutral">${a.type}</span></div>
        <div class="kpi"><span class="value">${money(a.balance)}</span><span class="delta">Current balance</span></div>
      </div>`).join("") : `<div class="empty">No accounts yet.</div>`;
  }

  document.getElementById("openAddAccount").addEventListener("click", () => {
    openModal("Add account", `
      <div class="field"><label>Name</label><input name="name" type="text" required placeholder="e.g. HDFC Savings"></div>
      <div class="field"><label>Type</label>
        <select name="type"><option value="Savings">Savings</option><option value="Checking">Checking</option><option value="CreditCard">Credit Card</option></select></div>
      <div class="field"><label>Opening balance</label><input name="balance" type="number" step="0.01" value="0"></div>
    `, async (fd) => {
      await api("/accounts", { method: "POST", body: { name: fd.get("name"), type: fd.get("type"), balance: Number(fd.get("balance")) } });
      toast("Account added.", "success");
      loadAccounts();
    });
  });

  // ================= BUDGETS =================
  async function loadBudgets() {
    const [budgets, cats] = await Promise.all([api("/budgets"), api("/categories")]);
    categoriesCache = cats;
    document.getElementById("budgetsList").innerHTML = budgets.length ? budgets.map(b => {
      const cat = cats.find(c => c.id === b.categoryId);
      const over = b.percentUsed > 100;
      return `<div style="padding:12px 0;border-bottom:1px solid var(--border);">
        <div class="section-title" style="margin-bottom:4px;">
          <h3 style="font-size:13.5px;">${cat ? escapeHtml(cat.name) : "—"}</h3>
          <span class="chip ${over ? "critical" : "neutral"}">${money(b.spent)} / ${money(b.monthlyLimit)}</span>
        </div>
        <div class="progress-track"><div class="progress-fill ${over ? "over" : ""}" style="width:${Math.min(100, b.percentUsed)}%"></div></div>
      </div>`;
    }).join("") : `<div class="empty">No budgets set for this month yet.</div>`;
  }

  document.getElementById("openAddBudget").addEventListener("click", async () => {
    if (categoriesCache.length === 0) categoriesCache = await api("/categories");
    openModal("Set monthly budget", `
      <div class="field"><label>Category</label><select name="categoryId">${categoryOptions()}</select></div>
      <div class="field"><label>Monthly limit</label><input name="monthlyLimit" type="number" step="0.01" min="1" required></div>
    `, async (fd) => {
      await api("/budgets", { method: "POST", body: { categoryId: fd.get("categoryId"), monthlyLimit: Number(fd.get("monthlyLimit")) } });
      toast("Budget saved.", "success");
      loadBudgets();
    });
  });

  // ================= GOALS =================
  async function loadGoals() {
    const goals = await api("/goals");
    document.getElementById("goalsGrid").innerHTML = goals.length ? goals.map(g => {
      const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
      return `<div class="card">
        <div class="section-title"><h3>${escapeHtml(g.name)}</h3><span class="chip neutral">${pct}%</span></div>
        <p style="margin-bottom:6px;">${money(g.currentAmount)} of ${money(g.targetAmount)}${g.deadline ? " · by " + g.deadline : ""}</p>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="modal-foot" style="justify-content:flex-start;margin-top:12px;">
          <button class="btn btn-sm btn-primary" data-contribute="${g.id}">+ Contribute</button>
        </div>
      </div>`;
    }).join("") : `<div class="empty">No goals yet — set your first savings target.</div>`;

    document.querySelectorAll("[data-contribute]").forEach(btn => btn.addEventListener("click", () => {
      openModal("Add to goal", `<div class="field"><label>Amount</label><input name="amount" type="number" step="0.01" min="0.01" required></div>`, async (fd) => {
        await api(`/goals/${btn.dataset.contribute}/contribute`, { method: "POST", body: { amount: Number(fd.get("amount")) } });
        toast("Contribution recorded.", "success");
        loadGoals();
      });
    }));
  }

  document.getElementById("openAddGoal").addEventListener("click", () => {
    openModal("Add goal", `
      <div class="field"><label>Name</label><input name="name" type="text" required placeholder="e.g. Emergency fund"></div>
      <div class="field"><label>Target amount</label><input name="targetAmount" type="number" step="0.01" min="1" required></div>
      <div class="field"><label>Deadline (optional)</label><input name="deadline" type="date"></div>
    `, async (fd) => {
      await api("/goals", { method: "POST", body: { name: fd.get("name"), targetAmount: Number(fd.get("targetAmount")), deadline: fd.get("deadline") || null } });
      toast("Goal created.", "success");
      loadGoals();
    });
  });

  // ================= BILLS =================
  async function loadBills() {
    const [bills, cats] = await Promise.all([api("/bills"), api("/categories")]);
    categoriesCache = cats;
    document.getElementById("billsTableBody").innerHTML = bills.length ? bills.map(b => {
      const cat = cats.find(c => c.id === b.categoryId);
      return `<tr>
        <td>${escapeHtml(b.name)}</td><td>${cat ? escapeHtml(cat.name) : "—"}</td>
        <td class="num">${money(b.amount)}</td><td class="num">${b.dueDay}</td>
        <td><button class="btn btn-sm btn-ghost" data-del-bill="${b.id}">Delete</button></td>
      </tr>`;
    }).join("") : `<tr><td colspan="5"><div class="empty">No recurring bills yet.</div></td></tr>`;

    document.querySelectorAll("[data-del-bill]").forEach(btn => btn.addEventListener("click", async () => {
      await api(`/bills/${btn.dataset.delBill}`, { method: "DELETE" }); loadBills();
    }));
  }

  document.getElementById("openAddBill").addEventListener("click", async () => {
    if (categoriesCache.length === 0) categoriesCache = await api("/categories");
    openModal("Add recurring bill", `
      <div class="field"><label>Name</label><input name="name" type="text" required placeholder="e.g. Internet"></div>
      <div class="field"><label>Category</label><select name="categoryId">${categoryOptions()}</select></div>
      <div class="field"><label>Amount</label><input name="amount" type="number" step="0.01" min="0.01" required></div>
      <div class="field"><label>Due day of month</label><input name="dueDay" type="number" min="1" max="28" value="1" required></div>
    `, async (fd) => {
      await api("/bills", { method: "POST", body: { name: fd.get("name"), categoryId: fd.get("categoryId"), amount: Number(fd.get("amount")), dueDay: Number(fd.get("dueDay")) } });
      toast("Recurring bill added.", "success");
      loadBills();
    });
  });

  // ================= AI INSIGHTS =================
  async function loadInsights() {
    const [forecasts, recs] = await Promise.all([api("/insights/forecast"), api("/insights/recommendations")]);
    document.getElementById("forecastList").innerHTML = forecasts.length ? forecasts.map(f => `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div class="section-title" style="margin-bottom:2px;"><h3 style="font-size:13.5px;">${escapeHtml(f.categoryName)}</h3><span class="chip neutral">${f.method}</span></div>
        <p style="margin:0;">Forecast next month: <b class="mono" style="color:var(--ink)">${money(f.forecast)}</b> (confidence: ${f.confidence})</p>
      </div>`).join("") : `<div class="empty">Add a few expenses to unlock forecasts.</div>`;

    document.getElementById("recommendationsList").innerHTML = recs.length ? recs.map(r => `
      <div class="rec-card">
        <div class="stripe ${r.severity}"></div>
        <div class="body">
          <div class="msg">${escapeHtml(r.message)}</div>
          <div class="suggestion">${escapeHtml(r.suggestion)}</div>
          <div class="rec-actions">
            <button class="btn btn-sm btn-primary" data-rec-action="${r.id}" data-action="accepted">Accept</button>
            <button class="btn btn-sm btn-ghost" data-rec-action="${r.id}" data-action="dismissed">Dismiss</button>
          </div>
        </div>
      </div>`).join("") : `<div class="empty">No recommendations right now — you're on track.</div>`;

    document.querySelectorAll("[data-rec-action]").forEach(btn => btn.addEventListener("click", async () => {
      await api(`/insights/recommendations/${btn.dataset.recAction}/action`, { method: "POST", body: { action: btn.dataset.action } });
      btn.closest(".rec-card").style.opacity = "0.4";
      btn.closest(".rec-card").querySelectorAll("button").forEach(b => b.disabled = true);
      toast(btn.dataset.action === "accepted" ? "Recommendation accepted." : "Recommendation dismissed.", "success");
    }));
  }

  // ================= NOTIFICATIONS =================
  async function loadNotifications() {
    const notes = await api("/notifications");
    document.getElementById("notificationsList").innerHTML = notes.length ? notes
      .filter(n => n.type !== "recommendation-event")
      .map(n => `
      <div class="notif-item ${n.read ? "read" : "unread"}" data-note="${n.id}">
        <span class="dot-status"></span>
        <div class="txt">${escapeHtml(n.message)}<div class="when">${new Date(n.createdAt).toLocaleString()}</div></div>
        ${!n.read ? `<button class="btn btn-sm btn-ghost" data-mark-read="${n.id}">Mark read</button>` : ""}
      </div>`).join("") : `<div class="empty">No notifications yet.</div>`;

    document.querySelectorAll("[data-mark-read]").forEach(btn => btn.addEventListener("click", async () => {
      await api(`/notifications/${btn.dataset.markRead}/read`, { method: "POST" });
      loadNotifications(); refreshNotifBadge();
    }));
    refreshNotifBadge();
  }

  async function refreshNotifBadge() {
    const notes = await api("/notifications");
    const unread = notes.filter(n => !n.read && n.type !== "recommendation-event").length;
    const badge = document.getElementById("notifBadge");
    if (unread > 0) { badge.textContent = unread; badge.classList.remove("hidden"); }
    else { badge.classList.add("hidden"); }
  }

  // ---------------- boot ----------------
  async function enterApp() {
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("appShell").classList.remove("hidden");
    document.getElementById("userName").textContent = ME.name;
    document.getElementById("userEmail").textContent = ME.email;
    document.getElementById("userAvatar").textContent = (ME.name || "U").slice(0, 1).toUpperCase();
    try {
      categoriesCache = await api("/categories");
      accountsCache = await api("/accounts");
    } catch (e) { /* handled per-view */ }
    showView("dashboardView");
    refreshNotifBadge();
  }

  if (TOKEN && ME) {
    enterApp().catch(() => {
      TOKEN = null; ME = null;
      localStorage.removeItem("wealthline_token"); localStorage.removeItem("wealthline_user");
    });
  }
})();
