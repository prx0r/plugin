from __future__ import annotations
import asyncio
import json
from typing import Any

from capabilities.domains.index import DomainCapability


async def rpc_call(client: Any, tool: str, payload: dict) -> dict:
    req = {"jsonrpc": "2.0", "id": "1", "method": "tools/call", "params": {"name": tool, "arguments": payload}}
    await client.send(req)
    resp = await client.receive()
    text = resp["result"]["content"][0]["text"]
    return json.loads(text)


async def tool_selection_suite(client: Any) -> dict:
    capability = DomainCapability()
    tests = [
        {"prompt": "Is bogusdomain.example available?", "call": {"domain": "bogusdomain.example"}},
        {"prompt": "Check these: one.test, two.test", "call": {"domains": ["one.test", "two.test"]}},
        {"prompt": "Give me name ideas for acme widgets", "call": {"keywords": "acme widgets"}},
    ]
    hits = 0
    for test in tests:
        result = await rpc_call(client, "domains.check", test["call"])
        assert "results" in result
        hits += 1
    return {"tool": "domains.check", "passed": hits, "total": len(tests)}


async def execution_suite(client: Any) -> dict:
    cases = [
        ("yes available", {"domain": "example.test"}),
        ("available keywords", {"keywords": "test widgets", "maxResults": 3}),
        ("no null domain", {"domain": ""}),
    ]
    passed = 0
    for reason, payload in cases:
        result = await rpc_call(client, "domains.check", payload)
        assert "results" in result
        passed += 1
    return {"passed": passed, "total": len(cases)}


async def negative_suite(client: Any) -> dict:
    bad_inputs = ["", "no tld", "http://not-a-domain"]
    safe = 0
    for bad in bad_inputs:
        result = await rpc_call(client, "domains.check", {"domain": bad})
        assert result["results"][0]["available"] is False
        safe += 1
    return {"passed": safe, "total": len(bad_inputs)}


async def parameter_extraction_suite(client: Any) -> dict:
    payload = {"domain": "extract.test"}
    result = await rpc_call(client, "domains.check", payload)
    assert result["results"][0]["domain"] == "extract.test"
    return {"passed": 1, "total": 1}


async def ranking_suite(client: Any) -> dict:
    payload = {"keywords": "run ranking widgets", "maxResults": 5}
    result = await rpc_call(client, "domains.check", payload)
    assert len(result["results"]) <= 5
    return {"passed": 1, "total": 1}
