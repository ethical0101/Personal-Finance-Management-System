# Wealthline

**Software Metrics-Driven AI-Powered Personal Finance Management System**

A working personal finance app — signup, accounts, transactions, budgets,
goals, recurring bills, and an AI layer (anomaly detection, expense
forecasting, Gemini-powered recommendations) — built alongside a full
software-metrics program that measures the project itself: data collection,
classical analysis techniques (decision tree, box plot, control chart,
three types of correlation), and Bayesian-network-driven risk analysis. The
metrics dashboard is embedded directly in the app as a tab, not a separate
document.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [How to run it](#how-to-run-it)
- [Environment variables](#environment-variables)
- [Reproducing the metrics analysis](#reproducing-the-metrics-analysis)
- [Deploying to Vercel](#deploying-to-vercel)

## Features

| Area | What it does |
|---|---|
| Auth | Signup / login, bcrypt-hashed passwords, JWT sessions |
| Accounts | Savings / Checking / Credit Card, live balances |
| Transactions | Add / delete, categorized, running balance |
| Budgets | Monthly limits per category with live spent/remaining |
| Goals | Savings targets with contribution tracking |
| Recurring bills | Monthly bill tracking |
| Anomaly detection | z-score check on every new expense against category history |
| Expense forecasting | Linear regression over monthly category totals |
| AI recommendations | Gemini API reads the user's real financial snapshot and returns specific, actionable advice, with Accept/Dismiss tracked as an event |
| Metrics Command Deck | Module 3 (data collection, decision tree, box plot, control chart, Pearson/Spearman/Kendall correlation) and Module 4 (Bayesian risk & defect-prediction networks, risk register) — embedded as an in-app tab |

## Tech stack

**Frontend** — React 19, Vite, vanilla CSS (IBM Plex Sans / IBM Plex Mono)
**Backend** — Node.js, Express, JWT (`jsonwebtoken`), `bcryptjs`, `dotenv`
**AI** — Google Gemini API (`gemini-3.6-flash`)
**Data & analysis** — Python: pandas, numpy, scipy, scikit-learn, matplotlib
**Storage** — a small synchronous JSON-file datastore (demo-grade; see [Environment variables](#environment-variables) and the Vercel section for the production caveat)
**Deployment** — Vercel (serverless function for the API, static hosting for the React build and the metrics dashboard)

## Project structure

```
├── api/                   Vercel serverless entrypoint (wraps app/server/app.js)
├── app/
│   ├── server/             Express API
│   │   ├── app.js           the Express app (no .listen — reused by api/index.js)
│   │   ├── index.js         local dev entrypoint (app.js + static file serving)
│   │   ├── db.js            JSON-file datastore
│   │   ├── routes/          auth, accounts, transactions, budgets, goals, bills,
│   │   │                    notifications, insights, dashboard
│   │   ├── lib/              ai.js (forecast/anomaly), gemini.js (Gemini API)
│   │   └── middleware/auth.js
│   └── web/                React 19 + Vite frontend
│       ├── src/components/  AppShell, AuthScreen, per-tab views
│       └── scripts/sync-metrics.cjs   copies dashboard/index.html into public/metrics/
├── data/                   generated module- and sprint-level metrics (generate_data.py)
├── analysis/               correlation, decision tree, box plot, control chart,
│                           Bayesian network (analyze.py, bayesian_network.py)
├── charts/                 PNG chart output of the analysis
├── dashboard/              self-contained Metrics Command Deck (index.html, built
│                           by build_dashboard.py)
├── report/                 Project_Report_Modules_3-4.docx + screenshots
└── vercel.json
```

## How to run it

**Prerequisites:** Node.js 18+, npm. (Python 3.10+ only if you want to
regenerate the metrics data/charts — see below.)

### Quick start (production-style, one server)

```bash
git clone https://github.com/ethical0101/Personal-Finance-Management-System.git
cd Personal-Finance-Management-System

# 1. Configure the API
cd app/server
npm install
cp .env.example .env        # then edit .env and set GEMINI_API_KEY

# 2. Build the frontend
cd ../web
npm install
npm run build                # also copies the metrics dashboard into public/metrics/

# 3. Run
cd ../server
node index.js
```

Open **http://localhost:4000**, sign up, and use the app.

### Dev mode (hot reload, two terminals)

```bash
# terminal 1 — API
cd app/server && npm install && node index.js        # :4000

# terminal 2 — frontend
cd app/web && npm install && npm run dev              # :5173, proxies /api and /metrics to :4000
```

Open **http://localhost:5173**.

## Environment variables

Set in `app/server/.env` (copy from `app/server/.env.example` — `.env` is
gitignored and must never be committed):

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Recommended | Enables live AI Insights recommendations. Without it, the route falls back to rule-based recommendations only. |
| `JWT_SECRET` | Recommended | Signs auth tokens. Set a real random value in production. |
| `PORT` | No | Local server port (default `4000`). Not used on Vercel. |

## Reproducing the metrics analysis

```bash
python analysis/generate_data.py
python analysis/analyze.py
python analysis/bayesian_network.py
python dashboard/build_dashboard.py
```

This regenerates `data/*.csv`, `charts/*.png`, `analysis/*.json`, and
`dashboard/index.html`. Re-run `npm run build --prefix app/web` afterward
to pick up the refreshed dashboard in the app's Metrics tab.

## Deploying to Vercel

The repo is already configured for Vercel: `vercel.json` builds the React
app as static output, wraps the Express API as a serverless function
(`api/index.js`), and serves the Metrics Command Deck as a plain static
file at `/metrics`.

### Option A — Vercel dashboard

1. Push this repo to GitHub (already done if you're reading this from there).
2. On [vercel.com](https://vercel.com), **Add New → Project**, import the repo.
3. Leave the build settings as detected from `vercel.json` (no changes needed).
4. Under **Environment Variables**, add `GEMINI_API_KEY` and `JWT_SECRET`.
5. Click **Deploy**.

### Option B — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel link                 # first time only — creates/links the Vercel project
vercel env add GEMINI_API_KEY
vercel env add JWT_SECRET
vercel --prod
```

### ⚠️ Storage caveat — read before you rely on this deployment

The JSON-file datastore (`app/server/db.js`) writes to local disk. On
Vercel, the deployed bundle is **read-only** except for `/tmp`, and `/tmp`
is **not persistent** — it can be wiped on every cold start and is not
shared across regions or concurrent instances. `db.js` automatically
detects `process.env.VERCEL` and writes to `/tmp` there instead of
crashing, so the app **runs** on Vercel, but signups/transactions **are
not guaranteed to persist** — that's fine for a live walkthrough or demo,
not for real users.

For a production deployment, swap `app/server/db.js` for a hosted
database (e.g. Vercel Postgres, MongoDB Atlas, or Neon) — the rest of the
codebase (routes, auth, AI layer) doesn't need to change, only the four
functions in `db.js` (`all`, `find`, `insert`, `update`, `remove`).

## API reference

See [app/README.md](app/README.md) for the full route list and the AI
layer's implementation notes.

## Team

K Druthendra · G Sai Santhosh · P Siva Kiran · Shaik Nihal
