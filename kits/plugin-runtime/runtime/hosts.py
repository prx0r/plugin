"""Host adapters: one capability dict in, per-host metadata out (guide section 5)."""
from __future__ import annotations

import copy


def _base(manifest: dict) -> dict:
    return {
        "name": manifest.get("id"),
        "title": manifest.get("title"),
        "tools": [t.get("name") for t in (manifest.get("tools", []) or []) if t.get("model_visible", True)],
        "domain": manifest.get("ui_domain"),
    }


def chatgpt(manifest: dict) -> dict:
    """ChatGPT adapter: _meta.ui CSP, redirect domains, private helpers."""
    csp = manifest.get("csp", {}) or {}
    meta = {
        "openai": {
            "widgetCSP": {
                "connect_domains": csp.get("connect_domains", []),
                "resource_domains": csp.get("resource_domains", []),
            },
            "visibility": "public",
        },
        "ui": {
            "domain": manifest.get("ui_domain"),
            "csp": csp,
            "visibility": ["model", "app"],
        },
    }
    tools = []
    for t in (manifest.get("tools", []) or []):
        entry = {"name": t.get("name"), "description": t.get("description"), "args": t.get("args", {})}
        if not t.get("model_visible", True):
            entry["ui_visibility"] = ["app"]
            entry["read_only"] = True
        tools.append(entry)
    return {**_base(manifest), "_meta": meta, "tool_defs": tools,
            "redirect_domains": csp.get("redirect_domains", [])}


def claude(manifest: dict) -> dict:
    """Claude adapter: same capability, Claude-shaped envelope."""
    csp = manifest.get("csp", {}) or {}
    return {**_base(manifest), "extended": {"csp": csp},
            "tool_defs": [{"name": t.get("name"), "description": t.get("description"),
                           "input_schema": {"type": "object", "properties": t.get("args", {})}}
                          for t in (manifest.get("tools", []) or []) if t.get("model_visible", True)],
            "note": "app-only helpers omitted from model surface"}


def generic(manifest: dict) -> dict:
    """Lowest-common-denominator MCP surface: no host extensions."""
    return {**_base(manifest),
            "tools": [{"name": t.get("name"), "description": t.get("description")}
                      for t in (manifest.get("tools", []) or []) if t.get("model_visible", True)]}


def compile_all(manifest: dict) -> dict:
    return {"chatgpt": chatgpt(copy.deepcopy(manifest)),
            "claude": claude(copy.deepcopy(manifest)),
            "generic": generic(copy.deepcopy(manifest))}
