"""Discovery bundle builder (guide section 8). Emits JSON-LD, llms.txt,
capability page. Usage: python3 runtime/discovery_build.py --manifest
capability.yaml --out public/
"""
from __future__ import annotations

import argparse
import html
import json
from pathlib import Path

import yaml


def jsonld(m: dict) -> dict:
    tools = [t for t in (m.get("tools", []) or []) if t.get("model_visible", True)]
    return {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": m.get("title"),
        "applicationCategory": "MCPApp",
        "url": m.get("ui_domain"),
        "operatingSystem": "ChatGPT, Claude, Web",
        "offers": {"@type": "Offer", "availability": "https://schema.org/OnlineOnly"},
        "additionalProperty": [
            {"@type": "PropertyValue", "name": "mcp_endpoint", "value": m.get("endpoint")},
            {"@type": "PropertyValue", "name": "capability_id", "value": m.get("id")},
        ],
        "featureList": [t.get("name") for t in tools],
    }


def llms_txt(m: dict) -> str:
    lines = [f"# {m.get('title')}", "", str(m.get("domain", "agent-commerce")), "",
             f"MCP endpoint: {m.get('endpoint')}", ""]
    for t in (m.get("tools", []) or []):
        if t.get("model_visible", True):
            lines.append(f"- {t.get('name')}: {t.get('description', '')[:140]}")
    return "\n".join(lines) + "\n"


def capability_page(m: dict) -> str:
    tools = "\n".join(
        f"<li><b>{html.escape(str(t.get('name')))}</b> — {html.escape(str(t.get('description', '')[:200]))}</li>"
        for t in (m.get("tools", []) or []) if t.get("model_visible", True))
    doc = {"@context": "https://schema.org", "@type": "SoftwareApplication",
           "name": m.get("title"), "url": m.get("ui_domain")}
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>{html.escape(str(m.get('title')))}</title>
<script type="application/ld+json">{json.dumps(jsonld(m))}</script></head>
<body><h1>{html.escape(str(m.get('title')))}</h1>
<p>MCP endpoint: <code>{html.escape(str(m.get('endpoint')))}</code></p>
<ul>{tools}</ul>
<script type="application/ld+json">{json.dumps(doc)}</script></body></html>
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out", default="public")
    args = ap.parse_args()
    m = yaml.safe_load(Path(args.manifest).read_text(encoding="utf-8"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "mcp-app.jsonld").write_text(json.dumps(jsonld(m), indent=2), encoding="utf-8")
    (out / "llms.txt").write_text(llms_txt(m), encoding="utf-8")
    (out / "capability.html").write_text(capability_page(m), encoding="utf-8")
    print(f"wrote {out}/mcp-app.jsonld {out}/llms.txt {out}/capability.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
