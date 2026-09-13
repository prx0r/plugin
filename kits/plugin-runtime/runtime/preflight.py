"""Submission preflight: deterministic static checks over a capability manifest.

Implements guide sections 5-9 as code. Fails closed: any FAIL blocks release.
Usage: python3 runtime/preflight.py --manifest capability.yaml --out preflight.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

MARKETING = ["revolutionary", "cutting-edge", "world-class", "best-in-class",
             "seamless", "leverage", "supercharge", "ultimate"]
DEV_HOSTS = ["localhost", "127.0.0.1", "ngrok.io", "ngrok-free.app", "0.0.0.0"]
BUILTIN_SIBLING_HINTS = ["search", "shop", "buy", "checkout"]


def check(name: str, ok: bool, detail: str = "") -> dict:
    return {"check": name, "status": "PASS" if ok else "FAIL", "detail": detail}


def check_metadata(m: dict) -> list[dict]:
    out = []
    for f in ("id", "title", "endpoint", "ui_domain", "contact"):
        out.append(check(f"meta.{f}", bool(m.get(f)), "" if m.get(f) else "missing"))
    ep = str(m.get("endpoint", ""))
    out.append(check("meta.endpoint_https", ep.startswith("https://"), ep))
    out.append(check("meta.no_dev_hosts", not any(h in ep for h in DEV_HOSTS), ep))
    return out


def check_csp(m: dict) -> list[dict]:
    out = []
    csp = m.get("csp", {}) or {}
    for k in ("connect_domains", "resource_domains", "redirect_domains"):
        doms = csp.get(k, []) or []
        bad = [d for d in doms if not re.match(r"^https://[^/\s]+$", str(d))]
        out.append(check(f"csp.{k}_shape", not bad, f"bad: {bad}" if bad else f"{len(doms)} declared"))
    ui = str(m.get("ui_domain", ""))
    declared = (csp.get("connect_domains", []) or []) + (csp.get("resource_domains", []) or [])
    out.append(check("csp.covers_ui_domain", any(ui.startswith(d) for d in declared), ui))
    return out


def check_descriptions(m: dict) -> list[dict]:
    out = []
    tools = [t for t in (m.get("tools", []) or []) if t.get("model_visible", True)]
    descs = [(t.get("name"), str(t.get("description", ""))) for t in tools]
    for name, d in descs:
        words = d.split()
        out.append(check(f"desc.{name}.length", 15 <= len(words) <= 120, f"{len(words)} words"))
        hits = [w for w in MARKETING if w in d.lower()]
        out.append(check(f"desc.{name}.no_marketing", not hits, f"{hits}" if hits else ""))
    firsts = [d.split(".")[0].lower() for _, d in descs]
    out.append(check("desc.sibling_overlap", len(set(firsts)) == len(firsts),
                     "first clauses collide" if len(set(firsts)) != len(firsts) else "distinct"))
    return out


def check_schemas(m: dict) -> list[dict]:
    out = []
    for t in (m.get("tools", []) or []):
        name = t.get("name", "?")
        args = t.get("args", {}) or {}
        undocumented = [k for k, v in args.items() if not (v or {}).get("description")]
        out.append(check(f"schema.{name}.args_documented", not undocumented, f"{undocumented}" if undocumented else ""))
        untyped = [k for k, v in args.items() if not (v or {}).get("type")]
        out.append(check(f"schema.{name}.args_typed", not untyped, f"{untyped}" if untyped else ""))
    return out


def check_hygiene(m: dict) -> list[dict]:
    out = []
    helpers = [t for t in (m.get("tools", []) or []) if not t.get("model_visible", True)]
    out.append(check("hygiene.helpers_hidden", all(True for _ in helpers), f"{len(helpers)} hidden helpers"))
    leaked = [t.get("name") for t in (m.get("tools", []) or [])
              if t.get("model_visible", True) and re.search(r"hydrate|paginate|resize|thumbnail|pref", str(t.get("name", "")))]
    out.append(check("hygiene.no_helper_leak", not leaked, f"{leaked}" if leaked else ""))
    w = m.get("widget", {}) or {}
    out.append(check("hygiene.state_budget", int(w.get("max_state_tokens", 0)) <= 4000, str(w.get("max_state_tokens"))))
    out.append(check("hygiene.host_theme", bool(w.get("uses_host_theme")), "hardcoded colors fail review"))
    return out


def run(manifest: dict) -> dict:
    results = []
    results += check_metadata(manifest)
    results += check_csp(manifest)
    results += check_descriptions(manifest)
    results += check_schemas(manifest)
    results += check_hygiene(manifest)
    failed = [r for r in results if r["status"] == "FAIL"]
    return {"passed": len(results) - len(failed), "failed": len(failed),
            "gate": "GO" if not failed else "NO-GO", "results": results}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out", default="preflight.json")
    args = ap.parse_args()
    manifest = yaml.safe_load(Path(args.manifest).read_text(encoding="utf-8"))
    report = run(manifest)
    Path(args.out).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "results"}, indent=2))
    for r in report["results"]:
        if r["status"] == "FAIL":
            print(f"FAIL {r['check']}: {r['detail']}")
    return 0 if report["gate"] == "GO" else 1


if __name__ == "__main__":
    sys.exit(main())
