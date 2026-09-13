# Eval corpus — generated, not hand-maintained

Source of truth: `SEED_CASES` + `AMBIGUOUS_CASES` in `../src/cases.ts`.
Regenerate with `npm run studio -- corpus`. Never edit these files by hand —
CI asserts they match the seeds exactly.

- `positives.jsonl` — must-trigger intents with expected tool.
- `negatives.jsonl` — must-not-trigger intents (`expected_tool: null`).
- `ambiguous.jsonl` — review-only; proxies must not guess these.
- `tool_selection.jsonl` — positives + negatives with `kind` for runners.

Surface projections (chatgpt selection/negatives, webmcp invocation,
http contract) share these semantic intents; measurement differs per
surface. Tier-0 runs here; Tier-1+ consume the same files.
