# Plugin runtime — ChatGPT Apps / MCP Apps that actually get called

This folder is a self-contained handover. It contains an operating guide, the
full source extracts behind it, and a working clean-room runtime that
implements the guide. Goal: figure out how to get called by ChatGPT on our
plugins, then turn that into a repeatable compiler-optimizer loop.

## What is here

- `OPERATING-GUIDE.md` — the huge guide (10 sections + 3 appendices): the
  capability-to-invocation loop, repo atlas with run commands, tunnel-first
  environment setup, description optimization procedure, deterministic
  protocol gate, host compilation rules, UI retry and state rules, reviewer
  telemetry policy, discovery bundle, release-gating preflight checklist,
  iteration loop, run-command index, rule records, second-wave backfill notes.
- `SOURCES.md` — provenance and license table for every extract. Read before
  reusing anything.
- `extract/` — 51 source folders from 30 upstream repos: spec probes,
  conformance suites, eval harnesses, telemetry SDK, reference apps,
  submission experiments, WebMCP benches, A2UI specs, skill corpora.
  Dirs tagged REFONLY are read-only (no license or strong copyleft).
  Unknown-license dirs are reference for reimplementation, never paste.
- `runtime/` — clean-room Python implementation (stdlib + pyyaml only):
  `preflight.py` (26 static submission checks, fails closed),
  `evals_run.py` (mcp-eval YAML format, static + live + model-grade hook),
  `telemetry.py` (reviewer-session receiver + widget snippet generator),
  `hosts.py` (one capability into ChatGPT / Claude / generic metadata),
  `discovery_build.py` (JSON-LD + llms.txt + capability page),
  `capability.example.yaml`, `evals/example.yml`, `tests/` (7 tests, green).

## What was done (short history)

1. Two GitGoblin scans over a `chatgpt-app-discovery` sector (16 seeds: MCPJam,
   Roee-Tsur, alpic-ai, basementstudio, modelcontextprotocol, mcp-use,
   0xkoller, qchuchu, andreban, domfarolino, sdras, PaulKinlan, hydrosquall,
   liady, fredericbarthelet, yannj-fr). Corpus: 5713 observations, 1670 star
   edges, 904 owned repos mapped, 13 signals, 16 opportunities. Top signal:
   alpic-ai/skybridge at 0.758 alpha. Live DB: `gg-as/data/gitgoblin.db`.
2. Coverage audit caught a rate-limit hole (liady's 124-repo tree missed) and
   backfilled 316 observations through the proper collector with provenance.
3. Cloned 30 repos depth-1 to /tmp, extracted the meaningful modules here,
   triaged every license, read the testing setups, and compiled the guide.
4. Built the runtime clean-room and verified it: 7 passed, preflight 26/26
   GO on the example, evals static green, discovery bundle builds.

## How to use

```bash
cp runtime/capability.example.yaml myapp.yaml   # describe your capability
python3 runtime/preflight.py --manifest myapp.yaml --out preflight.json
python3 runtime/evals_run.py --eval runtime/evals/example.yml --manifest myapp.yaml
python3 runtime/discovery_build.py --manifest myapp.yaml --out public/
python3 -m pytest runtime/tests/ -q
```

Then follow OPERATING-GUIDE.md sections 3-10 in order. Collect the three
datasets from day one: prompt-to-tool-selected, variant-to-selection-rate,
host-version-to-compatibility-outcome.

## Known gaps (be honest about these)

- Framework mains (skybridge, xmcp, mcp-use, MCPJam inspector) are NOT cloned
  in full; only templates, derived suites, and docs were extracted.
- Research sources were thin: arXiv rate-limited out, HackerNews empty,
  ecosyste.ms returned 5 rows. OpenAlex's 300 rows were never mined.
- No submission review logs exist in any repo; rejection outcomes come from
  forum reports and code comments.
- The runtime's model-grading pass is a hook awaiting an OpenRouter key and a
  live server. Everything else runs offline.
- liady's rps-app and weather-app are old generic web apps, not app
  experiments; his real signal is ext-apps, a2ui, mcp-ui, mcpgarden-inspect.
- vercel/eve, block/buzz, openui, react-bits signals are expansion noise
  (follows-of-follows), correctly deprioritized.
