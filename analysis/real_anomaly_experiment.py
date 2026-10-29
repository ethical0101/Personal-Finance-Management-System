"""
Real-data anomaly experiment.

Data: ULB / Worldline "Credit Card Fraud Detection" (OpenML dataset 1597, public licence),
284,807 real card transactions from two days in September 2013, 492 labelled frauds.
Citation: Dal Pozzolo, Caelen, Johnson, Bontempi, "Calibrating Probability with
Undersampling for Unbalanced Classification", IEEE CIDM 2015.

We cut a 15,000-transaction sample (all 492 frauds + 14,508 random normal rows,
seed 20261029) and compare three detectors on a held-out 30% test split:
  1. z-score on Amount, |z| >= 2.5  (the rule Wealthline uses today, no training)
  2. Isolation Forest on all 30 features (unsupervised)
  3. Gradient boosting on all 30 features (supervised, trained on the labels)

Usage:  python -I real_anomaly_experiment.py <creditcard.arff> <output dir>
"""
import sys, json
from pathlib import Path
import numpy as np, pandas as pd
from sklearn.ensemble import IsolationForest, HistGradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score, average_precision_score, confusion_matrix

SEED = 20261029
src, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)

lines = src.read_text().splitlines()
start = next(i for i, l in enumerate(lines) if l.strip().lower() == "@data") + 1
cols = [l.split()[1].strip("'") for l in lines if l.lower().startswith("@attribute")]
df = pd.read_csv(pd.io.common.StringIO("\n".join(lines[start:])), header=None, names=cols, quotechar="'")
df["Class"] = df["Class"].astype(int)
print("full set:", len(df), "rows, frauds:", int(df.Class.sum()))

fr = df[df.Class == 1]
normal = df[df.Class == 0].sample(15000 - len(fr), random_state=SEED)
sample = pd.concat([fr, normal]).sample(frac=1, random_state=SEED).reset_index(drop=True)
sample.to_csv(out / "creditcard_sample_15k.csv", index=False)

X, y = sample.drop(columns="Class"), sample["Class"]
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.3, stratify=y, random_state=SEED)

def report(name, pred, score):
    tn, fp, fn, tp = confusion_matrix(yte, pred).ravel()
    return {"method": name, "precision": round(precision_score(yte, pred, zero_division=0), 3),
            "recall": round(recall_score(yte, pred), 3), "f1": round(f1_score(yte, pred), 3),
            "roc_auc": round(roc_auc_score(yte, score), 3), "pr_auc": round(average_precision_score(yte, score), 3),
            "tp": int(tp), "fp": int(fp), "fn": int(fn), "tn": int(tn)}

res = []
# 1. current rule: z-score of Amount against the training (normal-looking) history
m, s = Xtr["Amount"].mean(), Xtr["Amount"].std() or 1
z = ((Xte["Amount"] - m) / s).abs()
res.append(report("z-score on Amount, |z| >= 2.5 (current rule)", (z >= 2.5).astype(int), z))

# 2. Isolation Forest, unsupervised: fitted on the training features only, labels never used
iso = IsolationForest(n_estimators=200, contamination=float(ytr.mean()), random_state=SEED).fit(Xtr)
iso_score = -iso.score_samples(Xte)
res.append(report("Isolation Forest (unsupervised)", (iso.predict(Xte) == -1).astype(int), iso_score))

# 3. supervised gradient boosting
gb = HistGradientBoostingClassifier(max_iter=200, learning_rate=0.1, random_state=SEED).fit(Xtr, ytr)
p = gb.predict_proba(Xte)[:, 1]
res.append(report("Gradient boosting (supervised, threshold 0.5)", (p >= 0.5).astype(int), p))

summary = {"dataset": "ULB credit card fraud (OpenML 1597)", "sample_size": len(sample), "frauds_in_sample": int(y.sum()),
           "fraud_rate_in_sample": round(float(y.mean()), 4), "train": len(Xtr), "test": len(Xte), "seed": SEED, "results": res}
(out / "real_anomaly_results.json").write_text(json.dumps(summary, indent=1))
print(pd.DataFrame(res).to_string(index=False))
