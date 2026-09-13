# Domain Availability — preflight waivers & deployment-gated items (2026-09-13)

Lint: `plugin_spec.domains.json` → schema clean, 11 ERRORs + 1 WARN, all
expected pre-launch. Nothing here touches tool semantics; all tool/contract
checks pass.

## Deployment-gated ERRORs (resolve on submission day, in order)

- PUB001/PUB002 — verify AgentCom org identity, align listing URLs.
- MCP002/MCP005/MCP006 — deploy https://domains.agentcom.org/mcp, serve the
  portal challenge token via `OPENAI_APPS_CHALLENGE_TOKEN` (route already
  implemented in the MCP server at `apps/mcp/src/server.ts`), run Scan Tools,
  flip flags.
- PRIV001 ×5 — publish agentcom.org/privacy covering categories, purposes,
  recipients, retention, controls.

## Standing waiver

- TP002 (RDAP has no partner-access program): RDAP is an IETF open protocol
  for public registration data — no key, no ToS, nothing to partner with.
  Authorized=true (public data), terms_reviewed=true (confirmed no ToS),
  primary_pass_through=false (we normalize, validate, suggest, rank).
- TOOL002 WARN (`batch` verb): kept deliberately — `batch_check_domains`
  names the bulk operation honestly; renaming would churn the frozen tool
  contract for zero routing gain.
