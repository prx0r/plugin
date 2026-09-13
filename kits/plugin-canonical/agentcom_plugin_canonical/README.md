# AgentCom Plugin Canonical Kit

Version: 2026-09-13

A machine-readable and agent-usable conformance kit for building, evaluating, and submitting OpenAI ChatGPT/Codex plugins backed by remote MCP servers.

This kit separates:

- **HARD**: current OpenAI submission/policy requirements that should block release when violated.
- **GUIDANCE**: current official recommendations that materially improve reliability/reviewability.
- **ALPHA**: high-signal OpenAI staff/community observations that are useful but can change quickly.
- **HEURISTIC**: AgentCom operating rules inferred from the evidence; useful for optimization, not platform policy.

The central principle is: **own a narrow external capability that ChatGPT cannot reliably do natively, expose it through a tiny intent-aligned tool surface, and make the implementation boring, fast, auditable, authorized, and easy to review.**

## Start here

1. Read `CANONICAL_GUIDE.md`.
2. Copy `templates/plugin_spec.template.json` into your project as `plugin_spec.json` and fill it from source truth.
3. Run:

```bash
python checks/plugin_lint.py plugin_spec.json
```

4. Fix every `ERROR`. Treat `WARN` as a release blocker unless explicitly waived with evidence.
5. Generate/maintain routing evals using `evals/` and `prompts/ROUTING_EVAL_AGENT.md`.
6. Before submission, run `prompts/SUBMISSION_REVIEW_AGENT.md` against the actual MCP source implementation, not only the manifest.
7. Use OpenAI's official `chatgpt-app-submission` skill when available to produce the final `chatgpt-app-submission.json`.

## Files

- `CANONICAL_GUIDE.md` — human-readable canonical operating guide.
- `CHECKLIST.md` — final submission-day human + agent gate.
- `data/submission_limits.json` — current numeric/package limits from official submission-error docs.
- `data/failure_modes.json` — official blockers + recurring community failure patterns with deterministic diagnostics.
- `schemas/provider_ledger.schema.json` — authorization/ToS/value-add ledger for every third-party provider.
- `sources/evidence_claims.jsonl` — flattened claim-level evidence corpus for agents/retrieval.
- `checks/validate_schema.py` — validates a plugin spec against the canonical JSON Schema.
- `data/requirements.json` — hard requirements and official guidance.
- `data/alpha.json` — staff/community alpha with confidence/freshness.
- `data/rubric.json` — weighted quality scoring rubric plus hard gates.
- `sources/source_index.json` — source ledger and evidence tiers.
- `schemas/plugin_spec.schema.json` — schema for our internal preflight manifest.
- `templates/plugin_spec.template.json` — copy/fill per plugin.
- `templates/chatgpt-app-submission.example.json` — review-facing example structure.
- `evals/` — tool-selection evaluation formats and examples.
- `checks/plugin_lint.py` — deterministic manifest linter.
- `checks/source_scan.py` — conservative source scanner for likely side effects/secrets/mismatch clues.
- `checks/run_all.py` — runs deterministic checks.
- `prompts/BUILD_AGENT.md` — instructions for a coding agent.
- `prompts/SUBMISSION_REVIEW_AGENT.md` — source-aware pre-submission reviewer.
- `prompts/ROUTING_EVAL_AGENT.md` — generate and hill-climb intent/tool evals.
- `agentcom/ROUTER_STANDARD.md` — AgentCom-specific canonical router pattern.
- `agentcom/router_contract.json` — normalized market-router contract.

## Important caveat

OpenAI's plugin ecosystem is changing quickly. Re-fetch official docs immediately before every public submission. Community observations are intentionally timestamped and should decay in confidence over time.
