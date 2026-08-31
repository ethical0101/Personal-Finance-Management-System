# Software Metrics-Driven AI-Powered Personal Finance Management System

Review 1 deliverable — implements **Module 3 (Software Metrics Data Collection)**
and **Module 4 (Metrics for Decision Support)** on top of the Review 0 GQ(I)M
report.

## Layout

- `data/` — generated module- and sprint-level metrics (`generate_data.py`)
- `analysis/` — correlation, decision tree, box plot, control chart (`analyze.py`),
  and a from-scratch Bayesian network for risk/defect prediction (`bayesian_network.py`)
- `charts/` — PNG output of the analysis
- `dashboard/` — self-contained interactive dashboard (`index.html`, built by
  `build_dashboard.py` from `template.html` + the analysis JSON + charts)
- `report/` — Word report extending the Review 0 write-up with Modules 3 & 4

## Reproducing the analysis

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
