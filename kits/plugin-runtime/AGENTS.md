# AGENTS.md — plugin-runtime folder

You are looking at a compiled intelligence + implementation package for getting
ChatGPT / MCP apps invoked, rendered, approved, and discovered. Another agent
built it; this file tells you how to work with it without breaking the rules.

## Layout

- `README.md` — start here for the human summary, history, and known gaps.
- `OPERATING-GUIDE.md` — the doctrine. 10 sections + appendices A-C. Follow it
  in order when building or reviewing an app.
- `SOURCES.md` — license table. Consult BEFORE copying any code out of `extract/`.
- `extract/` — upstream source folders. Reference library, not your codebase.
- `runtime/` — OUR code (clean-room). This is what you extend. stdlib + pyyaml
  only; keep it that way unless there is a strong reason.

## Hard rules

1. REFONLY dirs (`xkcd-app-REFONLY-NOLICENSE`,
   `widget-samples-REFONLY-NOLICENSE`, `authserver-REFONLY-AGPL`): read, never
   copy. AGPL code must never enter our runtime.
2. Unknown-license dirs (advent-chatgpt-app, double-iframes,
   appseverything-*, skytemplate-*, pokemon-mcp-testing, webmcp-checkout-*,
   liady rps/weather): reimplement behavior in your own words, attribute the
   idea, never paste.
3. MIT / Apache-2.0 / ISC dirs: reusable WITH license notices preserved. If you
   vendor a file, copy its LICENSE text into the commit and note it here.
4. Every metadata rule you add to the runtime needs a rule record (introduced,
   last verified, source, host, spec version, confidence) mirroring guide
   Appendix B. Timeless rules are how apps die at review.
5. Preflight fails closed. Do not add `--allow` escape hatches without a
   dated justification recorded in the guide.
6. Telemetry is mandatory for submissions: every app ships the reviewer
   session stream (section 7). No telemetry, no submission.
7. Collect the three datasets (prompt->tool, variant->rate, host->outcome) on
   every run. They are the moat; the upstream validator will never provide them.

## How to extend the runtime

- New check: add a `check_*` function in `runtime/preflight.py` plus a
  positive and a negative test in `runtime/tests/test_runtime.py`.
- New eval: add a YAML file under `runtime/evals/` in the mcp-eval format
  (see `evals/example.yml` and guide section 3).
- New host: add an adapter in `runtime/hosts.py` following the
  capability -> detector -> per-host metadata shape, and register it in
  `compile_all`.
- Verify every change: `python3 -m pytest runtime/tests/ -q` from this folder,
  plus `preflight.py` against `capability.example.yaml` must stay GO.

## Provenance (where the live data is)

- GitGoblin sector `chatgpt-app-discovery`, DB at
  `~/gg-as/data/gitgoblin.db` (5713 obs, 13 signals, 16 opportunities).
- Sector config: `~/gg-as/configs/sectors/chatgpt-app-discovery.yaml`.
- Scan logs: `/tmp/gg_chatgpt_discovery.log`, `/tmp/gg_chatgpt_layer2.log`.
- Depth-1 clones used for extraction: `/tmp/appdeep/`, `/tmp/appdeep2/`,
  `/tmp/sparse/` (ephemeral; this folder is the durable artifact).

## Suggested next work (in order)

1. Clone the framework mains not yet extracted (skybridge, xmcp, mcp-use,
   MCPJam inspector) selectively — docs, examples, and eval dirs only.
2. Mine the 300 OpenAlex rows and re-run arXiv queries for tool-routing work.
3. Wire `--grade-cmd` to a real judge and record per-variant selection rates.
4. Expand the contributor graph: ext-apps and Skybridge PR authors resolved to
   their repos, scored for empirical findings over tutorials.
