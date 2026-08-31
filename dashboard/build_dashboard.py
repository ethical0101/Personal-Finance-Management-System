"""
Assembles dashboard/index.html from dashboard/template.html by injecting:
  - analysis/results.json  (Module 3 outputs)
  - analysis/bn_results.json (Module 4 Bayesian network outputs)
  - the four chart PNGs (base64 data URIs, self-contained -- no external files)
"""
import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHARTS = ROOT / "charts"
ANALYSIS = ROOT / "analysis"
DASH = ROOT / "dashboard"


def b64_png(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


results = json.loads((ANALYSIS / "results.json").read_text())
bn = json.loads((ANALYSIS / "bn_results.json").read_text())

data_blob = {
    "results": results,
    "bn": bn,
    "images": {
        "correlation": b64_png(CHARTS / "correlation_heatmap.png"),
        "tree": b64_png(CHARTS / "decision_tree.png"),
        "box": b64_png(CHARTS / "box_plot.png"),
        "control": b64_png(CHARTS / "control_chart.png"),
    },
}

template = (DASH / "template.html").read_text(encoding="utf-8")
out = template.replace("__DATA_JSON__", json.dumps(data_blob))
(DASH / "index.html").write_text(out, encoding="utf-8")

size_mb = len(out.encode("utf-8")) / (1024 * 1024)
print(f"Wrote dashboard/index.html ({size_mb:.2f} MB)")
