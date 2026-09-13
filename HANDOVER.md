# HANDOVER — AgentCom repo session 2026-09-13

## What this is

AgentCom monorepo at `/home/ubuntu/print`, remote on `https://github.com/prx0r/plugin`.
3 commits on `main`. Node 22.23, TypeScript 5.6+, MCP SDK 1.30, zod 4.x.
38+ tests pass, tsc clean, intel validator passes.

Two parallel things in one repo:
1. **AgentCom Core** — generic market-intent routing kernel for ChatGPT plugins
2. **Pog Prints** — print-vertical business (Prodigi/Printful sandbox stubs)

Plus massive docs/intel library from this session.

---

## What was built this session

### 1. Monorepo foundation
- `packages/core` (intent->offers->ranking), `packages/domains` (RDAP live),
  `packages/evals` (optimizer), `packages/http` (REST), `packages/studio`
  (creator/evaluator/publisher/optimizer), `capabilities/domains` (facade+MCP+WebMCP)
- Renamed @print/* to @agentcom/*, moved packages/domains -> capabilities/domains

### 2. Strategy docs (docs/strategy/)
northstar, agentugly-thesis, service-relationships, plan, strat, alpha, opti,
publish, pogchat, etsy-pinterest, devplan, finalbuildsbuild, finalbuildsmbe,
actualguide. Plus docs/REPO-BOUNDARY.md and docs/outputs-as-studios.md.

### 3. Intel (intel/)
86+ items, 6 JSON files, schema, index, watchlist, Python validator.
Status: official/self_verified/reproduced/community_report/hypothesis/stale.
Freshness: 30/14/7 days by tier.

### 4. Plugin remote server (apps/mcp/src/remote-server.ts)
Publishable surface for domains.check only, PORT 2092.
Routes: /mcp, /healthz, /.well-known/agentcom/capabilities.json, /llms.txt,
/v1/domains.check, /.well-known/openai-apps-challenge.

### 5. Registry (registry/)
capabilities, experiments (A/B/C naming), probe backlog, compatibility log,
deployments state, dated results. First run: B-availability + C-finder tied 0.80
F1 (lexical proxy, not model routing — method annotated invalid_for_app_name).

### 6. Eval infrastructure
18 positive+negatives + 4 ambiguous. Keyword + similarity selectors (Tier 0).
Tier-1 runner scaffold. Experiment runner with logical-capability mapping.
Append-only hashed results.

### 7. Studio
creator: packet generation from canonical definitions.
evaluator: routing metrics + gates, eval tiers.
publisher: preflight + probeDeployment() health checks.
optimizer: variant ranking + surface_attempt telemetry event shape.

### 8. WebMCP
browser registration snippet, declarative form snippet, recovery error formatter.
Production JS for capability pages.

---

## What's true now

- Domain Availability: RDAP confirmed free/taken/unknown, honest wording
- Print: Prodigi/Printful sandbox stubs, no keys
- MCP server works: dev 8787, remote plugin 2092
- ChatGPT testable locally: tunnel + Developer Mode
- Submission needs: public HTTPS, domain verify, privacy/terms/support, 5+3
- CancelMe: adapter plan documented, not built (kernel in prx0r/cancelme)
- LLM Price Compare: adapter plan documented, feeds in finalbuilds2

## What is NOT done

- No production deploy
- No registrar-grade availability (only RDAP absence)
- No real model-routing eval (Tier 1 fake judge)
- No WebMCP live testing
- No public domain/identity pages
- CancelMe integration not started
- Print not wired to remote-server
- No telemetry pipeline

## Key files

1. `docs/strategy/actualguide.md` - merged operating architecture
2. `docs/strategy/devplan.md` - implementation directive
3. `docs/REPO-BOUNDARY.md` - ownership contract (finalbuilds2 vs plugin)
4. `capabilities/domains/index.ts` - DomainCapability facade
5. `apps/mcp/src/remote-server.ts` - publishable plugin surface
6. `packages/evals/src/cases.ts` - seed corpus
7. `packages/studio/src/creator.ts` - submission generator
8. `intel/README.md` - intel semantics + freshness
9. `docs/PLUGIN_TEST_AND_SUBMIT.md` - ChatGPT test steps
10. `NEXT-STEPS.md` - ordered next actions

## The one invariant

Never turn uncertainty into a prettier answer.
Available = registrar-confirmed. Unknown = unknown. Stale = stale.

## Repo structure

```
agentcom/
  apps/mcp/src/server.ts          dev aggregate (domains + print)
  apps/mcp/src/remote-server.ts   publishable plugin (domains only)
  apps/mcp/src/index.ts           print tool defs
  apps/mcp/src/discovery.ts       capabilities manifest + llms.txt
  apps/web/src/webmcp.ts          browser registration + helpers
  apps/web/public/                llms.txt, index.html, capabilities.json, webmcp snippet
  capabilities/domains/index.ts   DomainCapability facade
  capabilities/domains/mcp.ts     MCP server wrapper
  capabilities/domains/ADAPTER.md CancelMe adapter plan
  capabilities/domains/tests/     MCP suite + eval cases
  packages/core/                  intent -> offers -> ranking kernel
  packages/evals/                 seed corpus + selectors + tiers + experiment runner
  packages/http/                  REST transport
  packages/studio/                creator/evaluator/publisher/optimizer
  packages/domain/                print primitives
  packages/router/                deterministic ranking
  packages/artwork/               artwork validation
  packages/db/                    in-memory persistence
  packages/providers/             prodigi, printful stubs
  registry/                       capabilities, experiments, probes, compat, deployments, results
  intel/                          86+ items, schema, index, watchlist, validator
  submissions/domains/            plugin_spec.json, submission.json, waivers.md
  kits/plugin-canonical/          linter + validator (Python)
  kits/plugin-runtime/            reference extracted sources
  docs/strategy/                  11 thesis docs
  docs/PLUGIN_TEST_AND_SUBMIT.md  ChatGPT test + submit steps
  docs/webmcp.md                  WebMCP reference
  tests/                          38+ node:test suites
  NEXT-STEPS.md                   ordered next actions
```

## Running it

- `npm run remote-plugin` — publishable domains.check on 2092
- `npm run mcp` — dev aggregate (domains + print) on 8787
- `npm run studio -- full` — eval+gates rollup
- `npm run studio -- experiment` — A/B/C naming experiments
- `npm run studio -- corpus` — regenerate committed JSONL
- `npm test` — 38+ tests
- `npm run preflight:domains` — submission gate

## Toolkit repos

Referenced in alpha.md, cloned to /home/ubuntu/vendor/:
mcpjam-inspector, mcpjam-apps-sdk-everything, roee-mcp-signal,
roee-mcp-spec-check, alpic-skybridge, mcp-ext-apps, mcp-use,
basement-xmcp.

## Strategy repos

finalbuilds2 at /home/ubuntu/finalbuilds2 (prx0r/finalbuilds2).
cancelme at prx0r/cancelme (not cloned yet).
