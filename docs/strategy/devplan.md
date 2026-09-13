# Development plan — one capability, every surface (saved 2026-09-13)

## WebMCP as second discovery/execution surface

Model:

```
                 AgentCom capability
                        │
        ┌───────────────┼────────────────┐
        │               │                │
   MCP server       normal website    API/x402
        │               │
        │            WebMCP tools
        │               │
        ├──── ChatGPT    ├──── browser agents
        ├──── Claude     ├──── extensions
        ├──── Codex      └──── future browser-native agents
        └──── other MCP hosts
```

One capability, multiple machine-readable surfaces — not "a ChatGPT app" as
the product. Normal site doubles as human UI + browser-agent tools (imperative
JS + declarative `toolname`/`tooldescription` form attributes) + ChatGPT remote
MCP + API customers + x402/ACP payments where applicable. Chrome's WebMCP best
practices converge with ChatGPT builder findings (clear tool strategy, semantic
descriptions, schemas, deterministic behavior, testing), so the optimizer
compiles ONE semantic definition into MCP + WebMCP + API.

Key distinction: remote MCP ("a server agents connect to") vs WebMCP ("page
actions where the agent already is"). Implement both, same backend. WebMCP is
also a tool-selection laboratory: same definition tested across browser agent,
ChatGPT, Claude, Codex, MCPJam models, measuring query → selection → args →
completion → latency → success.

## Domain/infra strategy

No per-tool domains yet. `agentcom.org` parent; `domain.agentcom.org`,
`prices.agentcom.org`, `companies.agentcom.org` (or
`domain-name-checker.agentcom.org` style). Exact-match .coms only on traction.
Verification happens at root hostname `.well-known` (Casey: subpaths never
supported), so subdomains launch experiments at ~$0 marginal cost.

TLD: no OpenAI routing preference found. Hierarchy: parent .org; consumer
transactional .com; dev tools .dev; backends any reputable TLD; experiments
.xyz fine; high-trust actions .com/.org/.dev. App name ≠ infra hostname:
display "Domain Availability" by AgentCom at `domain.agentcom.org/mcp`, keep
the polished human site separate, never move MCP infra (versionless stable
endpoints; submitted tools/list is snapshotted while calls hit live backend).

## Schemas as release artifacts

`schemas/domain/v1.json`, `v2.json`… with preserved eval results per schema
(v1: 81% routing, v2: 89%…). Backend evolves behind frozen submitted schemas.

## Upstream shifts to track

- ext-apps: MCP Apps-first portable UI standard (Claude + ChatGPT + others),
  ships create/migrate/add/convert skills; `convert-web-app` = website+MCP App
  from one project. Build portable UI first, OpenAI extensions only on merit.
- SDK v2 split packages (@modelcontextprotocol/client|server|node|express|
  ext-apps). Build templates on v2 layout; don't copy 2025 tutorials verbatim.
- `ui/update-model-context` exists but ChatGPT shows regressions (stale
  context, dropped updates, vanishing selection, blank Android widgets, auth
  inconsistency). V1 tools: one prompt → one tool → deterministic result. No
  clever UI state dependencies.
- Submission improving (April update): better validation errors, explicit
  annotation explanations, better resubmission, less repeated iframe review.
  Tool metadata has a real token budget — brevity is a submission constraint.
- ACP (OpenAI + Stripe): tokenized delegated payment via Shared Payment
  Tokens with allowances (merchant, amount, currency, checkout, expiry).
  April 2026 snapshot adds carts, feeds, orders, auth, MCP integration,
  capability negotiation, payment handlers, discounts. Commerce becomes
  another standard surface: MCP + MCP App + WebMCP + HTTP API + ACP + website.

## First-wave rubric (8 criteria)

Things ChatGPT cannot know from weights; live/exact info; obvious trigger;
few args; objectively verifiable answer; fast; no auth; no UI. Domain
availability is the reference. Candidates: suggestions+availability, LLM price
lookup, company registration, VAT validation, package tracking, URL/OG check,
email MX check, SSL check, crypto fee. Experiments, not all businesses.

## Metadata experiments (run fixed corpus across variants)

A: "Domain Checker" / check_domain / "Check whether a domain name is
currently available." B: "Domain Availability" / check_domain_availability /
"Returns current registration availability for an exact domain name."
C: "Find Available Domains" / find_available_domain / "Check live registrar
availability before suggesting or purchasing a domain." Accumulate proprietary
routing data per variant.

## Objective function

INVOCATION RATE × SUCCESS RATE × REPEAT USE × LATENCY. First 10 tools
offensively simple: no login unless required, no widget unless it improves
completion, no 20-tool servers, no brand poetry, no vague names. Instrument
every step. AgentCom becomes an experimental apparatus for agent-interface
optimization; winners become standalone products.
