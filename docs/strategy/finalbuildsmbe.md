# FinalBuilds MBE — plugin implementation directive (saved word-for-word 2026-09-13)

The repo is **much better than a prototype**. The core thesis is already encoded correctly: one capability core, multiple surfaces, frozen schemas, explicit experiments, current-platform intel, and submission preflight. The main issue is that it has started becoming **AgentCom-the-platform before proving AgentCom-the-distribution-loop**.

Two current OpenAI patterns reinforce simplifying it now: OpenAI recommends keeping tool-specific guidance in concise tool descriptions and tuning them against representative evals; for large catalogs, it recommends deferring tool definitions/tool search rather than dumping everything into context. ([OpenAI Developers][1])

The most important findings from the code review are:

* **Domain + Custom Print are exposed from the same MCP server.** Split them immediately. Domain Availability should be a pathological micro-app with exactly its domain tools.
* **Your domain experiment is currently not actually testing what it claims.** `studio experiment` varies descriptions but ignores the variant `app` name and does not vary tool names. So the recorded A/B/C result is not evidence about app/tool naming.
* **There is a real correctness bug in `findAvailable()`.** It returns confirmed `available === true` **followed by unknown RDAP results**, despite the tool being named `find_available_domains`. Never mix unknown with confirmed available.
* **RDAP != registrar purchasability.** `check_exact_domain` currently claims “available to register,” but an RDAP absence is weaker than registrar availability. `finalbuilds2` already points to the stronger `cmail` registrar/RDAP primitives. Use those before making the stronger claim.
* **Hostname drift exists already:** `registry/capabilities.json` says `https://domain.agentcom.org/mcp`; the submission packet says `https://domains.agentcom.org/mcp`.
* **The repository still thinks it is called `print`.** `package.json` name and the `@print/*` namespace should go.
* **`packages/domain` and `packages/domains` are a smell.** Collapse/rename so there is one obvious ownership boundary.
* **Your production discovery metadata can emit `http://` URLs** because `server.ts` constructs origins with hardcoded `http://${req.headers.host}`. Behind Cloudflare/proxies this can produce incorrect canonical URLs.
* **The synthetic eval harness is useful infrastructure but not evidence of ChatGPT routing.** The similarity selector is explicitly lexical. Keep it as Tier 0; add actual-model tool-selection evals as Tier 1.
* **The eval corpus is far too small** to optimize metadata yet: seven domain positives + three negatives is enough to test the harness, not infer routing.
* **`preflight` always feeds `ALL_FALSE_FLAGS`.** It's a good checklist but not yet an operational preflight.
* Several print tools return `structuredContent` without declared output schemas, while your own submission standard says structured outputs should have them.
* `prepare_print_design` is marked `readOnlyHint: false`, but from the current implementation it appears to perform validation/computation rather than mutate external state. That annotation needs behavioral review.
* There is now duplicated strategic/state machinery between `finalbuilds2` and `plugin`. Establish ownership before the two repos drift.

The architecture I would impose is:

```text
finalbuilds2
    = WHAT should exist
      idea discovery
      capability scoring
      backlog
      product lineage
      experiment outcomes across portfolio

plugin
    = HOW an approved capability is compiled + distributed
      capability contract
      MCP
      WebMCP
      HTTP
      app metadata
      schemas
      routing evals
      submission
      telemetry
      platform compatibility
```

Then a capability moves:

```text
finalbuilds2 candidate
        ↓
promoted
        ↓
plugin/capabilities/<id>/
        ↓
canonical contract
        ↓
generated surfaces
        ├── MCP
        ├── WebMCP
        ├── HTTP
        ├── website metadata
        └── submission packet
        ↓
telemetry + evals
        ↓
result sent back to finalbuilds2
```

Below is the implementation brief I would hand directly to the coding agent.

# AgentCom `/plugin` — implementation directive

You have access to both `prx0r/plugin` and `prx0r/finalbuilds2`.

Your job is to turn `/plugin` into a small, rigorous **capability publication compiler + experimental runtime** for AgentCom.

Do not add more product ideas. Do not expand Custom Print. Do not build generalized marketplace machinery until the first capability has real ChatGPT usage data.

