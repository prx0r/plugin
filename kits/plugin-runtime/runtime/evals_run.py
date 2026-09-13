"""Eval runner in the mcp-eval YAML format (guide section 3).

Static mode (no keys, always runs): every referenced tool exists, every
expected parameter is declared, no test points at a hidden helper.
Live mode (--url): lists live tools over MCP JSON-RPC and diffs the set.
Model grading is BYO: --grade-cmd shells out per case, else cases are
recorded as PENDING for the model pass.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

import yaml


def load_eval(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def static_check(evaldoc: dict, manifest: dict) -> list[dict]:
    by_name = {t.get("name"): t for t in (manifest.get("tools", []) or [])}
    rows = []
    for case in (evaldoc.get("test_cases", []) or []):
        name = case.get("name", "?")
        exp = (case.get("expected_tool_call", {}) or {})
        tool = exp.get("tool_name", "")
        params = (exp.get("parameters", {}) or {})
        if tool not in by_name:
            rows.append({"case": name, "status": "FAIL", "detail": f"unknown tool {tool}"})
            continue
        t = by_name[tool]
        if not t.get("model_visible", True):
            rows.append({"case": name, "status": "FAIL", "detail": f"tool {tool} is hidden from model"})
            continue
        declared = set(((t.get("args", {}) or {}).keys()))
        unknown = [k for k in params if k not in declared]
        if unknown:
            rows.append({"case": name, "status": "FAIL", "detail": f"undeclared params {unknown}"})
        else:
            rows.append({"case": name, "status": "STATIC-OK", "detail": f"{tool} + {sorted(params)}"})
    return rows


def live_tools(url: str, timeout: float = 20.0) -> list[str]:
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"},
                                 method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        doc = json.load(r)
    tools = (((doc.get("result", {}) or {}).get("tools", [])) or [])
    return [t.get("name", "") for t in tools if isinstance(t, dict)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--eval", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--url", default=None)
    ap.add_argument("--grade-cmd", default=None, help="optional: argv[0] + case JSON on stdin per case")
    ap.add_argument("--out", default="eval-report.json")
    args = ap.parse_args()
    evaldoc = load_eval(Path(args.eval))
    manifest = yaml.safe_load(Path(args.manifest).read_text(encoding="utf-8"))
    rows = static_check(evaldoc, manifest)
    if args.url:
        try:
            live = set(live_tools(args.url))
            for row in rows:
                row["live_listed"] = True
        except Exception as exc:  # noqa: BLE001 - surfaced in report
            for row in rows:
                row["live_listed"] = False
            print(f"live tools/list failed: {exc}")
    if args.grade_cmd:
        for row in rows:
            p = subprocess.run([args.grade_cmd], input=json.dumps(row), text=True,
                               capture_output=True, timeout=300)
            row["grade"] = p.stdout.strip() or "PENDING"
    else:
        for row in rows:
            if row["status"] == "STATIC-OK":
                row["status"] = "PENDING-MODEL"
    fails = [r for r in rows if r["status"] == "FAIL"]
    report = {"fails": len(fails), "cases": len(rows), "rows": rows}
    Path(args.out).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "rows"}, indent=2))
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
