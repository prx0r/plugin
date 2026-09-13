# Coding Agent Instruction — Build an AgentCom Plugin

You are implementing a public OpenAI plugin backed by MCP. Treat this repository's `data/requirements.json`, `data/rubric.json`, and `CANONICAL_GUIDE.md` as the local release standard.

## Mandatory workflow

1. Re-fetch current OpenAI plugin docs before coding. The local kit can be stale.
2. State the single conversational user intent the plugin owns and the nearby intents it must not capture.
3. Prove the capability needs external truth/action rather than duplicating native ChatGPT functionality.
4. Inventory third-party providers. Do not implement scraping or unofficial pass-through access. Record authorization/terms basis.
5. Design 3-6 model-visible tools from user goals. Keep provider APIs behind adapters.
6. Separate reads from consequential writes.
7. For every tool, define: name, title, description, inputSchema, outputSchema, auth, side effects, failure behavior, all annotations.
8. Keep inputs minimal. Never request full conversation history, credentials, OTP/MFA, raw payment-card data, government IDs, PHI, or unnecessary precise location.
9. Return compact structured outputs with stable IDs; declare outputSchema when returning structuredContent.
10. Make write operations idempotent or explicitly non-idempotent with protections. Require user approval at consequential boundaries.
11. Default to tool-only. Add UI only if comparison/preview/selection materially benefits.
12. If UI exists, use narrow CSP, no wildcard domains, no iframe unless essential, version widget URIs.
13. Build positive, paraphrase, negative-nearby and ambiguous tool-selection evals before polishing UI.
14. Target routing precision >= 97%, recall >= 95%, and zero consequential-action false positives in the deterministic suite.
15. Fill `plugin_spec.json` from actual source behavior and run `python checks/run_all.py plugin_spec.json <repo-root>`.
16. No ERRORs. Resolve WARNs or document explicit evidence-based waiver.
17. Test hosted production endpoint with final metadata, then generate review bundle and re-run on web/mobile where applicable.

## Design rule

Never expose provider-shaped methods to the model when a user-semantic market operation can hide them.

Wrong: `checkatrade_create_job`, `prodigi_quote`, `printful_variant_lookup`.

Right: `request_service_quotes`, `quote_personalized_product`.

## Output at completion

Return:

- tool inventory
- provider authorization ledger
- routing eval metrics
- linter output
- latency measurements
- remaining review risks
- final 5 positive and 3 negative review tests
- exact current OpenAI docs consulted and date
