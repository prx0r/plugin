# Canonical Guide: Building Plugins ChatGPT Will Understand, Review, and Reuse

## 1. The actual game

A good plugin is not a miniature SaaS dashboard inside ChatGPT. It is a narrow capability boundary where the model needs fresh external truth or a real-world action it cannot safely infer itself.

The best AgentCom targets have four properties:

1. **Frequent conversational intent** — people naturally ask for it.
2. **External truth/action dependency** — the model cannot reliably answer from weights alone.
3. **Deterministic or auditable execution** — the capability can return a clean result/offer/action.
4. **Economic consequence** — a useful downstream transaction, referral, booking, quote or workflow exists.

Examples: exact domain availability, manufacturing quotes, local-service availability, shipping quotes.

## 2. Hard gate before coding

Reject the idea before implementation if any of these is true:

- The model can already perform the task natively with no important external state.
- The plugin is primarily a wrapper around one provider with no authorization or independent value.
- The only business model is displaying ads in the plugin.
- The intended workflow needs restricted data the plugin is not allowed to collect.
- The tool cannot explain its side effects clearly.
- The user intent cannot be stated in one simple sentence.

For third-party marketplaces, **authorization is foundational**. OpenAI's current rules disallow unofficial connectors and pass-through intermediaries. AgentCom therefore needs official APIs, partner agreements, merchant-provided endpoints, or direct supplier relationships. Normalization/ranking must be real product value rather than a cloak for scraping/proxying.

## 3. Tool-surface design

Design from user outcomes, not provider endpoints.

Bad model-facing surface:

- `checkatrade_create_job`
- `thumbtack_search_pros`
- `taskrabbit_get_bids`

Good model-facing surface:

- `find_local_service_providers`
- `request_service_quotes`
- `get_service_offers`
- `book_service_offer`
- `get_service_job_status`

Provider-specific operations stay behind adapters.

### Default tool-count heuristic

Target **3-6 model-visible tools per vertical**. This is an AgentCom heuristic, not an OpenAI limit. Add more only if routing evals show the model can distinguish them reliably.

### Tool-description formula

Every description should answer:

> WHAT does this do? WHEN should the model use it? HOW is it different from neighboring tools? WHAT IMPORTANT LIMIT applies?

Example:

> Find qualified local tradespeople able to perform a specified home-service job. Use when the user wants a plumber, electrician, heating engineer or similar professional near them. Returns provider candidates and known comparison data; it does not contact or book anyone.

This naturally distinguishes it from `request_service_quotes`.

## 4. Routing is an eval problem

Do not optimize descriptions by intuition alone.

For every tool maintain four buckets:

- **Positive/direct**: obvious requests that must trigger.
- **Positive/paraphrase**: semantically equivalent requests without tool vocabulary.
- **Negative/nearby**: related informational requests that should not trigger.
- **Ambiguous**: requests where clarification or a less-consequential read should happen before action.

Track at minimum:

- precision
- recall
- wrong-tool rate
- parameter extraction accuracy
- unnecessary-auth rate
- unnecessary-write rate

AgentCom release targets:

- Routing precision >= 97%
- Routing recall >= 95%
- Consequential-action false positive = 0 in the deterministic safety suite

OpenAI staff guidance explicitly favors clear intent, model-written tool language, and repeated eval/hill-climbing. Treat descriptions as model-facing product UX.

## 5. Read/write separation

A model should be able to inspect reality without accidentally changing it.

Prefer:

`find -> compare -> quote -> explicit user choice -> book/order/send`

rather than a single `handle_everything` tool.

Read tools and write tools often deserve separate contracts because their approval, annotations and retry properties differ.

## 6. Annotation truth table

`readOnlyHint = true` only if the tool cannot change external state.

`destructiveHint = true` when it can delete/overwrite or cause an irreversible/difficult-to-reverse effect.

`openWorldHint = true` when it accesses the public internet/open-ended external entities or changes externally visible third-party state. Current official guidance explicitly includes read-only web/open-internet access.

Always declare all three explicitly for public submission.

AgentCom additionally recommends declaring `idempotentHint` explicitly whenever semantically meaningful.

