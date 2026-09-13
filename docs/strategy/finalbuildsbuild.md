# FinalBuilds2 → first-wave experiments (saved 2026-09-13)

Distinguish "interesting startup" from "perfect first AgentCom experiment":
obvious intent, ChatGPT currently weak, deterministic/live truth, tiny schema,
few tools, little/no auth, fast, measurable success.

## Ranked first wave

| Rank | Capability | Readiness | Why |
|---|---|---|---|
| 1 | Cancel Subscription / CancelMe | Already built | Explicit intent; stale info; ChatGPT gives outdated/wrong paths |
| 2 | Domain Availability | Nearly submission-ready | Canonical live-data gap; binary truth; schemas/tests/MCP exist |
| 3 | LLM Price Compare | Existing product/data (94/100 unbundling) | Prices change constantly; cheapest-inference unknowable to weights |
| 4 | Handle Availability | Backend primitives exist | Live cross-platform username check; ideal one-call query |
| 5 | Company Name / Company Check | Mostly composition | Companies House truth + domains + socials = brand-start workflow |
| 6 | Stack Check | Easy | Deterministic tech fingerprint; extremely agent-composable |
| 7 | MCP Health / MCP Trust | Already in `unbundled` | Timely dev tool given MCP explosion |
| 8 | Tool Price | Existing capability | Cost-aware tool selection; potential infrastructure |
| 9 | Warranty Guide / Claims | Existing capability | High-friction rules + product truth; conversational fit |
| 10 | Landed Cost | Existing capability | ChatGPT lacks authoritative duty/tax/live rules |
| 11 | Returns | Existing capability | Same structural advantage as CancelMe |
| 12 | Invoice Normalizer | — | Great utility, but ChatGPT parses invoices OK alone; tie to schemas |
| 13 | Product Fit Checker | Concept | Massive if compatibility graphs acquired |
| 14 | Property Facts | Concept | Useful but data/implementation complexity rises |
| 15 | Quote Checker | Concept | High value, hard local benchmark data |

## 1. CancelMe as second app

`prx0r/cancelme`: "a machine-readable, continuously verified database of how
to escape unwanted consumer-service states." Pipeline: service + intent +
state → verified route → steps → claims + evidence → confidence/recency.
Five MCP tools: resolve, identify_biller, get_route, get_evidence,
report_result. Intents beyond cancel: stop_billing, recover_access,
get_refund, exit_contract, return_equipment. Killer tool: `identify_biller`
(card descriptor → company → subscription → cancel route).

Moat already present: verification ladder (discovered → documented →
navigated → flow_verified → transaction_verified → field_verified) with
recency decay. Killer response shape: route + last-verified + confidence +
country + account state + method + ETA. Browser verification architecture
with screenshots/DOM/network evidence exists.

Simplify the ChatGPT surface to two tools: `find_cancellation_steps(service,
country?, billing_method?, account_state?)` + `identify_subscription_charge
(statement_descriptor)`. Keep get_evidence/get_route/report_result private.
App-name candidates to eval (literal wins per discovery alpha): "Cancel
Subscription", "Subscription Cancellation", "Cancel a Subscription",
"CancelMe", "Subscription Help". V2 (authenticated cancellation) later; V1
guide needs no auth.

## 2. Domain Name Assistant first (controlled experiment)

finalbuilds2 already holds check_domain_availability, search_available_domains,
compare_domain_prices, score_domain_name, bulk_search_available_domains +
schemas, annotations + justifications, starter prompts, 5+/3- tests, listing
copy, MCP, REST, Cloudflare Worker, custom domain, live registry integrations.
Question whether five tools are needed for v1 — perhaps
check_domain_availability + find_available_domains only.

## 3. LLM Price Compare (developer repeat-use)

Existing: llm.deals.aggregate, llm.pricing.compare, llm.inference.economics;
feeds /api/v1/top.json, deals.json, changes.json. One tool:
compare_llm_prices(model?, task?, input_tokens?, output_tokens?,
requirements?). Questions it answers: cheapest API for model X, bulk-token
sourcing, OpenRouter-vs-direct, sub-$0.20/M inference.

## 4. Handle Checker

Backend exists (checkHandles, apifySocialCheck, suggestHandles,
fullSocialCheck). `check_username_availability(username, platforms?)` → per-
platform availability grid. Cross-sells domains without merging apps.

## 5. Company + Domain + Handle composition

"I'm starting a company called Bloop" → Company Name Check + Domain
Availability + Username Availability → brand report. ChatGPT orchestrates;
we supply Lego bricks, not a super-app.

## 6. StackCheck

`detect_website_technology(url)` → stack fingerprint (Shopify, Cloudflare,
Next.js, Stripe…). High composability, low willingness-to-pay; utility layer.

## 7. site_platform extractions (separate apps, not one)

MCP Health: `check_mcp_server(url)` — connect, tools/list, protocol,
latency, auth. MCP Trust: `inspect_mcp_server(url)` — permissions, dangerous
actions, domains, metadata (a plugin that evaluates plugins). ToolPrice:
`compare_tool_cost(capability)` toward capability routing. Warranty: product +
purchase + issue → applicable warranty → claim route. Returns: merchant +
product + date + country + condition + channel → eligibility.

## 8. Infrastructure cluster (protect, launch later)

agentmanifest / capabilitycard / registrylens: inspect_agent_manifest,
generate_capability_card, search_capability_registry. AgentCom helping agents
understand the app ecosystem; after Domains/Cancel/Prices.

## 9. FitChecker (later, conditional)

product A + product B + compatibility graph = YES/NO/CONDITIONS. Needs an
open compatibility dataset to jump the queue.

## 10. Factory alignment

finalbuilds2 core (deterministic experiments, attribution analytics,
capability resolver, standards reconciliation; resolver smoke-tested at 10k
capabilities) ≈ the system derived from the Apps SDK rabbit hole. Repurpose
as experiment control plane: capability → schema/description/name variants →
host adapters → ChatGPT/WebMCP/MCP/API → telemetry → invocation success →
attribution.

## Launch order

1. Domain Availability (reference/instrumentation)
2. Cancel Subscription (consumer intent)
3. LLM Price Compare (developer repeat-use)
4. Username Availability (tiny/clean)
5. Company Name Check (authoritative truth)
6. MCP Health Check (ecosystem/dev acquisition)
7. Website Technology Check (composability)
8. Warranty Checker (rule resolution)
9. Return Eligibility (rule resolution)
10. MCP Trust (infrastructure)

Ten products span consumer/developer, live/deterministic, single/multi-step,
lookup/stateful, frequent/occasional, generic/exact naming — enough matrix to
discover what ChatGPT distribution rewards. No new ideas until these teach us.
CancelMe needs only ChatGPT-native two-tool simplification + AgentCom
instrumentation: cheap experiment, obvious problem.
