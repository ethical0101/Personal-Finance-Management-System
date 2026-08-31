# Wealthline — Personal Finance App

Full-stack implementation of the Domain, AI and Service layers from the
Review 0 class diagram: `User`, `Account` (Savings/Checking/CreditCard),
`Transaction`, `Category`, `Budget`, `FinancialGoal`, `RecurringBill`,
`AuthenticationService`, and a real `AIRecommendationEngine`
(expense forecasting + anomaly detection).

## Stack

- `server/` — Node.js + Express REST API. JWT auth (`jsonwebtoken`), bcrypt
  password hashing (`bcryptjs`). Storage is a small synchronous JSON-file
  datastore (`server/db.js`) — swap for Postgres/Mongo before any real
  multi-user deployment; there's no row locking.
- `public/` — vanilla HTML/CSS/JS single-page app, no build step.

## Run it

```bash
cd server
npm install
node index.js
```

Open http://localhost:4000. Sign up (creates default categories and a
Primary Checking account), then add accounts/transactions/budgets/goals.

## AI layer (`server/lib/ai.js`)

- **Anomaly detection** — z-score of a new expense against the user's
  trailing history in that category (flags |z| ≥ 2.5); flagged transactions
  raise a notification and surface in AI Insights.
- **Expense forecasting** — linear regression over monthly category totals
  (falls back to a moving average with < 3 months of history).
- **Recommendations** — forecast-vs-budget warnings, anomaly call-outs, and a
  savings-rate check; each recommendation can be Accepted or Dismissed, and
  that event is logged (`/api/insights/recommendations/:id/action`) — this is
  the Recommendation Acceptance Rate metric from the Review 0 GQ(I)M plan.

## API surface

`POST /api/auth/signup`, `POST /api/auth/login`, then Bearer-token protected:
`/api/accounts`, `/api/categories`, `/api/transactions`, `/api/budgets`,
`/api/goals` (+`/:id/contribute`), `/api/bills`, `/api/notifications`,
`/api/insights/forecast`, `/api/insights/recommendations`, `/api/dashboard/summary`.
