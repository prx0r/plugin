# AgentCom — plan (saved 2026-09-13)

Yes — **AgentCom.org is the right umbrella** if we define it very narrowly:

> **AgentCom makes real-world markets callable by AI agents.**

Not another marketplace. Not another CRM. Not another "AI assistant."

The primitive is:

intent → normalized market query → providers → quotes/availability → ranked options → action

That same template works for domains, printing, trades, accountants, shipping, insurance, etc.

## ChatGPT marketplace structure (as of July 9, 2026)

OpenAI moved app discovery into the **Plugins Directory**. Plugins are the main
discovery unit across ChatGPT and Codex. A plugin can package apps, skills, and
app templates; the underlying app still connects ChatGPT to external
data/actions. (https://help.openai.com/en/articles/20001256/)

Useful structure:

```
AgentCom plugin
    ├── Domains app
    ├── Print app
    ├── Local Services app
    └── later other market routers
```

But do **not** launch that bundle immediately. Launch one tiny app first.
OpenAI: strongest apps are **tightly scoped, intuitive in chat, and complete
real-world workflows that originate in conversation**.
(https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/)

## Discovery

Paths: explicit install/select, `@name` invoke, tool-interface select, plus
OpenAI experimenting with automatic surfacing from conversational context,
usage patterns, user preferences. Resonating apps may get prominent placement
or recommendation — never guaranteed. So tool metadata is machine-facing
distribution optimization:

- Bad: "Comprehensive lead-generation platform."
- Good: "Find vetted local tradespeople, compare quotes and availability, and arrange home-service jobs."

## Developer reputation

Some plugins become **OpenAI Verified** (quality/reliability/usefulness, selected
developers, no open application). No documented developer score — but behave as
though reputation compounds: 3 boring reliable tools over 30 mediocre ones.
Position: exact, fast, reliable external actions.

## Build stack

```
OpenAI Plugins/App layer
        ↓
Apps SDK
        ↓
remote MCP server
        ↓
AgentCom canonical router
        ↓
marketplace/provider adapters
```

No OpenAI agent in the middle unless needed. `ChatGPT → MCP → deterministic
backend` beats `ChatGPT → our agent → another agent → APIs` for the boring
router path. Agents API only later for genuinely autonomous multi-step work
(contacting five contractors, waiting, interpreting, resolving conflicts).
(https://developers.openai.com/api/reference/python/resources/beta/subresources/agents/methods/create)

## AgentCom canonical market interface (build once)

Every vertical adapter reduces to:

```
search() / quote() / availability() / contact() / book() / status()
```

Capabilities declared per provider:

```
ProviderCapability { discovery, quote, realtimeAvailability, messaging, booking }
```

## Checkatrade adapter (ideal first)

Correction: NOT a native MCP. They expose an **Affiliate Jobs API** (`POST /jobs`),
OpenAPI docs, and an `llms.txt` for agents.
(https://developers.checkatrade.com/docs/getting-started)
We expose `request_local_trade_quotes(...)` → normalize job → Checkatrade
adapter → `POST /jobs`. Never scrape — acceptable-use policy prohibits
unauthorized bots. (https://www.checkatrade.com/acceptable-use-policy)
Use official APIs/affiliate relationships: trusted infrastructure.

## Canonical schema (the kernel)

```
MarketIntent { vertical, task, location, constraints, budget, deadline, preferences, context, attachments }
Offer { provider, provider_type, price, price_confidence, earliest_slot, quality_score, review_score, distance, verification, terms, next_action }
```

Router ranks offers; output is boring (BEST VALUE / FASTEST / LOWEST PRICE cards).

## Tool rules

Never expose raw marketplaces (`checkatrade_create_job`, `taskrabbit_estimate`).
Expose intent verbs: `find_service_providers`, `request_quotes`,
`compare_offers`, `book_provider`. Provider APIs stay private adapters.
First local-services app: `find_local_services` (ro), `request_service_quotes`
(external comms, marked), `get_service_offers` (ro), `book_service_offer`
(write, approval-gated), `get_service_job_status` (ro).
Names/descriptions in user language — SEO for tool selection.
(https://developers.openai.com/api/docs/guides/latest-model?model=gpt-4.1)

## Submission

Developer Mode + Apps SDK → OpenAI Developer Platform: MCP connectivity,
testing instructions, directory metadata, country availability. Plus privacy
policy, minimum-necessary permissions, usage-policy + third-party-terms
compliance. Approval never guaranteed; rejection/removal possible.
(https://openai.com/policies/developer-apps-terms/)
Reviewer test flow must be idiot-proof (e.g. "Find me a plumber in Nottingham"
→ results <2s → request quote from best three → sandbox job created).
Physical-goods transactions may link out to our own site initially.
(https://help.openai.com/en/articles/12515353-build-with-the-apps-sdk)

## Three reference routers (prove the thesis)

| Router | Intent | External truth | Monetization |
| Domains | "is this domain available?" | registrar/RDAP | affiliate |
| Print | "put this on a shirt" | POD suppliers | transaction margin |
| Trades | "find someone to fix this" | marketplaces/businesses | lead/booking |

Same kernel, deliberately different economics.

## Domains first (publication/discovery experiment)

`check_exact_domain()` / `batch_check_domains()` / `find_available_domains()`.
No login, no writes, fast, deterministic, no sensitive data, easy submission,
easy evals, genuinely needs fresh external data. Learn approval, discovery,
invocation prompts, latency tolerance, description effects, permitted telemetry.
Then apply lessons to Trades.

## Repo architecture

```
agentcom/
├── core/        (intent, offers, ranking, providers, auth, telemetry)
├── verticals/   (domains, print, trades — canonical.ts, router.ts, providers/)
├── surfaces/    (mcp, rest, web, chatgpt)
└── evals/
```

Rule: **adding a marketplace never changes ChatGPT-facing tool semantics.**

## Latency is moat

Concurrent provider queries; cached static profiles; only live fields fresh;
top candidates fast; expensive details lazy. Discovery <1–2s; quotes in
seconds; RFQ async/event-driven. Never make discovery wait for five humans:
"I found five good candidates and requested availability. Three responded."

## Supplier-side long game

Phase 1: AgentCom → existing marketplaces. Phase 2: + direct businesses.
Phase 3: business agents expose native AgentCom capabilities. Phase 4: agents
negotiate directly; Checkatrade becomes one liquidity source.
Normalized schema becomes the agent-commerce readiness standard; AgentUgly
scores "How well do you implement AgentCom's market contract?" → "AgentCom
Ready 92/100". Transparent spec, not vague AI visibility.

## Competition note

No "no competition" claim. OpenAI owns distribution; marketplaces add
agent APIs; Checkatrade courts AI agents. The opening: **nobody owns the
neutral cross-market normalization/routing layer yet.** Don't build a better
Checkatrade — build one boring market protocol so ChatGPT stops caring which
marketplace is underneath.

## Sequencing

Start TODAY with the domain checker as the publication/discovery experiment,
while designing AgentCom Core so Pog.Prints and Trades are merely vertical
adapters on top.
