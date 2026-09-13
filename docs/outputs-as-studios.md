# Outputs-as-studios — canonical spec (2026-09-13)

Thesis: finalbuilds2 owns the factory (capability ontology, event-sourced
builds, experiments, attribution, standards reconciliation, multi-surface
manifests). Our repo owns the submission-grade surface layer (live MCP,
deterministic evals, hill-climb, packets, schema freeze, intel). Neither gets
rebuilt. Each output surface becomes a mini-studio compiling one capability
definition; studios share eval corpora, telemetry shape, and registry.

## Division of ownership (frozen to stop duplication)

| Layer | Owner | Notes |
|---|---|---|
| Capability ontology, factory, resolver | finalbuilds2 | Lexical resolver stays; selection quality is measured, not assumed |
| Experiment engine + attribution | finalbuilds2 | stableBucket assignment, compareMeans, lineage; our selection events feed it |
| Forecast/resolution calibration | finalbuilds2 | Untouched |
| Registry/sites manifests | finalbuilds2 | Source of capability truth; we read, never fork |
| Bundle validation rules | finalbuilds2 target-state | Our lint stays as fast CI mirror, theirs canonical |
| Live MCP transport + evals + hill-climb | print repo | Schmidt: no second MCP stack in finalbuilds2 |
| Submission packets + schema freeze | print repo | Generated from manifests + live server |
| Intel + watchlist | print repo | Single store; finalbuilds2 links, doesn't duplicate |

## Capability record (unified, two homes)

finalbuilds2 `registry/sites/<x>.json` remains the business record (product,
capabilities, interfaces, standards, sensors, automation). Print repo holds
only surface derivatives: `submissions/<x>/`, `schemas/<x>/vN.json`,
`registry/results/`. Mapping is mechanical: manifest `chatgpt.tools[]` →
spec tools; `chatgptTestCases` → packet tests; `interfaces` flags → which
studios run. Any field needed by a studio but missing from the manifest gets
added to the manifest first — never side-carried.

## The four surface studios (one pattern, four rulebooks)

Each studio implements creator / evaluator / publisher / optimizer against
its surface's rules. Our `packages/studio` is the ChatGPT-plugin instance;
generalize by parameterizing rules, not by forking code.

```
capability core (kernel + adapters, no surface imports)
   ├── chatgpt-studio   annotations, 5+3 tests, listing limits, scan, challenge
   ├── webmcp-studio    declarative+imperative packaging, origin-trial checks,
   │                    registration verification (scheduled, webhook-grade)
   ├── x402-studio      pricing, receipts, facilitator checks, Bazaar discovery
   └── website-studio   capability pages, JSON-LD, llms.txt, indexability
```

New surfaces follow the established packaging seam: `<surface>` block in the
site manifest + `<surface>-package.mjs` reader + target-state section +
queue-gate entry + tests mirroring the 5+3/green pattern. x402 work starts
from the existing capability string, not a new design.

## Shared across studios (the actual moat)

1. **One eval corpus per capability**, run per surface: same queries measured
   as ChatGPT selection, WebMCP invocation, API completion. Surface deltas
   are findings, not noise.
2. **One telemetry event shape**: our `tool-selected` event extends their
   Observation model (prompt, predicted, expected, toolVersion, host). Host
   field carries surface; variant field carries metadata version. Both
   attribution systems read the same stream.
3. **Schema freeze per surface per version**: `schemas/<cap>/<surface>/vN.json`
   asserted equal to live in CI. Backend iterates; surfaces don't drift.
4. **H1 + commerce gates run before every studio**, not just ChatGPT:
   capability must clear external-truth + tiny-output + policy on each surface
   it ships. EXCLUDED list is global (email.send doesn't become fine on x402).

## Convergence order (cheapest learning first)

0. **Read-only bridge**: studio ingests finalbuilds2 manifests + target-state
   rules; zero writes to finalbuilds2. Prove the mapping on domains.
1. **Domain convergence**: A-COM backend (registrar pricing) + RDAP as
   adapters behind the frozen 3-tool surface; run the naming experiment;
   submit Domain Availability. Kills the two-implementation problem first.
2. **CancelMe wrap**: clone prx0r/cancelme; two-tool guide-only surface in
   our repo reusing the kernel; evidence/confidence pass through as
   qualityScore inputs. Destructive actions stay out pending explicit
   OAuth + confirmation design.
3. **LLM Price Compare**: thin adapter over existing feeds;
   compare_llm_prices; developer repeat-use loop.
4. **WebMCP + x402 studios**: build packagers on the proven pattern once two
   ChatGPT surfaces are live. Website studio last (pages already exist).

## Stop rules

- No new capability until the open experiments teach something (matrix:
  consumer/developer, live/deterministic, single/multi-step, lookup/stateful,
  frequent/occasional, generic/exact naming).
- No second implementation of anything that exists: adapters, not forks.
- No surface ships without its 5+3 (or surface equivalent) green.
- No UI state dependencies until compatibility.json shows three consecutive
  green weeks on update-model-context paths.