The immediate objective is:

> Make Domain Availability a completely isolated, technically honest, measurable ChatGPT/MCP/WebMCP experiment, while restructuring the repository so Cancel Subscription, LLM Price Compare, Handle Availability, Company Check, MCP Health, etc. can later be added from the same template.

---

# 1. Repository ownership

Establish an explicit division between the two repositories.

## `finalbuilds2`

Treat this as the portfolio/factory control plane.

It owns:

* capability discovery
* ideabank
* opportunity scoring
* cross-product lineage
* prioritization
* experiment outcomes across products
* promotion decisions
* kill/continue decisions
* long-run factory analytics

It should answer:

> What capability should AgentCom build next, and did that capability succeed?

## `plugin`

Treat this as the publication/runtime laboratory.

It owns:

* canonical capability contracts
* ChatGPT-facing tool definitions
* MCP transport
* WebMCP surface
* HTTP surface
* discovery metadata
* tool-routing evals
* metadata experiments
* submission packets
* compatibility checks
* production invocation telemetry
* platform-specific current intelligence
* schema version artifacts

It should answer:

> Given an approved capability, how do we expose it to agents correctly and optimize its selection?

Do not maintain parallel copies of product strategy in both repos.

Create:

`docs/REPO-BOUNDARY.md`

documenting this contract.

---

# 2. Stop treating `apps/mcp` as one AgentCom mega-server

Current problem:

`apps/mcp/src/server.ts` exposes Domain Availability and Custom Print tools together.

This is the wrong experimental surface.

Domain Availability needs to test:

`P(ChatGPT selects Domain Availability | user domain intent)`

without print tools contaminating the context.

Refactor deployment so each publishable capability has its own MCP surface.

Target:

```text
apps/
  gateway/                 optional internal/dev composition only

capabilities/
  domains/
    capability.json
    tools.ts
    handler.ts
    evals/
    submission/
    schemas/
    discovery/
    
  cancel-subscription/
    ...
```

Each public capability must be independently deployable:

```text
domain.agentcom.org/mcp
cancel.agentcom.org/mcp
llm-prices.agentcom.org/mcp
```

The shared monorepo is fine.

The shared public tool catalog is not.

There may optionally be an internal/dev AgentCom aggregate MCP server, but it must never be mistaken for the published micro-app.

---

# 3. Create one canonical Capability Contract

Do not hand-maintain:

* `registry/capabilities.json`
* `schemas/...`
* MCP registration
* HTTP definitions
* submission definitions

as separate sources of truth.

Create one canonical capability manifest.

For example:

```ts
interface CapabilityDefinition {
  id: string
  version: string

  publisher: {
    name: string
    trustDomain: string
  }

  app: {
    displayName: string
    subtitle: string
    description: string
    category: string
  }

  endpoints: {
    productionBaseUrl: string
    mcpPath: string
  }

  tools: ToolDefinition[]

  evals: {
    positives: EvalCase[]
    negatives: EvalCase[]
    ambiguous: EvalCase[]
  }

  discovery: {
    page: string
    surfaces: Surface[]
  }
}
```

Then compile/generate:

```text
capability
   ├── MCP registrations
   ├── frozen JSON schema
   ├── ChatGPT submission packet
   ├── WebMCP definitions
   ├── REST/OpenAPI surface
   ├── discovery JSON-LD
   └── eval fixtures
```

A field such as the production MCP hostname must have exactly one owner.

No more:

`domain.agentcom.org`

in one file and:

`domains.agentcom.org`

in another.

CI must fail on generated-artifact drift.

---

# 4. Fix Domain Availability correctness before doing optimization

This is P0.

Current `packages/domains/src/index.ts::findAvailable()` does:

```text
confirmed available
+
unknown
```

and returns both from a function called `findAvailable`.

This is not acceptable.

Unknown is not available.

Change the canonical availability model to:

```ts
type Availability =
  | "available"
  | "registered"
  | "unknown"
  | "reserved"
  | "unsupported"
```

or a similarly explicit enum.

Never collapse uncertainty into availability.

For:

