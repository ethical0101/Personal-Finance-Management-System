"""
Software Metrics-Driven AI-Powered Personal Finance Management System
Module 3 - Data Collection

Generates realistic (synthetic but internally-consistent) software-metrics
data for the system's modules and sprints, covering:
  - Errors, Faults/Bugs, Failures, Features, Delays (per module) -- see the
    Error -> Fault -> Failure chain documented in report/README
  - Structural/complexity metrics (feeds correlation + decision tree)
  - Weekly quality indicators (feeds control chart / trend analysis)

Data is generated with real statistical relationships baked in (complexity
and low coverage genuinely drive defects) so the downstream analysis in
analyze.py finds real, explainable correlations rather than noise.
"""
import numpy as np
import pandas as pd
from pathlib import Path

RNG = np.random.default_rng(42)
OUT = Path(__file__).resolve().parent.parent / "data"
OUT.mkdir(exist_ok=True)

MODULES = [
    "Transaction Engine", "AI Recommendation Engine", "Anomaly Detection Model",
    "Expense Prediction Model", "Finance Dashboard", "Budget Manager",
    "Authentication Service", "Encryption/KMS Layer", "Notification Service",
    "Report Generator", "Account Management", "Recurring Bill Scheduler",
]

n = len(MODULES)

# --- Structural metrics -------------------------------------------------
loc = RNG.integers(800, 6500, n)
cyclomatic_complexity = np.round(RNG.normal(12, 5, n).clip(3, 30), 1)
coupling_cbo = RNG.integers(2, 22, n)
cohesion_lcom = np.round(RNG.uniform(0.05, 0.85, n), 2)
test_coverage_pct = np.round(RNG.uniform(45, 96, n), 1)

# --- Faults / Errors / Features / Delays --------------------------------
# Underlying "true" risk score drives defect/fault/error/delay generation
risk_score = (
    0.55 * (cyclomatic_complexity / 30)
    + 0.20 * (coupling_cbo / 22)
    + 0.20 * (1 - test_coverage_pct / 100)
    + 0.05 * (cohesion_lcom)
)
risk_score = (risk_score - risk_score.min()) / (risk_score.max() - risk_score.min())

errors_logged = RNG.poisson(3 + 14 * risk_score)          # human mistakes (root cause)
fault_count = np.round(errors_logged * RNG.uniform(0.55, 0.85, n)).astype(int)  # faults injected into code

# Defect density is generated directly as a function of risk_score (low noise) so
# that the structural metrics (complexity, coupling, coverage) that make up risk_score
# carry a real, demonstrable correlation to defect density -- defect_count is then
# derived from density * size so both figures stay mutually consistent.
defect_density_per_kloc = np.round((1.0 + 9.0 * risk_score + RNG.normal(0, 0.35, n)).clip(0.2, None), 2)
defect_count = np.round(defect_density_per_kloc * (loc / 1000)).astype(int)
defect_count = np.minimum(defect_count, fault_count.clip(min=1) * 2)  # keep defects <= plausible bound

feature_count = RNG.integers(4, 18, n)                     # delivered features per module
delay_days = np.round(RNG.normal(1 + 3 * (coupling_cbo / 22) + 8 * risk_score, 1.0, n).clip(0, None), 1)    # schedule slip
severity_avg = np.round(1 + 3 * risk_score + RNG.normal(0, 0.3, n), 2).clip(1, 5)

# Failure = the subset of defects that actually manifested as an observable
# incorrect behaviour in production (as distinct from a Fault/Bug, which is
# the incorrect code artifact itself, whether or not it was ever triggered).
# Drawn from an independent RNG stream so this addition can't perturb the
# shared RNG's draw sequence for anything generated below (sprint_metrics).
FAILURE_RNG = np.random.default_rng(43)
failures_observed = np.round(defect_count * FAILURE_RNG.uniform(0.35, 0.65, n)).astype(int)

df_modules = pd.DataFrame({
    "module": MODULES,
    "loc": loc,
    "cyclomatic_complexity": cyclomatic_complexity,
    "coupling_cbo": coupling_cbo,
    "cohesion_lcom": cohesion_lcom,
    "test_coverage_pct": test_coverage_pct,
    "features_delivered": feature_count,
    "errors_logged": errors_logged,
    "fault_count": fault_count,
    "defect_count": defect_count,
    "failures_observed": failures_observed,
    "delay_days": delay_days,
    "avg_severity_1to5": severity_avg,
})
df_modules["defect_density_per_kloc"] = defect_density_per_kloc
df_modules.to_csv(OUT / "module_metrics.csv", index=False)

# --- Weekly / sprint quality indicators (for control chart & trend) -----
weeks = 16
week_id = np.arange(1, weeks + 1)
base_failure_rate = 3.2
# inject a genuine process shift after week 10 (simulating a bad release) then a recovery
shift = np.where(week_id <= 10, 0, np.where(week_id <= 13, 3.0, -1.0))
transaction_failure_rate_pct = np.round(
    (base_failure_rate + shift + RNG.normal(0, 0.6, weeks)).clip(0.1, None), 2
)
mape_expense_model = np.round((9.5 - 0.15 * week_id + RNG.normal(0, 0.8, weeks)).clip(3, None), 2)
recommendation_acceptance_pct = np.round((55 + 0.9 * week_id + RNG.normal(0, 3, weeks)).clip(0, 100), 1)
sprint_defects_found = RNG.poisson(14 - 0.3 * week_id).clip(1, None)

df_sprints = pd.DataFrame({
    "week": week_id,
    "transaction_failure_rate_pct": transaction_failure_rate_pct,
    "mape_expense_model_pct": mape_expense_model,
    "recommendation_acceptance_pct": recommendation_acceptance_pct,
    "defects_found": sprint_defects_found,
})
df_sprints.to_csv(OUT / "sprint_metrics.csv", index=False)

print("module_metrics.csv:", df_modules.shape)
print("sprint_metrics.csv:", df_sprints.shape)
print(df_modules.head(3).to_string())
