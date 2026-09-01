# Wealthline — Personal Finance App

Full-stack implementation of the Domain, AI and Service layers from the
Review 0 class diagram: `User`, `Account` (Savings/Checking/CreditCard),
`Transaction`, `Category`, `Budget`, `FinancialGoal`, `RecurringBill`,
`AuthenticationService`, and a real `AIRecommendationEngine`
(expense forecasting + anomaly detection + Gemini-powered recommendations).

## Stack

- `server/app.js` — the Express app itself (routes, middleware, error
  handler), with no `.listen()` call. JWT auth (`jsonwebtoken`), bcrypt
  password hashing (`bcryptjs`). Storage is a small synchronous JSON-file
  datastore (`server/db.js`) — swap for Postgres/Mongo before any real
  multi-user deployment; there's no row locking, and on Vercel it writes to
  `/tmp` (non-persistent) since the deployment bundle is read-only — see
  the root README's Vercel section.
- `server/index.js` — local dev entrypoint: `app.js` plus static file
  serving for the React build, all on one port. Not used on Vercel.
- `web/` — React 19 + Vite single-page app (`app/web`).
- `../api/index.js` (repo root) — the Vercel serverless entrypoint; just
  re-exports `server/app.js`. Static files (the React build and the
  metrics dashboard) are served directly by Vercel's CDN, not by this
  function — see `vercel.json`.

`web/scripts/sync-metrics.cjs` copies `../dashboard/index.html` (the
self-contained Module 3/4 dashboard) into `web/public/metrics/index.html`
on every `npm run dev` / `npm run build`, so it's served as a plain static
file at `/metrics` — identical behavior locally and on Vercel, and the
React app embeds it in its own **Metrics** tab via `<iframe src="/metrics/">`.

## Run it

**Dev** (hot reload, two servers):
```bash
cd server && npm install && node index.js      # API on :4000
cd web && npm install && npm run dev           # React on :5173, proxies /api and /metrics to :4000
```
Open http://localhost:5173.

**Production** (one server):
```bash
cd web && npm install && npm run build         # writes web/dist
cd ../server && npm install && node index.js   # serves web/dist + the API on :4000
```
Open http://localhost:4000.

Sign up (creates default categories and a Primary Checking account), then
add accounts/transactions/budgets/goals.

## Gemini API key

Recommendations in AI Insights call the Gemini API. Copy `server/.env.example`
to `server/.env` and set `GEMINI_API_KEY` — `.env` is gitignored and must
never be committed. Without a key, the route silently falls back to the
rule-based recommendations only (forecast-vs-budget, anomalies, savings rate).

## AI layer (`server/lib/ai.js`, `server/lib/gemini.js`)

- **Anomaly detection** — z-score of a new expense against the user's
  trailing history in that category (flags |z| ≥ 2.5); flagged transactions
  raise a notification and surface in AI Insights.
- **Expense forecasting** — linear regression over monthly category totals
  (falls back to a moving average with < 3 months of history).
- **Gemini recommendations** — the forecast/budget/anomaly snapshot for the
  signed-in user is sent to `gemini-3.6-flash`, which returns 2-4 specific,
  natural-language recommendations; each can be Accepted or Dismissed, and
  that event is logged (`/api/insights/recommendations/:id/action`) — this is
  the Recommendation Acceptance Rate metric from the Review 0 GQ(I)M plan.

## API surface

`POST /api/auth/signup`, `POST /api/auth/login`, then Bearer-token protected:
`/api/accounts`, `/api/categories`, `/api/transactions`, `/api/budgets`,
`/api/goals` (+`/:id/contribute`), `/api/bills`, `/api/notifications`,
`/api/insights/forecast`, `/api/insights/recommendations`, `/api/dashboard/summary`.
