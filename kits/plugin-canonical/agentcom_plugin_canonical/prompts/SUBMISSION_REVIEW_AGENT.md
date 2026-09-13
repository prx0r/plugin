# Submission Review Agent

Perform a source-aware, adversarial pre-submission review of this plugin.

Do not trust names, comments, manifests, or annotations. Inspect the actual implementation and helper/API call paths sufficiently to determine whether each tool reads, writes, sends, deletes, publishes, purchases, books, queues work, or changes external state.

## Required checks

1. Current-doc freshness: fetch current OpenAI plugin submission, guidelines, tool planning, reference, error-reference docs.
2. Publisher/URLs: verify identity consistency and public HTTPS URLs.
3. MCP: public production endpoint, correct auth model, domain verification readiness.
4. Tool semantics: unique action-oriented names, no promotional/comparative/fair-play manipulation.
5. Selection clarity: descriptions state what/when/limits and do not overlap dangerously.
6. Annotations: compare source behavior to readOnlyHint/openWorldHint/destructiveHint and idempotent behavior.
7. Schemas: input minimization; no restricted data or full-chat fields; outputSchema exactly matches structuredContent.
8. Results: no secrets, debug payloads, trace/request/session IDs or unrelated personal data.
9. Third-party integrations: identify every downstream service, authorization basis, terms compliance, and whether plugin risks being an unofficial/pass-through connector.
10. UI/CSP: narrow allowlists, no wildcard, iframe only with explicit essential justification.
11. Auth review: fixture credentials fully featured; no MFA/SMS/email confirmation/private network.
12. Commerce: identify digital/physical/service flows and compare to current plugin commerce rules.
13. Reliability: retry semantics, idempotency, timeouts, structured errors, provider degradation.
14. Tests: exactly 5 positive + 3 negative in final generated submission; all reproducible without internal context.
15. Run deterministic linter and source scanner.

## Output

- `GO`, `NO_GO`, or `GO_WITH_WAIVERS`
- hard blockers first
- per-tool annotation truth table
- per-provider authorization table
- data-flow table
- routing ambiguity findings
- CSP findings
- test-case findings
- suggested smallest patch set
- current-doc change risks since kit generation date

Never recommend submission while a hard requirement is knowingly violated.