`find_available_domains`

return only names whose availability is sufficiently confirmed to satisfy the public promise.

Unknown candidates may appear only in a clearly separate field such as:

```json
{
  "available": [...],
  "unverified": [...]
}
```

Prefer simply excluding them in the first version.

Add tests proving:

* an RDAP network failure never produces `available`
* unsupported TLD never produces `available`
* timeout never produces `available`
* malformed domain never produces `available`
* confirmed registration produces `registered`
* confirmed available candidate is allowed into suggestions

---

# 5. Stop claiming RDAP proves purchasability

Current wording:

> available to register

is stronger than the current implementation.

RDAP can establish registry/registration state, but absence from RDAP is not universally equivalent to “registrar will sell this domain now.”

`finalbuilds2/northstar.md` already identifies stronger existing primitives in the user's repos:

* registrar truth
* RDAP corroboration
* pricing
* bulk availability

Inspect those existing implementations rather than rebuilding them.

Create a provider interface:

```ts
interface DomainAvailabilityProvider {
  check(domain: string): Promise<DomainAvailabilityResult>
}
```

Results should contain provenance:

```ts
{
  domain,
  status,
  confidence,
  sources: [
    {
      type: "rdap" | "registrar",
      provider,
      status
    }
  ]
}
```

For v1:

* RDAP-only result can say “not found in RDAP” or equivalent honest wording.
* “Available to register” should require a registrar-grade signal where possible.
* If registrar-grade confirmation is unavailable, downgrade the wording rather than confidence-washing it.

Do not fabricate prices.

Do not return stale prices without an as-of/source field.

---

# 6. Shrink the first public Domain app

The objective is not features.

The objective is learning routing.

Test a two-tool baseline first:

```text
check_domain_availability
find_available_domains
```

Consider keeping bulk checking as an internal behavior of `check_domain_availability` if the MCP schema can naturally accept one or more domains without creating ambiguity.

However, do not change this merely on intuition.

Run the following variants:

### Surface A

```text
check_domain_availability
find_available_domains
```

### Surface B

```text
check_exact_domain
batch_check_domains
find_available_domains
```

(This section and §7 note the submitted packet's tool names differ from the
live server's. That naming divergence itself is registered as the first
metadata experiment rather than silently aligned.)

### Surface B

```text
check_exact_domain
batch_check_domains
find_available_domains
```

Evaluate actual routing.

Prefer the smaller surface unless the three-tool version has materially better measurable performance.

Do not expose:

* analytics
* registrar internals
* scoring internals
* provider-specific operations

to the model.

---

# 7. Repair the experiment framework

The existing:

`domain-naming-a-b-c`

experiment claims to test app/tool naming.

It currently does not.

The runner:

* ignores the `app` field
* retains the same tool names
* varies descriptions only

Therefore previous result labels must not be interpreted as evidence about app naming.

Mark existing result:

```text
methodology_status: invalid_for_app_name_claim
```

Do not delete historical results.

Correct the experiment representation.

Each variant must independently specify:

```ts
{
  app: {
    displayName,
    subtitle
  },

  tools: [
    {
      logicalCapability: "domains.check_exact",
      exposedName,
      title,
      description,
      inputSchema
    }
  ]
}
```

The logical capability remains stable.

The model-facing representation varies.

Then evaluate dimensions independently where possible:

1. app display name
2. subtitle
3. tool name
4. tool description
5. parameter name/description
6. tool-count/surface composition

Then evaluate dimensions independently where possible:

1. app display name
2. subtitle
3. tool name
4. tool description
5. parameter name/description
6. tool-count/surface composition

---

# 8. Establish eval tiers

Current lexical selectors are useful but must never be described as ChatGPT-routing evidence.

Rename/label them clearly.

## Tier 0 — deterministic lint/proxy

Purpose:

* schema regressions
* obvious overlap
* lexical density
* smoke tests
* CI

Includes:

* keyword selector
* lexical similarity selector
* schema gates

These are cheap and deterministic.

## Tier 1 — actual model tool selection

Use real tool definitions supplied through the tool interface.

Test relevant OpenAI models.

For every utterance capture:

```json
{
  "prompt": "...",
  "expected_tool": "...",
  "selected_tool": "...",
  "arguments": {},
  "model": "...",
  "model_snapshot": "...",
  "timestamp": "..."
}
```

Run repeated trials where nondeterminism exists.

Metrics:

* tool-selection precision
* recall
* F1
* false-positive rate
* abstention accuracy
* argument extraction accuracy
* unnecessary-call rate

## Tier 2 — host-integrated ChatGPT tests

Actual ChatGPT Developer Mode / published app behavior.

Capture:

* prompt
* whether app was surfaced
* tool selected
* arguments
* tool latency
* result
* retries
* completion success
* host/device where available

## Tier 3 — production

Real use.

Never mix these tiers in one metric.

A lexical proxy score must never be displayed as though it were production invocation rate.

---

# 9. Build the domain corpus properly

The current domain corpus is only a harness smoke test.

Build at least the following classes.

### Exact positive

Examples:

* Is foo.com available?
* Has foo.ai been registered?
* Can I register foo.dev?
* Is foo.co.uk free?
* Check foo.xyz.

### Batch positive

* Which of foo.com, foo.ai, foo.dev is free?
* Check all these domains.
* Verify these 20 names.

### Generative + availability

* Find me an available domain for a dentist AI.
* Give me short available .com names.
* Find available alternatives to FooBar.

### Pure generative negatives

Should NOT call unless availability is requested:

* Give me funny company names.
* Brainstorm names for a pet app.
* What's a cool startup name?

### Educational negatives

* Why is .com valuable?
* What is RDAP?
* How does DNS work?
* Should startups buy .ai?

### Adjacent confusing negatives

* Is this trademark available?
* Is the company name available?
* Is @foo available on X?
* Can I register Foo Ltd?
* Who owns example.com?
* How much did example.com sell for?

### Ambiguous

* What about foo.com?
* Check Foo.
* Can I use Foo?
* Is Foo free?

Create separate:

```text
positives.jsonl
negatives.jsonl
ambiguous.jsonl
tool_selection.jsonl
parameter_extraction.jsonl
```

Do not generate thousands of trivial paraphrases and treat them as independent evidence.

Cluster templates and retain semantic diversity.

---

# 10. Fix production URL construction

Current discovery code can use:

```ts
http://${req.headers.host}
```

This is unsafe behind production proxies.

Introduce:

```text
PUBLIC_BASE_URL
```

as the canonical production origin.

Production must fail startup/deployment if it is absent.

Development may infer localhost.

Do not trust arbitrary incoming `Host` headers to construct canonical discovery URLs.

Tests must assert:

* JSON-LD uses HTTPS production origin
* manifest uses canonical host
* MCP URL exactly matches registry/submission URL
* website URL exactly matches canonical capability config

---

# 11. Rename the project away from `print`

Current:

```json
"name": "print"
```

and imports:

```text
@print/*
```

are obsolete and misleading.

Rename to something like:

```text
@agentcom/core
@agentcom/domains
@agentcom/evals
@agentcom/studio
@agentcom/http
```

or equivalent workspace package naming.

Do this once now before more verticals depend on it.

Also resolve:

```text
packages/domain
packages/domains
```

These names are too similar.

Use semantic names:

```text
packages/market-core
capabilities/domains
packages/evals
packages/studio
```

Avoid singular/plural distinctions as architecture.

---

# 12. Separate generic infrastructure from vertical code

Target:

```text
packages/
  protocol/
  evals/
  studio/
  telemetry/
  discovery/
  webmcp/
  mcp-runtime/

capabilities/
  domains/
  cancel-subscription/
  llm-prices/
```

Do not put Domain-specific code into generic router packages.

Do not put Print-specific code into AgentCom's package namespace.

The generic layer should know:

```text
CapabilityDefinition
ToolDefinition
SurfaceAdapter
EvalCase
Observation
```

It should not know:

```text
RDAP
Prodigi
PayPal cancellation
Companies House
```

---

# 13. Do not build a generic marketplace router yet

Preserve the idea.

Do not expand it.

The existing:

```text
intent
offers
capabilities
ranking
provider contract
```

could eventually be valuable.

But right now the higher-priority experiment is:

> Can AgentCom repeatedly produce tiny apps ChatGPT selects naturally?

Freeze broad marketplace work until at least:

* Domain Availability is live
* Cancel Subscription is live
* LLM Price Compare or Handle Availability is live
* real invocation data exists

Then decide whether common market abstractions are genuinely shared rather than aesthetically shared.

Duplication across the first three products is acceptable if it teaches what should actually be abstracted.

---

# 14. Make `studio` the publication compiler

`packages/studio` is one of the strongest parts of the repo.

Tighten its responsibility.

Target CLI:

```bash
agentcom validate domains
agentcom compile domains
agentcom eval domains --tier=0
agentcom eval domains --tier=1 --model=<model>
agentcom experiment domains <experiment-id>
agentcom preflight domains
agentcom snapshot domains
```

`compile` should generate:

* frozen MCP tool schema
* submission packet
* WebMCP definitions
* HTTP/OpenAPI description
* discovery metadata

`validate` should compare all generated artifacts with the canonical contract.

`preflight` should additionally validate deployment state.

---

# 15. Fix preflight state

Current TypeScript `preflight` only ever feeds:

`ALL_FALSE_FLAGS`

so it cannot represent reality.

Create:

```text
registry/deployments/domains.json
```

or equivalent generated deployment state:

```json
{
  "production_url": "...",
  "verified_identity": false,
  "domain_verified": false,
  "scan_current": false,
  "privacy_complete": false,
  "demo_url_live": false,
  "checked_at": "..."
}
```

Where possible, have probes establish facts automatically.

Separate:

### MACHINE-CHECKABLE

* endpoint reachable
* TLS valid
* `/mcp` handshake
* `tools/list`
* domain challenge reachable
* privacy URL 200
* terms URL 200
* support URL 200
* schema equal to frozen artifact
* correct content types
* discovery URLs canonical
* latency

### HUMAN/PORTAL STATE

* verified publisher identity
* portal scan completed
* reviewer submission state

Do not make agents manually edit machine-verifiable booleans.

---

# 16. Add latency and reliability measurements

Every tool invocation should record:

```text
capability
tool
variant
host
started_at
duration_ms
success
failure_code
provider
cache_hit
```

Do not log unnecessary user content.

For domain checks record provider outcome, not full conversation.

Initial SLO:

```text
p50
p95
error rate
unknown rate
```

Most important metric for Domain Availability:

```text
confirmed-answer rate
```

A 200 response returning `unknown` is not product success.

---

# 17. Add deterministic failure taxonomy

No arbitrary error strings.

Define something like:

```ts
type FailureCode =
  | "INVALID_DOMAIN"
  | "UNSUPPORTED_TLD"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "AVAILABILITY_UNKNOWN"
  | "NO_CONFIRMED_SUGGESTIONS"
```

Every failure returns:

```ts
{
  code,
  message,
  retryable,
  suggestedNextAction?
}
```

This should feed:

* model behavior
* telemetry
* evals
* compatibility analysis

---

# 18. Submission packet must be generated, not maintained independently

Current packet quality is good.

The problem is divergence risk.

Generate:

`submissions/domains/plugin_spec.json`

and:

`submissions/domains/chatgpt-app-submission.json`

from the canonical capability definition.

Allow only a small hand-authored overlay for portal-only material if necessary.

CI should regenerate and fail on diff.

---

# 19. Correct output schema coverage

Audit every tool returning `structuredContent`.

Invariant:

> If structured data is returned to the host/model, its schema is explicit, narrow, versioned and tested.

The current Domain tools mostly do this.

Some Print tools currently return structured objects without corresponding explicit output schemas.

Do not ship those until fixed.

---

# 20. Re-review tool annotations behaviorally

Do not assign annotations according to name.

Assign them according to actual behavior.

Example:

`prepare_print_design`

currently appears to perform local validation/preparation.

If it:

* writes no external state,
* creates no persistent artifact,
* performs only computation,

then `readOnlyHint: false` may be incorrect.

Establish tests that assert:

```text
tool declaration
↔
actual capability side effects
```

For write tools additionally require:

* idempotency semantics
* confirmation expectations
* explicit side-effect description

---

# 21. Isolate Custom Print

Do not delete it.

Move it out of the Domain experiment.

It should eventually become:

```text
capabilities/custom-print/
```

with its own:

* MCP endpoint
* app identity
* privacy analysis
* commerce analysis
* packages
* schemas
* eval corpus
* provider adapters
* submission packet

It is a materially different risk/review class because it includes:

* physical commerce
* shipping PII
* write actions
* order state
* provider integrations

It must not increase review complexity for Domain Availability.

---

# 22. Add Cancel Subscription as capability #2

After Domain is clean, import the existing work from:

`prx0r/cancelme`

Do not rewrite its resolver.

The existing implementation already contains:

* state-aware resolution
* services/routes
* verification ladder
* evidence
* change detection
* MCP
* browser verification
* observations

The first AgentCom-facing surface should probably be only:

```text
find_cancellation_steps
identify_subscription_charge
```

Potential exact naming must be evaluated.

Do not expose:

```text
get_route
get_evidence
report_result
```

as model-facing tools merely because the backend has them.

Those remain internal.

Candidate app-name experiment:

```text
Cancel Subscription
Subscription Cancellation
Cancel a Subscription
CancelMe
```

Primary capability promise:

> Returns current, state-specific, country-aware steps for cancelling or exiting a consumer service.

Do not implement autonomous cancellation in v1.

Guide-only first.

---

# 23. Capability #3 should maximize contrast

After Cancel Subscription, add either:

### LLM Price Compare

developer / frequently changing numerical truth

or:

### Username Availability

consumer/developer crossover / simple multi-source live truth

This gives the experiment portfolio useful heterogeneity.

Do not launch ten capabilities before instrumentation works.

Three are sufficient to validate the factory.

---

# 24. Production experiments must become append-only

Preserve:

`registry/results/`

but formalize every result.

Each run should store:

```json
{
  "experiment_id": "...",
  "capability_version": "...",
  "surface_version": "...",
  "model": "...",
  "host": "...",
  "method": "...",
  "dataset_hash": "...",
  "started_at": "...",
  "metrics": {},
  "raw_result_path": "...",
  "limitations": []
}
```

Never overwrite a result.

Never silently change a corpus under an old experiment ID.

Hash corpora and schemas.

---

# 25. Separate platform facts from community hypotheses

The `intel/` structure is excellent.

Strengthen it.

Every intel item should include:

```text
status:
  official
  self_verified
  reproduced
  community_report
  hypothesis
  superseded

host
introduced_at?
last_verified
source
confidence
```

Do not label a community report `verified` merely because the community post exists.

“Verified source exists” and “behavior reproduced by us” are different claims.

Add:

```text
reproduction_status
```

if necessary.

---

# 26. Automate intel expiry

Platform behavior changes too quickly.

Add freshness policies.

Example:

```text
official spec:
    stale after 30 days

community host quirk:
    stale after 14 days

self-tested compatibility:
    stale after 7 days
```

A stale platform rule should produce a warning in submission preflight.

Do not automatically change runtime behavior from an unverified community report.

---

# 27. WebMCP belongs at the capability adapter layer

Keep WebMCP.

Do not build independent WebMCP business logic.

The exact same domain handler must serve:

```text
MCP
WebMCP
HTTP
website
```

Test equivalence.

For the same fixture:

```text
domain = example.test
```

the normalized semantic output should be equivalent regardless of transport.

Transport-specific metadata may differ.

Business truth may not.

---

# 28. Create a surface parity test

For every capability:

```text
canonical handler
       ↓
MCP
HTTP
WebMCP
```

Given equivalent input, assert the semantic response agrees.

This is crucial as surfaces multiply.

Do not test exact serialization equality if transports require different envelopes.

Test canonical normalized result equality.

---

# 29. Security basics before public deployment

For each public read-only micro-app implement:

