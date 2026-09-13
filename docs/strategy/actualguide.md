# Operating runtime — combined architecture verdict (saved word-for-word 2026-09-13)

Yours is **better as the governing architecture**. Mine was better as a
**correctness/refactor checklist**.

I would adopt your “outputs-as-studios” spec as the northstar and merge several of my stricter implementation rules into it. Your version solves the biggest architectural problem more cleanly: **it does not invent a second capability system inside `/plugin`.**

The strongest line is:

> `finalbuilds2` owns the factory; `/plugin` owns the submission-grade surface layer.

That is cleaner than my proposal to create another canonical `CapabilityDefinition` inside `/plugin`.

## Where yours beats mine

Your ownership model is much stronger.

My design risked this:

```text
finalbuilds2 manifest
        ↓
plugin CapabilityDefinition
        ↓
generated artifacts
```

which quietly creates **two representations of the same capability**.

Yours instead says:

```text
finalbuilds2 registry/sites/<x>.json
        │
        │ source of truth
        ▼
surface studio
        │
        ├── submission
        ├── schema snapshot
        ├── eval result
        └── deployment artifact
```

That's superior.

Especially good:

**“Any field needed by a studio but missing from the manifest gets added to the manifest first — never side-carried.”**

That is exactly the invariant that prevents `/plugin` slowly mutating into `finalbuilds3`.

Your four-studio abstraction is also better than my generic “surface adapter” language:

```text
ChatGPT Studio
WebMCP Studio
x402 Studio
Website Studio
```

because each genuinely has a **different rulebook, packaging process, validation regime and optimization target**.

“Studio” is a useful abstraction.

---

# The combined architecture I would use

```text
                    FINALBUILDS2
             capability/factory truth
                      │
                      │ manifest
                      ▼
               ┌───────────────┐
               │ Surface Studio │
               └───────┬───────┘
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
   creator         evaluator        publisher
       │               │                │
       └────────── optimizer ────────────┘
                       │
                       ▼
                 frozen output
```

Then:

```text
                       capability
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
         ChatGPT         WebMCP         x402
          Studio          Studio         Studio
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                      observations
                           │
                           ▼
                    FINALBUILDS2
                attribution/learning
```

That's very strong.

---

# But I would change six things in your spec

## 1. “One eval corpus per capability, run per surface” needs qualification

This is almost right, but not literally one identical corpus.

You want a **shared semantic corpus** plus **surface-specific projections**.

For example:

```text
INTENT:
"Is pogtown.com available?"
```

works naturally for ChatGPT selection.

But WebMCP isn't necessarily solving:

> should the model discover our remote app?

It may already be on the page and deciding which page tool to invoke.

x402 may have no model selection step whatsoever—the caller may directly know the endpoint.

So define:

```text
evals/domains/
    semantic.jsonl
    chatgpt/
        selection.jsonl
        negatives.jsonl
    webmcp/
        invocation.jsonl
        registration.jsonl
    http/
        contract.jsonl
    x402/
        payment.jsonl
        completion.jsonl
```

The **semantic intents are shared**.

The **measurement isn't forced to be identical**.

Your phrase:

> “Surface deltas are findings, not noise.”

is excellent; keep that.

---

# 2. The global commerce/policy gate is too strong

This line needs adjustment:

> EXCLUDED list is global (`email.send` doesn't become fine on x402).

I understand the intention, but this conflates **capability risk** with **surface policy**.

`email.send` might be inappropriate for one ChatGPT publication configuration while being completely legitimate through:

* authenticated API,
* MCP with explicit confirmation,
* private enterprise integration,
* some future machine-payment flow.

Likewise ChatGPT's commerce restrictions are not automatically the x402 protocol's restrictions.

Instead use two layers:

```text
CAPABILITY RISK
     +
SURFACE POLICY
```

Example:

```json
{
  "capability": "email.send",
  "risk": {
    "external_side_effect": true,
    "destructive": false,
    "requires_auth": true,
    "requires_confirmation": true
  }
}
```

Then:

```text
ChatGPT Studio
    ↓
policy decision

x402 Studio
    ↓
different policy decision

Private MCP
    ↓
different policy decision
```

Don't globally ban things merely because ChatGPT doesn't want them.

What should be global are **truth/safety invariants**, such as:

* never hide side effects,
* never bypass authorization,
* never misrepresent completion,
* never leak credentials.

---

## 3. “Website Studio last” is the one sequencing decision I disagree with most

Your reasoning is understandable:

> pages already exist.

But the website surface is operationally entangled with ChatGPT publication:

* publisher identity
* privacy
* terms
* support
* domain ownership
* challenge path
* capability landing page
* canonical URLs
* agent discovery
* JSON-LD
* WebMCP later

So I would make Website Studio **minimal early**, not “last”.

Order:

```text
0 bridge
1 domain kernel convergence
2 minimal website studio
3 ChatGPT submission
4 CancelMe
5 LLM Prices
6 WebMCP
7 x402
```

The first Website Studio can be incredibly boring:

```text
/
 /privacy
 /terms
 /support
 /.well-known/openai-apps-challenge
 /capability.jsonld
 /llms.txt
```

You don't necessarily even need SEO content yet.

No fancy UI.

Then extend it later.

---

# 4. “Clone prx0r/cancelme” contradicts your own strongest rule

You wrote:

> No second implementation of anything that exists: adapters, not forks.

Then:

> CancelMe wrap: clone `prx0r/cancelme`

Don't clone it into `/plugin`.

Do this:

```text
prx0r/cancelme
      │
      │ canonical domain/kernel implementation
      ▼
cancel adapter
      │
      ▼
ChatGPT Studio
```

The plugin repo can contain:

```text
surfaces/cancel-subscription/
```

but should not absorb CancelMe's:

* database
* resolver
* verification engine
* crawler
* evidence store.

Otherwise six months later you'll fix a cancellation resolver bug in one place and forget the other.

---

# 5. I'd make the surface manifest relationship slightly less absolute

This statement is elegant:

> Any field needed by a studio but missing from the manifest gets added to the manifest first.

Mostly yes.

But beware turning `finalbuilds2/registry/sites/foo.json` into a gigantic dump of every OpenAI-specific ephemeral parameter.

For example, I would not necessarily put:

```text
OpenAI portal scan timestamp
review case ID
current submission status
temporary domain verification token
last MCPJam benchmark
Chrome origin-trial token
```

into the canonical business manifest.

Distinguish:

### Declarative desired state

Belongs in FinalBuilds2.

```text
display identity
capabilities
allowed surfaces
auth class
risk class
intended tools
policy profile
```

### Operational surface state

Belongs in the studio.

```text
deployment URL
scan timestamp
submission ID
review outcome
benchmark run
compatibility result
```

So:

```text
finalbuilds2
    desired state

plugin
    observed/compiled surface state
```

That distinction is cleaner than “literally every studio field must go upstream.”

---

# 6. Your schema-freeze idea is excellent, but freeze semantic contracts separately from surface schemas

You propose:

```text
schemas/<cap>/<surface>/vN.json
```

Keep that.

But also freeze something above the surfaces:

```text
schemas/<cap>/canonical/vN.json
```

For example:

```text
DomainCheckResult
```

should not independently mutate across:

```text
ChatGPT
WebMCP
HTTP
x402
```

You ideally have:

```text
canonical truth contract
       ↓
surface serialization
```

So:

```text
schemas/domains/
    canonical/v1.json
    chatgpt/v1.json
    webmcp/v1.json
    http/v1.json
    x402/v1.json
```

Now you can detect two kinds of drift:

**business truth drift**

versus

**surface representation drift**.

---

# One other important thing missing from yours: truth semantics

This is the biggest part of my previous review that I would absolutely merge into your spec.

For each capability, define an explicit epistemic state.

Domains:

```text
available
registered
unknown
conflicting
unsupported
```

CancelMe:

```text
documented
navigated
flow_verified
transaction_verified
stale
unknown
```

LLM Prices:

```text
verified_current
recent
stale
unknown
```

This should be a **factory-wide invariant**:

> A studio may change presentation, but it may never upgrade the epistemic strength of the underlying fact.

For example:

```text
RDAP says no record

❌ "Available to register"

✓ "No current registration record found"
```

unless registrar evidence confirms availability.

That could become one of AgentCom's defining properties.

---

# I'd also change the convergence order slightly

Your version:

```text
0 bridge
1 domains
2 CancelMe
3 LLM prices
4 WebMCP + x402
website last
```

Mine would now be:

```text
0. READ-ONLY BRIDGE
   finalbuilds2 → studios

1. DOMAIN TRUTH CONVERGENCE
   cmail/A-COM registrar truth + RDAP
   fix uncertainty semantics

2. WEBSITE MINIMUM
   agentcom.org ownership/policy/discovery scaffolding

3. CHATGPT DOMAIN STUDIO
   submit + gather actual routing data

4. CANCEL SUBSCRIPTION
   adapter over existing CancelMe kernel
   two model-facing tools

5. LLM PRICE COMPARE
   contrasting developer/live-numerical capability

6. WEBMCP STUDIO
   now test shared semantic corpus across website-agent surface

7. x402 STUDIO
   monetize established useful primitives

8. ONLY THEN
   reconsider broader router/marketplace abstractions
```

That produces useful learning earlier.

---

# One major thing your architecture gets exactly right

This sentence:

> “generalize by parameterizing rules, not by forking code.”

Yes.

That should be a hard engineering principle.

I would structure Studio roughly as:

```ts
Studio<SurfaceRules>
```

Conceptually:

```text
                 Studio Engine
                      │
       ┌──────────────┼───────────────┐
       │              │               │
    creator        evaluator       publisher
       │              │               │
       └────────── optimizer ──────────┘
                      │
                 SurfaceRules
```

Then:

```text
ChatGPT rules
WebMCP rules
x402 rules
Website rules
```

Not:

```text
chatgpt-studio-copy/
webmcp-studio-copy/
x402-studio-copy/
```

That's the right abstraction.

---

# I'd also sharpen your telemetry design

Your unified event shape should become broader than `tool-selected`, because some surfaces won't have tool selection.

Something like:

```json
{
  "event": "surface_attempt",
  "capability": "domains.check",
  "surface": "chatgpt",
  "surface_version": "v3",
  "variant": "availability-b",
  "host": "chatgpt",
  "model": "...",

  "intent_id": "...",

  "selection": {
    "expected": "check_domain_availability",
    "actual": "check_domain_availability"
  },

  "execution": {
    "success": true,
    "duration_ms": 282,
    "truth_status": "confirmed"
  },

  "completion": {
    "success": true
  }
}
```

WebMCP can leave model-selection fields absent.

HTTP can leave them absent.

x402 adds:

```text
payment_attempted
payment_success
price
receipt
```

Then FinalBuilds2 ingests one observation family.

That's cleaner.

---

# I'd add one more studio: Compatibility Studio, but not as a user surface

Not a distribution target.

An internal studio.

Because the rabbit hole showed how quickly behavior diverges by:

* ChatGPT
* Claude
* browser
* MCP client
* mobile
* desktop
* MCP Apps version

So internally:

```text
compatibility-studio
      ↓
capability × host × feature probes
      ↓
compatibility.json
```

This is where Gavin-style pathological probe apps live.

It doesn't publish products.

It tests environments.

---

# The resulting model is extremely clean

```text
                    FINALBUILDS2
                  Factory / ontology
                        │
                        ▼
               Capability Manifest
                        │
             canonical semantic contract
                        │
       ┌────────────────┼─────────────────┐
       ▼                ▼                 ▼
 ChatGPT Studio     WebMCP Studio      x402 Studio
       │                │                 │
       └────────────┬───┴────────────┬────┘
                    ▼                ▼
                Website         Compatibility
                 Studio             Studio
                    │                │
                    └──────┬─────────┘
                           ▼
                       telemetry
                           │
                           ▼
                     FINALBUILDS2
                  attribution / learning
```

That's stronger than either document independently.

## Verdict

I'd score:

**Your version: 9/10 architecture, 7.5/10 operational specificity.**

**My earlier version: 8/10 architecture, 9/10 operational/correctness specificity.**

The combined version is the one to implement.

The main things to import from my previous brief are:

1. **split Domain and Print public MCP surfaces**
2. **fix unknown ≠ available**
3. **registrar truth vs RDAP truth**
4. **repair the misleading current naming experiment**
5. **actual-model eval tiers**
6. **canonical production URLs**
7. **rename `@print/*`**
8. **operational preflight probes**
9. **surface parity tests**
10. **explicit truth-state semantics**
11. **immutable experiment records**
12. **surface-specific policy rather than globally banning capability classes**

And keep virtually all of your **outputs-as-studios ownership model**.

That is now the clearest architecture I've seen for this project.