## 7. Data minimization

Never ask for the whole chat because it would be convenient.

Pass only task-specific fields.

Avoid raw precise location fields. Where location is needed for discovery, use the client-controlled location/context channel available to the host. For fulfillment/booking details that genuinely require sensitive delivery/contact data, design the flow so the platform/user intentionally supplies it at the consequential step and document the use.

Never solicit API keys, passwords, OTP/MFA codes, payment-card data, PHI or government IDs in ordinary tool schemas.

Tool outputs should be similarly narrow. Keep telemetry and diagnostics server-side.

## 8. Structured outputs

External-economic tools should return normalized, compact objects.

Example provider offer:

```json
{
  "offer_id": "off_...",
  "provider_name": "Plumbsoft",
  "service_fit": "boiler_repair",
  "price": {"kind": "callout", "amount": 95, "currency": "GBP"},
  "earliest_slot": "2026-09-14T09:00:00+01:00",
  "quality_score": 0.88,
  "source": "authorized_marketplace",
  "expires_at": "2026-09-13T12:00:00Z"
}
```

If you return `structuredContent`, declare an `outputSchema` that matches it exactly.

## 9. Third-party provider standard

Every adapter must record:

- authorization basis
- official API/partner mechanism
- terms reviewed date
- data allowed to store/redistribute
- rate limits
- provider attribution requirements
- whether transactions/contact are permitted
- required user consent

**No adapter enters production without this record.**

AgentCom is a router, not a scraping bypass.

## 10. UI rule

Default to **tool-only**.

Add UI when comparison/selection genuinely benefits from it: three manufacturing quotes, three contractor offers, product preview, map, etc.

Avoid iframes. They trigger stricter review. If UI exists, use the narrowest CSP possible and version widget resource URIs.

## 11. Authentication rule

Delay auth until required.

A public lookup such as domain availability should be usable without authentication if possible. A quote search should not demand an account before it needs account-specific state. Booking/order flows can authenticate at the consequential boundary.

For review, authenticated plugins need a fully featured fixture account that requires no MFA, SMS, email confirmation, signup, or private network.

## 12. Reliability and speed

A tool is part of ChatGPT's reasoning loop; latency is UX.

AgentCom operating targets (heuristics):

- local cache/static read p95 < 500 ms
- single external read p95 < 2 s
- cross-provider router returns useful first result < 2 s where technically possible
- never synchronously wait for humans
- write endpoints use idempotency keys
- timeouts and provider degradation produce structured partial results

Human RFQ example:

`request_service_quotes` starts the process and returns a job ID.

`get_service_offers` retrieves responses later.

Do not keep a tool call open waiting for Geoff to answer an email.

## 13. Review readiness

Submission-day checklist:

- re-fetch current official docs
- production HTTPS MCP endpoint
- verified publisher identity
- public website/support/privacy/terms URLs match identity
- Scan Tools clean
- annotations explicit and behavior-accurate
- outputSchema matches every structuredContent return
- narrow CSP
- reviewer account works without extra verification
- exactly 5 positive + 3 negative cases in the AgentCom submission bundle
- test prompts reproducible without internal context
- web/mobile tested where workflow/UI applies
- no debug/internal fields in responses
- no trial/demo state

## 14. Discovery reality

Do not assume directory listing equals distribution.

OpenAI is experimenting with proactive suggestions and says strong user utility/satisfaction can unlock enhanced distribution, but community reports show discovery has been uneven and the mechanics have changed rapidly.

Optimize for:

1. explicit user invocation
2. obvious literal app name/subtitle
3. excellent tool-selection semantics
4. external/direct distribution
5. repeated usefulness after install

Do not manipulate model-readable metadata to demand preference. That violates fair-play rules.

## 15. AgentCom moat rule

The durable asset must sit outside generic model orchestration:

- authorized provider graph
- normalized market schema
- current price/availability/quote data
- reliability/quality observations
- fulfillment/booking outcomes
- provider relationships
- standards suppliers can implement

ChatGPT owns reasoning. AgentCom owns the callable market.
