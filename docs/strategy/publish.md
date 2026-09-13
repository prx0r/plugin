# Publisher architecture + payments (saved 2026-09-13 — NOTE: arrived truncated mid-sentence at "Plugin Directory is the primary discovery surface")

## Payments (confirmed direction)

No generic ChatGPT-credit wallet for normal merchant purchases. Users pay with
a card on file with ChatGPT or another supported card/express option; ChatGPT
passes a tightly scoped payment token/order data to the merchant, and the
merchant remains merchant of record processing through its own backend.
Users should not type raw card numbers/CVV into ordinary chat.

Wrinkle (March 2026): OpenAI shifted emphasis from universal native Instant
Checkout toward product discovery + merchants' own checkout experiences, while
deeper/native commerce integrations remain possible.

Domain-purchase design: ChatGPT finds/verifies domain → user confirms →
secure registrar/merchant checkout → redirect back into the same conversation
via redirect_domains (approved destinations receive redirectUrl for the return).

## Publisher architecture (do NOT buy a branded .com per capability)

- Publisher/plugin brand: AgentCom
- Primary trust domain: agentcom.org
- Capability: Domain Availability
- Public page: agentcom.org/domain-availability
- MCP: mcp.agentcom.org/domain-availability (or api.agentcom.org/mcp/domain-availability)
- Widget/homepage: agentcom.org/tools/domain-availability

Separate exact-match domains only with independent acquisition value:
agentcom.org (parent), domain-name-checker.com (maybe), domainavailability.com
(very valuable if affordable), llmprices.com, companylookup.com.
mcp.agentcom.org/* = infrastructure.

Key distinction: plugin/tool NAME matters far more than TLD for ChatGPT
internal discovery — directory search intentionally prioritizes app title/name
(description search was noisy). Spend effort on "Domain Availability", not
"Domain Ninja" / "NameForge" / "AgentCom Domains".

## TLD hierarchy

| Purpose | Preferred |
|---|---|
| Parent publisher | agentcom.org is excellent |
| Consumer transactional | .com if cheap/available |
| Developer tool | .dev is excellent |
| MCP/API backend | virtually any reputable TLD |
| Experiment/prototype | .xyz totally fine |
| High-trust financial/business | .com, .org, .dev over novelty TLDs |

No evidence of OpenAI protocol/ranking preference for .com. MCP spec treats
the domain as host/security-origin concern; validation is host-dependent.
mcp.domainchecker.xyz works fine technically — separate technical
acceptability from commercial optimization.

ui.domain doubles as branding/navigation anchor (app-identity click
destination observed). Use agentcom.org or the capability's polished public
domain — never random-worker-83.pages.dev — while infra stays cheap.

## Plugin bundling (TRUNCATED — rest not received)

"As of July 9, 2026, OpenAI says the Plugin Directory is the primary
discovery surface …" — message ends here. Outstanding question: one AgentCom
plugin with many apps/capabilities vs one plugin per tiny tool. Prior
direction (plan.md) already sketched one plugin → Domains/Print/Trades apps;
awaiting the rest of this analysis before changing submission strategy.
