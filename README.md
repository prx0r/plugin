# AgentCom — real-world markets callable by AI agents

ChatGPT → Apps SDK → MCP tools → canonical router → provider adapters.
One boring market protocol underneath; domains, print, trades on top.

## Layout

- `apps/mcp` — remote MCP server: 9 intent-verb tools, Streamable HTTP at
  `/mcp`, discovery at `/llms.txt`, `/.well-known/agentcom.json`,
  `/capability.jsonld`. Run with `npm run mcp`.
- `apps/web` — WebMCP starter (third transport for agentcom.org pages).
- `packages/core` — market kernel: intent, offers, capabilities, ranking,
  provider contract.
- `packages/domains` — Domain Availability vertical (live RDAP, no auth).
- `packages/domain`, `packages/router`, `packages/artwork`,
  `packages/providers/*`, `packages/db` — Custom Print vertical (Prodigi,
  Printful first; sandbox stubs until API keys).
- `packages/evals` — optimizer framework: seed cases, selector bench,
  precision/recall/F1, schema + density gates, hill-climb comparator.
- `packages/studio` — plugin creator/evaluator/publisher/optimizer: packet
  generation (`creator`), unified eval reports (`evaluator`), preflight
  verdicts (`publisher`), variant ranking + selection-event log
  (`optimizer`). CLI: `npm run studio -- <eval|gates|packet|optimize|
  preflight|full|experiment [id]>`.
- `packages/http` — REST transport for capabilities (`POST /v1/domains/*`),
  same core, no duplicated logic.
- `registry/` — capabilities, open experiments, append-only compatibility
  log, dated results. `schemas/<capability>/v1.json` — frozen release
  artifacts, asserted equal to the live server in CI.
- `packages/ui` — reserved for the comparison widget.
- `tests/` — node:test suites, one file per area.
- `docs/` — build references (`agentcom-architecture.md`, `openai-*`,
  `webmcp.md`) plus `docs/strategy/` (theses, in arrival order:
  northstar, agentugly-thesis, service-relationships, plan, strat, alpha,
  opti, publish, pogchat, etsy-pinterest-distribution).
- `intel/` — validated JSON knowledge base (submission, discovery, evals,
  review-ops) with schema, index, and watchlist. See `intel/README.md`.
- `submissions/domains/` — Domain Availability submission packet:
  `plugin_spec.json`, `chatgpt-app-submission.json`, `waivers.md`.
- `kits/plugin-canonical/` — conformance kit: schemas, deterministic linter,
  eval formats, agent prompts.
- `kits/plugin-runtime/` — operating guide plus extracted reference sources
  and a clean-room preflight/evals runtime. See its README first.

## Dev

- `npm install`
- `npm run typecheck`
- `npm test` (43 tests)
- `npm run mcp` (serves on `PORT`, default 8787)
- `npm run studio -- full` (eval+gates rollup; exit 0 on pass)
- `npm run studio -- preflight` (submission verdict from packet + flags)
- `npm run preflight:schema` / `npm run preflight:domains` (submission gate)

## Rules that matter

- Adding a marketplace never changes ChatGPT-facing tool semantics.
- No supplier-named operations cross the transport (asserted in tests).
- Tool schemas freeze at publication; iterate behind adapters.
- Every platform rule carries source + last-verified date (see `intel/`).
