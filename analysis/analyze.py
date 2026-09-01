"""
Module 3 - Software Metrics Data Collection
Classical Data Analysis Techniques: Decision Tree, Box Plot, Control Chart,
Correlation (Pearson, Spearman, Kendall) and Statistical Test.

Reads data/module_metrics.csv and data/sprint_metrics.csv, runs each
technique, saves chart PNGs to charts/, and writes a single results.json
consumed by the dashboard.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy import stats
from sklearn.tree import DecisionTreeClassifier, plot_tree
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CHARTS = ROOT / "charts"
CHARTS.mkdir(exist_ok=True)

plt.rcParams.update({
    "figure.facecolor": "white", "axes.facecolor": "white",
    "font.size": 11, "axes.titleweight": "bold",
})

mod = pd.read_csv(DATA / "module_metrics.csv")
spr = pd.read_csv(DATA / "sprint_metrics.csv")

results = {}

# ---------------------------------------------------------------------
# 1. CORRELATION + STATISTICAL TEST
# ---------------------------------------------------------------------
corr_cols = ["cyclomatic_complexity", "coupling_cbo", "cohesion_lcom",
             "test_coverage_pct", "defect_density_per_kloc", "delay_days"]


def draw_corr_matrix(method, filename, label):
    """Full 6x6 correlation matrix heatmap for one method (pearson/spearman/kendall)."""
    matrix = mod[corr_cols].corr(method=method).round(2)
    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(matrix.values, cmap="RdBu_r", vmin=-1, vmax=1)
    ax.set_xticks(range(len(corr_cols))); ax.set_xticklabels(corr_cols, rotation=45, ha="right")
    ax.set_yticks(range(len(corr_cols))); ax.set_yticklabels(corr_cols)
    for i in range(len(corr_cols)):
        for j in range(len(corr_cols)):
            ax.text(j, i, matrix.values[i, j], ha="center", va="center",
                    color="white" if abs(matrix.values[i, j]) > 0.5 else "black", fontsize=9)
    ax.set_title(f"Correlation Matrix ({label}) — Structural Metrics vs Defects/Delay")
    fig.colorbar(im, ax=ax, shrink=0.8, label=f"{label} coefficient")
    fig.tight_layout()
    fig.savefig(CHARTS / filename, dpi=150)
    plt.close(fig)
    return matrix


corr_matrix = draw_corr_matrix("pearson", "correlation_heatmap.png", "Pearson")
corr_matrix_spearman = draw_corr_matrix("spearman", "correlation_heatmap_spearman.png", "Spearman")
corr_matrix_kendall = draw_corr_matrix("kendall", "correlation_heatmap_kendall.png", "Kendall")

# ---------------------------------------------------------------------
# Correlation -- three types, each run on the same three variable pairs:
#   Pearson  (linear relationship, assumes roughly-normal, interval data)
#   Spearman (monotonic relationship on ranks, robust to outliers/non-linearity)
#   Kendall  (concordance of pairwise rank ordering, most robust on small n)
# Running all three on a 12-row dataset is itself the right practice: a
# single-method correlation on this little data can be misleading, so the
# three are reported side by side rather than picking one.
# ---------------------------------------------------------------------
PAIRS = [
    ("Cyclomatic Complexity vs Defect Density", mod.cyclomatic_complexity, mod.defect_density_per_kloc, "pos"),
    ("Test Coverage vs Defect Density", mod.test_coverage_pct, mod.defect_density_per_kloc, "neg"),
    ("Coupling (CBO) vs Delay (days)", mod.coupling_cbo, mod.delay_days, "pos"),
]

corr_tests = []
for name, x, y, direction in PAIRS:
    r_p, p_p = stats.pearsonr(x, y)
    r_s, p_s = stats.spearmanr(x, y)
    r_k, p_k = stats.kendalltau(x, y)
    any_sig = (p_p < 0.05) or (p_s < 0.05) or (p_k < 0.05)
    strong = abs(r_p) > 0.5 and abs(r_s) > 0.5
    if direction == "pos":
        interp = "All three methods agree on a positive relationship." if (r_p > 0 and r_s > 0 and r_k > 0) else "Methods disagree on direction — treat as inconclusive on this sample size."
    else:
        interp = "All three methods agree on a negative relationship." if (r_p < 0 and r_s < 0 and r_k < 0) else "Methods disagree on direction — treat as inconclusive on this sample size."
    corr_tests.append({
        "pair": name,
        "pearson": {"r": round(float(r_p), 3), "p_value": round(float(p_p), 4)},
        "spearman": {"rho": round(float(r_s), 3), "p_value": round(float(p_s), 4)},
        "kendall": {"tau": round(float(r_k), 3), "p_value": round(float(p_k), 4)},
        "significant": bool(any_sig),
        "interpretation": interp,
    })

# Grouped bar chart comparing the three correlation coefficients per pair
fig, ax = plt.subplots(figsize=(8, 5))
x_pos = np.arange(len(corr_tests))
width = 0.25
pearson_vals = [t["pearson"]["r"] for t in corr_tests]
spearman_vals = [t["spearman"]["rho"] for t in corr_tests]
kendall_vals = [t["kendall"]["tau"] for t in corr_tests]
ax.bar(x_pos - width, pearson_vals, width, label="Pearson r", color="#023047")
ax.bar(x_pos, spearman_vals, width, label="Spearman rho", color="#219ebc")
ax.bar(x_pos + width, kendall_vals, width, label="Kendall tau", color="#8ecae6")
ax.axhline(0, color="black", linewidth=0.8)
ax.set_xticks(x_pos)
ax.set_xticklabels([t["pair"].replace(" vs ", "\nvs\n") for t in corr_tests], fontsize=8)
ax.set_ylabel("Correlation coefficient")
ax.set_title("Correlation — Pearson vs Spearman vs Kendall")
ax.legend()
fig.tight_layout()
fig.savefig(CHARTS / "correlation_three_types.png", dpi=150)
plt.close(fig)

# Independent two-sample t-test: defect density in low-coverage vs high-coverage modules
median_cov = mod.test_coverage_pct.median()
low_cov = mod.loc[mod.test_coverage_pct <= median_cov, "defect_density_per_kloc"]
high_cov = mod.loc[mod.test_coverage_pct > median_cov, "defect_density_per_kloc"]
t_stat, t_p = stats.ttest_ind(low_cov, high_cov, equal_var=False)

results["correlation"] = {
    "matrix": corr_matrix.to_dict(),
    "matrix_spearman": corr_matrix_spearman.to_dict(),
    "matrix_kendall": corr_matrix_kendall.to_dict(),
    "tests": corr_tests,
    "t_test_low_vs_high_coverage": {
        "t_stat": round(float(t_stat), 3), "p_value": round(float(t_p), 4),
        "low_coverage_mean_defect_density": round(float(low_cov.mean()), 2),
        "high_coverage_mean_defect_density": round(float(high_cov.mean()), 2),
        "significant": bool(t_p < 0.05),
    },
}

# ---------------------------------------------------------------------
# 2. DECISION TREE — predict defect-prone module (High/Low risk)
# ---------------------------------------------------------------------
mod["risk_label"] = np.where(
    mod.defect_density_per_kloc > mod.defect_density_per_kloc.median(), "High", "Low"
)
features = ["cyclomatic_complexity", "coupling_cbo", "cohesion_lcom", "test_coverage_pct"]
X = mod[features]
y = mod["risk_label"]

clf = DecisionTreeClassifier(max_depth=3, min_samples_leaf=2, random_state=42)
clf.fit(X, y)  # small dataset (12 modules) -> fit on full set, this is illustrative/explanatory, not predictive-at-scale
pred = clf.predict(X)

fig, ax = plt.subplots(figsize=(13, 7))
plot_tree(clf, feature_names=features, class_names=clf.classes_, filled=True,
          rounded=True, fontsize=10, ax=ax)
ax.set_title("Decision Tree — Defect-Proneness Classification (module_metrics.csv)")
fig.tight_layout()
fig.savefig(CHARTS / "decision_tree.png", dpi=150)
plt.close(fig)

importances = dict(zip(features, np.round(clf.feature_importances_, 3)))
results["decision_tree"] = {
    "features": features,
    "target": "risk_label (High/Low defect density, split at median)",
    "accuracy_on_training_data": round(float(accuracy_score(y, pred)), 3),
    "feature_importances": importances,
    "rules_summary": [
        "Root split is on the metric with the highest information gain (see chart) — "
        "typically Cyclomatic Complexity or Test Coverage dominate.",
        "Modules with high complexity AND low test coverage are classified High risk.",
        "This mirrors ISO/IEC 25010 Maintainability and ties directly into Sub-Goal 4 "
        "(defect density) from the Review-0 GQ(I)M plan.",
    ],
}

# ---------------------------------------------------------------------
# 3. BOX PLOT — defect & delay distribution
# ---------------------------------------------------------------------
fig, axes = plt.subplots(1, 2, figsize=(11, 5))
axes[0].boxplot(mod.defect_density_per_kloc, vert=True, patch_artist=True,
                 boxprops=dict(facecolor="#8ecae6"))
axes[0].set_title("Defect Density (per KLOC)")
axes[0].set_ylabel("Defects / KLOC")
axes[1].boxplot(mod.delay_days, vert=True, patch_artist=True,
                 boxprops=dict(facecolor="#ffb703"))
axes[1].set_title("Schedule Delay (days)")
axes[1].set_ylabel("Delay (days)")
fig.suptitle("Box Plot — Spread & Outliers Across 12 Modules", fontweight="bold")
fig.tight_layout()
fig.savefig(CHARTS / "box_plot.png", dpi=150)
plt.close(fig)


def iqr_outliers(series):
    q1, q3 = series.quantile([0.25, 0.75])
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    return mod.loc[(series < lo) | (series > hi), "module"].tolist(), round(float(lo), 2), round(float(hi), 2)


dd_outliers, dd_lo, dd_hi = iqr_outliers(mod.defect_density_per_kloc)
delay_outliers, delay_lo, delay_hi = iqr_outliers(mod.delay_days)
results["box_plot"] = {
    "defect_density": {"q1": round(float(mod.defect_density_per_kloc.quantile(0.25)), 2),
                        "median": round(float(mod.defect_density_per_kloc.median()), 2),
                        "q3": round(float(mod.defect_density_per_kloc.quantile(0.75)), 2),
                        "iqr_fence": [dd_lo, dd_hi], "outlier_modules": dd_outliers},
    "delay_days": {"q1": round(float(mod.delay_days.quantile(0.25)), 2),
                    "median": round(float(mod.delay_days.median()), 2),
                    "q3": round(float(mod.delay_days.quantile(0.75)), 2),
                    "iqr_fence": [delay_lo, delay_hi], "outlier_modules": delay_outliers},
}

# ---------------------------------------------------------------------
# 4. CONTROL CHART — Individuals & Moving Range (I-MR) on weekly
#    transaction failure rate, detects the injected process shift
# ---------------------------------------------------------------------
x = spr.transaction_failure_rate_pct.values
mr = np.abs(np.diff(x))
xbar = x.mean()
mr_bar = mr.mean()
UCL_I = xbar + 2.66 * mr_bar
LCL_I = max(xbar - 2.66 * mr_bar, 0)
UCL_MR = 3.267 * mr_bar

fig, axes = plt.subplots(2, 1, figsize=(11, 7), sharex=True)
axes[0].plot(spr.week, x, marker="o", color="#023047")
axes[0].axhline(xbar, color="green", linestyle="--", label=f"CL={xbar:.2f}")
axes[0].axhline(UCL_I, color="red", linestyle="--", label=f"UCL={UCL_I:.2f}")
axes[0].axhline(LCL_I, color="red", linestyle="--", label=f"LCL={LCL_I:.2f}")
out_of_control = spr.week[(x > UCL_I) | (x < LCL_I)].tolist()
for wk in out_of_control:
    axes[0].scatter([wk], [x[spr.week.tolist().index(wk)]], color="red", zorder=5, s=80)
axes[0].set_title("I-Chart — Weekly Transaction Failure Rate (%)")
axes[0].set_ylabel("Failure rate (%)")
axes[0].legend(fontsize=8, loc="upper left")

axes[1].plot(spr.week[1:], mr, marker="o", color="#6a4c93")
axes[1].axhline(mr_bar, color="green", linestyle="--", label=f"CL={mr_bar:.2f}")
axes[1].axhline(UCL_MR, color="red", linestyle="--", label=f"UCL={UCL_MR:.2f}")
axes[1].set_title("MR-Chart — Moving Range")
axes[1].set_xlabel("Sprint week")
axes[1].set_ylabel("Moving range")
axes[1].legend(fontsize=8, loc="upper left")
fig.tight_layout()
fig.savefig(CHARTS / "control_chart.png", dpi=150)
plt.close(fig)

results["control_chart"] = {
    "metric": "transaction_failure_rate_pct (weekly)",
    "center_line": round(float(xbar), 3),
    "UCL": round(float(UCL_I), 3),
    "LCL": round(float(LCL_I), 3),
    "out_of_control_weeks": out_of_control,
    "interpretation": (
        f"Week(s) {out_of_control} breach the Upper Control Limit — this corresponds to the "
        "release regression injected around week 11-13 in the simulated data, demonstrating how "
        "an I-MR control chart flags an assignable-cause process shift in production transaction "
        "reliability (Sub-Goal 4 — Functional Correctness) in real time." if out_of_control else
        "No points breach the control limits — process is in statistical control."
    ),
}

# ---------------------------------------------------------------------
# Save datasets summary + write results.json
# ---------------------------------------------------------------------
results["dataset_summary"] = {
    "modules": mod.to_dict(orient="records"),
    "sprints": spr.to_dict(orient="records"),
    "totals": {
        "total_features_delivered": int(mod.features_delivered.sum()),
        "total_errors_logged": int(mod.errors_logged.sum()),
        "total_faults": int(mod.fault_count.sum()),
        "total_defects": int(mod.defect_count.sum()),
        "total_failures": int(mod.failures_observed.sum()),
        "avg_delay_days": round(float(mod.delay_days.mean()), 2),
        "max_delay_module": mod.loc[mod.delay_days.idxmax(), "module"],
    },
}

with open(ROOT / "analysis" / "results.json", "w") as f:
    json.dump(results, f, indent=2)

print("Analysis complete. Charts written to", CHARTS)
print(json.dumps(results["correlation"]["tests"], indent=2))
print(json.dumps(results["control_chart"], indent=2))
