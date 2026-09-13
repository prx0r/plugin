# WebMCP — distilled reference + AgentCom integration (2026-09-13)

Sources: Chrome build-tools / compare-mcp / early-preview posts (André Cipriani
Bandarra), Moz + Pacific54 implementation writeups, W3C CG draft (editors incl.
Dominic Farolino). Status: early preview behind origin trial; subject to change.

## What it is

Browser API (`document.modelContext`, earlier drafts `navigator.modelContext`
— feature-detect both) letting a page register structured tools
`{name, description, inputSchema, annotations, execute}` that an agent running
in the same browser (sidebar, built-in agent, extension) invokes directly, no
server round-trip. Declarative API for HTML forms, imperative API for JS.
Ship both MCP (backend) and WebMCP (frontend) where the same job exists —
agents use whichever transport they have.

## Rules that transfer 1:1 to our MCP tools

- Same annotations, honestly set (`readOnlyHint`/`destructiveHint` change agent
  behaviour) **plus** `untrustedContentHint` for tools returning user-generated
  or outside content (reviews, comments) so the agent treats it as data, not
  instructions. Trades review/offer content needs this flag.
- Errors must guide, never dead-end: wrong state ("Search for flights first"),
  bad params ("Provide the date in YYYY-MM-DD format"), empty results (suggest
  loosening criteria), business-rule violations (point at returns policy).
  Never raw dumps, never silent failure. Our FailureCode set already follows
  this; every new failure needs its recovery sentence.
- Design loop is ours verbatim: user goal → initial state → role-play turns →
  variance (vague "NYC next week" → ask, don't assume) → evals (selection,
  params, state) → production telemetry → update evals + definitions.
- Keep payloads small; fetch corpus on demand. Tool defs tiny, data lazy.

## Security notes (secure-tools page + field reports)

- A WebMCP tool runs as the logged-in user: apply the same server-side authz
  as any JS-callable action. Never bypass your own access controls.
- Feature-detect BEFORE loading the bundle (guard the load, then the call) —
  late detection wastes bytes and lies to capability checks.
- Spam-filter conflict is real: the tool is the defined door for legitimate
  automation; keep traps armed for everything else. Silent non-execution (agent
  believes it booked, nothing happened) is the worst failure mode — verify
  registration on a schedule, like a payment webhook.
- Extension content scripts do NOT get origin-trial features: an
  extension-based assistant finds no tools while page console lists them.
- Almost no agent traffic yet; mainstream consumer agents calling WebMCP tools
  are not shipping. Experiment lane, not distribution.

## How WebMCP is used HERE (AgentCom)

Third transport for the same capability — MCP server, ChatGPT app, **website**:

```
Capability (domains.check)
   ├── MCP server  → ChatGPT / Codex / Claude / raw clients
   ├── ChatGPT app → directory + contextual surfacing
   └── agentcom.org page + webmcp.js → Chrome sidebar agents, extensions
```

Concrete integration points:

1. **Capability landing pages** (the indexable SEO surface from intel) each
   register 1–3 tools: declarative form tool for `check_exact_domain`,
   imperative tool for quote/offer lookup hitting our public endpoints.
   Same descriptions, same triggers, same eval cases as the MCP tools —
   one metadata source, three transports.
2. **Domain checkout completion on our site.** Digital goods can't sell inside
   the plugin, so purchase lands on agentcom.org anyway — that page is where
   WebMCP earns its keep: a browser agent can drive check → cart → register
   without DOM-guessing. Design that page's tools first, page UI second.
3. **Scheduled registration check.** CI probes the live pages for
   `registerTool` presence per supporting browser matrix; missing registration
   pages like a failed deploy, not a warning.
4. **Starter**: `apps/web/src/webmcp.ts` — feature-detect, tool-def builders,
   recovery-message formatter. Pure parts unit-tested; browser wiring guarded
   so imports never throw in Node.

Out of scope until traffic exists: declarative checkout forms, extension
targeting, per-page analytics beyond the signal-tool pattern.
