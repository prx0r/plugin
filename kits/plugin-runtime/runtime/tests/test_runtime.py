"""Runtime tests: preflight gates, eval static checks, telemetry contract,
host adapters, discovery bundle. Run: /tmp/goblin-env/bin/python -m pytest
output/plugin-runtime/runtime/tests/ -q  (stdlib + pyyaml only).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from runtime import discovery_build, evals_run, hosts, preflight, telemetry

FIX = Path(__file__).resolve().parent.parent


def manifest() -> dict:
    return yaml.safe_load((FIX / "capability.example.yaml").read_text(encoding="utf-8"))


def test_preflight_example_passes():
    report = preflight.run(manifest())
    assert report["gate"] == "GO", json.dumps([r for r in report["results"] if r["status"] == "FAIL"], indent=2)


def test_preflight_catches_dev_endpoint_and_leak():
    m = manifest()
    m["endpoint"] = "http://localhost:3000/mcp"
    m["tools"].append({"name": "fetch_thumbnail", "description": "helper that leaked into model view " + "x " * 20,
                       "args": {}, "model_visible": True})
    report = preflight.run(m)
    assert report["gate"] == "NO-GO"
    failed = {r["check"] for r in report["results"] if r["status"] == "FAIL"}
    assert "meta.endpoint_https" in failed
    assert "hygiene.no_helper_leak" in failed


def test_preflight_catches_marketing_and_missing_docs():
    m = manifest()
    m["tools"][0]["description"] = "revolutionary seamless ultimate tool x " * 10
    m["tools"][1]["args"] = {"idea": {"type": "string"}}
    report = preflight.run(m)
    failed = {r["check"] for r in report["results"] if r["status"] == "FAIL"}
    assert "desc.check_domain.no_marketing" in failed
    assert "schema.suggest_names.args_documented" in failed


def test_evals_static_ok_and_unknown_tool_fails(tmp_path):
    m = manifest()
    ev = yaml.safe_load((FIX / "evals" / "example.yml").read_text(encoding="utf-8"))
    rows = evals_run.static_check(ev, m)
    assert all(r["status"] == "STATIC-OK" for r in rows), rows
    bad = {"test_cases": [{"name": "ghost", "expected_tool_call": {"tool_name": "nope", "parameters": {}}}]}
    rows = evals_run.static_check(bad, m)
    assert rows[0]["status"] == "FAIL"
    hidden = {"test_cases": [{"name": "leak", "expected_tool_call": {"tool_name": "hydrate_card", "parameters": {}}}]}
    rows = evals_run.static_check(hidden, m)
    assert rows[0]["status"] == "FAIL"


def test_telemetry_contract_and_failures():
    r = telemetry.Receiver()
    ok = r.ingest({"event": "connected", "context": {"host": "chatgpt", "theme": "dark", "client": "c"}})
    assert ok["ok"] and ok["n"] == 1
    bad = r.ingest({"event": "connected", "context": {"host": "chatgpt"}})
    assert not bad["ok"]
    unknown = r.ingest({"event": "teleport", "context": {"host": "x", "theme": "y", "client": "z"}})
    assert not unknown["ok"]
    r.ingest({"session_id": ok["session_id"], "event": "widget_error",
              "context": {"host": "chatgpt", "theme": "dark", "client": "c"},
              "data": {"msg": "CSP blocked"}})
    assert len(r.failures(ok["session_id"])) == 1
    assert "record_signal" in telemetry.render_snippet("https://t.example/s")


def test_hosts_split_model_and_app_surface():
    m = manifest()
    cg = hosts.chatgpt(m)
    assert cg["_meta"]["ui"]["domain"] == m["ui_domain"]
    assert "https://checkout.agentcom.example" in cg["redirect_domains"]
    hidden = [t for t in cg["tool_defs"] if t["name"] == "hydrate_card"][0]
    assert hidden.get("ui_visibility") == ["app"]
    cl = hosts.claude(m)
    assert all(t["name"] != "hydrate_card" for t in cl["tool_defs"])
    g = hosts.generic(m)
    assert {t["name"] for t in g["tools"]} == {"check_domain", "suggest_names"}


def test_discovery_bundle(tmp_path):
    m = manifest()
    (tmp_path / "x.jsonld").write_text(json.dumps(discovery_build.jsonld(m)))
    (tmp_path / "llms.txt").write_text(discovery_build.llms_txt(m))
    page = discovery_build.capability_page(m)
    assert "application/ld+json" in page and "check_domain" in page
