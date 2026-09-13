# Repository boundary — finalbuilds2 vs plugin (2026-09-13)

Governing rule: **finalbuilds2 owns the factory; plugin owns the
submission-grade surface layer.** Neither duplicates the other.

## finalbuilds2 answers: what should exist, and did it work?

Owns: capability discovery, ideabank, opportunity scoring, cross-product
lineage, prioritization, experiment outcomes across products, promotion and
kill/continue decisions, long-run factory analytics.

Source of truth: `registry/sites/<x>.json` **declarative desired state**
(display identity, capabilities, allowed surfaces, auth class, risk class,
intended tools, policy profile).

## plugin answers: how is an approved capability exposed and optimized?

Owns: canonical capability contracts, tool definitions, MCP/WebMCP/HTTP
transports, discovery metadata, routing evals, metadata experiments,
submission packets, compatibility checks, invocation telemetry, platform
intel, schema version artifacts.

Holds **operational surface state** (deployment URLs, scan timestamps,
submission IDs, review outcomes, benchmark runs, compatibility results) —
ephemeral portal/run state never flows upstream into the business manifest.

## Promotion flow

```text
finalbuilds2 candidate → approved (promotion record lives in finalbuilds2)
        ↓
plugin builds the publishable wrapper (adapter, never a fork of the kernel)
        ↓
telemetry + eval results flow back to finalbuilds2 attribution
```

CancelMe rule (applies to every backend): adapt the canonical kernel in
place; `/plugin` contains surfaces only, never a second database, resolver,
crawler, or evidence store.

## Disputes

New shared concept? Define it once in finalbuilds2 ontology, reference from
plugin. Submission rule? Lives in plugin intel + gates, summarized upstream
only when it changes promotion criteria. When in doubt, the repo that would
duplicate data loses.
