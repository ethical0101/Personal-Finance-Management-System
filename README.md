# Software Metrics-Driven AI-Powered Personal Finance Management System

Full-stack personal finance app (`app/`) plus the Review 1 metrics program
(`data/`, `analysis/`, `charts/`, `dashboard/`, `report/`) that measures it —
implementing **Module 3 (Software Metrics Data Collection)** and **Module 4
(Metrics for Decision Support)** on top of the Review 0 GQ(I)M report.

## Layout

- `app/` — the working product: signup/login, accounts, transactions, budgets,
  goals, recurring bills, AI expense forecasting, anomaly detection and
  recommendations. See `app/README.md` to run it.
- `data/` — generated module- and sprint-level metrics (`generate_data.py`)
- `analysis/` — correlation, decision tree, box plot, control chart (`analyze.py`),
  and a from-scratch Bayesian network for risk/defect prediction (`bayesian_network.py`)
- `charts/` — PNG output of the analysis
- `dashboard/` — self-contained interactive dashboard (`index.html`, built by
  `build_dashboard.py` from `template.html` + the analysis JSON + charts)
- `report/` — Word report extending the Review 0 write-up with Modules 3 & 4

## Running the finance app

```bash
cd app/server
npm install
node index.js
```

Then open http://localhost:4000, sign up, and use the app.

## Reproducing the metrics analysis

```bash
python analysis/generate_data.py
python analysis/analyze.py
python analysis/bayesian_network.py
python dashboard/build_dashboard.py
```

Then open `dashboard/index.html` in a browser, or serve it:

```bash
python -m http.server 8731 --directory dashboard
```