* input length limits
* request body caps
* timeouts
* provider timeouts
* bounded concurrency
* rate limiting / abuse protection where appropriate
* no arbitrary URL fetching
* no raw upstream error leakage
* no secrets in structured output
* no stack traces
* request IDs kept server-side
* production security headers for website surfaces

No need to overbuild auth for Domain Availability.

It should remain public/read-only for the experiment.

---

# 30. Do not mix analytics with model-visible schemas

Internal telemetry fields such as:

```text
trace_id
request_id
experiment_bucket
provider_latency
cache_status
```

must remain server-side or host-hidden where supported.

Do not return them as `structuredContent` merely because they are useful to us.

Keep the model-facing result clean.

---

# 31. Domain output should become intentionally boring

Ideal:

```json
{
  "domain": "example.com",
  "status": "registered",
  "checked_at": "...",
  "source_type": "registrar"
}
```

Avoid opaque internal scoring unless the user asked for it.

Avoid giant provider dumps.

```

or:

```json
{
  "domain": "something.dev",
  "status": "available",
  "checked_at": "...",
  "source_type": "registrar",
  "registration_price": {
    "amount": 12.00,
    "currency": "USD"
  }
}
```

Never claim RDAP-only results as registrar-confirmed.

```json
{
  "domain": "new-tool-xyz123.com",
  "status": "available",
  "checked_at": "...",
  "source_type": "rdap",
  "confidence": "medium"
}
```

Never reuse the earlier internal availability field design without review.


# 32. Reconsider `checkedAt` removal

The MCP implementation deliberately drops `checkedAt`.

For live-data products, freshness is part of the product truth.

Do not automatically remove it.

There is a distinction between:

* debug timestamp
* meaningful “as of” timestamp

For Domain Availability and LLM Price Compare, freshness may materially matter.

Use one clean field such as:

```text
checked_at
```

if it improves trust.

Do not emit multiple internal timestamps.

---

# 33. Add provider corroboration tests

For domains, create fixtures where sources disagree.

Example:

```text
RDAP: no registration record
registrar A: unavailable
registrar B: available
```

Define deterministic policy.

Possible result:

```text
status: unknown
reason: conflicting_sources
```

Do not silently choose the answer favorable to conversion.

AgentCom's brand should be:

> authoritative tiny truths

not:

> optimistic answers.

---

# 34. Studio should optimize for multi-objective success

Do not optimize only F1.

Track:

```text
routing_precision
routing_recall
false_positive_rate
argument_accuracy
completion_success
latency
confirmed_truth_rate
retry_rate
```

Later, utility:

```text
utility =
routing_success
× execution_success
× truthful_answer
× completion
```

Eventually, when enough real data exists.

---

# 35. Do not optimize against one model forever

Tool routing behavior will change with model generations.

Experiment records must pin model identity.

When a major model changes:

* rerun canonical routing suite
* compare regression
* do not overwrite prior benchmark
* consider re-optimizing descriptions

Metadata is effectively model-facing code.

Treat it like code.

---

# 36. Use FinalBuilds2 to choose what enters `/plugin`

Add a simple promotion artifact to `finalbuilds2`, e.g.:

```json
{
  "capability_id": "cancel.subscription",
  "promotion_status": "approved",
  "target_repo": "prx0r/plugin",
  "reason": "...",
  "source_backend": "prx0r/cancelme"
}
```

Then `/plugin` imports/builds the publishable wrapper.

Do not make `/plugin` itself become another ideabank.

---

# 37. Near-term directory target

Aim for approximately:

```text
plugin/
├── capabilities/
│   ├── domains/
│   │   ├── capability.ts
│   │   ├── handler.ts
│   │   ├── providers/
│   │   ├── evals/
│   │   └── tests/
│   └── cancel-subscription/
│
├── packages/
│   ├── mcp-runtime/
│   ├── webmcp/
│   ├── http/
│   ├── discovery/
│   ├── evals/
│   ├── telemetry/
│   └── studio/
│
├── registry/
│   ├── experiments/
│   ├── results/
│   ├── deployments/
│   └── compatibility/
│
├── intel/
└── docs/
```

Do not perform directory churn merely for aesthetics.

Perform it where it creates single ownership and generation boundaries.

---

# 38. P0 implementation order

Execute in this order.

## P0.1 — Freeze broad feature work

No new vertical features.

## P0.2 — Fix correctness

* unknown != available
* honest RDAP wording
* canonical hostname
* production HTTPS base URL

## P0.3 — Split public servers

* Domain isolated
* Print isolated

## P0.4 — Establish canonical capability definition

Generate current domain artifacts from it.

## P0.5 — Rename `@print/*`

Move to AgentCom namespace.

## P0.6 — Repair eval methodology

* accurately label lexical proxy
* experiment actually changes selected variable
* invalidate misleading historical interpretation, not historical file

## P0.7 — Create actual-model eval runner

Store immutable output.

## P0.8 — Expand domain eval corpus

Semantic diversity first.

## P0.9 — Make preflight real

Machine probes + separately recorded human portal state.

## P0.10 — Production telemetry

Minimal, privacy-preserving, useful.

---

# 39. Domain v1 definition of done

Do not move to Cancel Subscription until all are true:

* Domain capability has independent deployment.
* Public endpoint contains no Print tools.
* MCP `tools/list` exposes only intended Domain tools.
* Production hostname is canonical everywhere.
* HTTPS discovery metadata is correct.
* Unknown lookup results never masquerade as available.
* Public wording matches actual evidence quality.
* Registrar-grade availability is used where available.
* Canonical capability contract generates frozen artifacts.
* Schema drift CI exists.
* Positive/negative/ambiguous eval corpus exists.
* Tier-0 deterministic tests pass.
* Tier-1 real-model benchmark has been run.
* Preflight automatically checks machine-verifiable deployment facts.
* Selection and execution telemetry schema exists.
* Privacy/support/terms URLs are represented in deployment config.
* No internal provider operation is model-visible.
* README documents one command for local validation.
* README documents one command for capability compilation.
* README documents one command for model routing eval.

---

# 40. What not to do

Do not:

* create one enormous AgentCom plugin
* add more providers for the sake of architecture
* add UI to Domain Availability unless usage demonstrates it helps
* build an AgentCom marketplace yet
* expose backend primitives because they already exist
* claim lexical-similarity results are ChatGPT results
* claim RDAP absence means guaranteed purchasability
* return unknowns as available
* manually duplicate schemas across five surfaces
* let `plugin` and `finalbuilds2` become competing control planes
* optimize metadata before collecting sufficiently varied evals
* make speculative community findings hard runtime requirements without verification

---

# 41. What to preserve

Do preserve and strengthen:

* `intel/`
* append-only compatibility history
* frozen schemas
* capability experiments
* `studio`
* negative evals
* minimal read-only initial capabilities
* intent-language tool descriptions
* provider abstraction beneath semantic tools
* WebMCP as an adapter
* submission preflight
* AgentCom publisher identity
* FinalBuilds2 integration

These are the strongest parts of the repository.

---

# 42. Final architectural principle

AgentCom is not initially a marketplace.

AgentCom is not initially a giant MCP server.

AgentCom is:

> A factory for extremely legible, authoritative capabilities that models can invoke at exactly the moment their pretrained knowledge stops being sufficient.

The initial moat is the feedback loop:

```text
find capability gap
        ↓
publish tiny authoritative tool
        ↓
measure model selection
        ↓
measure execution truth
        ↓
optimize interface
        ↓
bank empirical routing data
        ↓
repeat
```

Build the repository around making that loop faster, cleaner and more scientifically measurable.

Once that loop works across Domain Availability, Cancel Subscription and one third contrasting capability, reconsider the larger AgentCom marketplace/router architecture using the evidence those products generated.

One particularly important change I would make before anything else is the **RDAP truth boundary**. The current code is structurally good but the product promise is slightly stronger than the evidence source. AgentCom becomes far more defensible if one invariant applies across every future tool: **never turn uncertainty into a prettier answer.** Domains say unknown when unknown; Cancel Subscription says stale when stale; LLM Prices say last verified when stale. That becomes the brand as much as the plugin distribution system.

[1]: https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.5&utm_source=chatgpt.com "Model guidance | OpenAI API"
