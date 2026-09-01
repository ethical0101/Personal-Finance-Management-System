# Software Metrics-Driven AI-Powered Personal Finance Management System

Full-stack personal finance app (`app/`) plus the Module 3/4 metrics
program (`data/`, `analysis/`, `charts/`, `dashboard/`, `report/`) that
measures it. `report/Project_Report_Modules_3-4.docx` is the write-up:
data collection and fault/failure/error/bug identification, classical
analysis techniques including three correlation methods (Module 3),
Bayesian risk/defect networks (Module 4), and real screenshots of the
working app. (Modules 1-2 — the ten scopes and the GQ(I)M plan — were
covered in the separate Review 0 report.)

## Layout

- `app/` — the working product: React 19 + Vite frontend (`app/web`), Express
  API (`app/server`). Signup/login, accounts, transactions, budgets, goals,
  recurring bills, AI expense forecasting, anomaly detection, Gemini-powered
  recommendations, and the Metrics Command Deck embedded as an in-app tab.
  See `app/README.md` to run it.
- `data/` — generated module- and sprint-level metrics (`generate_data.py`)
- `analysis/` — correlation, decision tree, box plot, control chart (`analyze.py`),
  and a from-scratch Bayesian network for risk/defect prediction (`bayesian_network.py`)
- `charts/` — PNG output of the analysis
- `dashboard/` — self-contained interactive dashboard (`index.html`, built by
  `build_dashboard.py` from `template.html` + the analysis JSON + charts)
- `report/` — `Project_Report_Modules_3-4.docx` (built by
  `build_module34_report.js`) plus `screenshots/` used in it

## Running the finance app

```bash
cd app/web && npm install && npm run build   # builds the React app
cd ../server && npm install && node index.js # serves it + the API on :4000
```

Then open http://localhost:4000, sign up, and use the app. See `app/README.md`
for the dev-mode (hot reload) setup and the Gemini API key.

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
