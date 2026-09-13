# AgentCom Router Standard v0.1

## Definition

AgentCom converts conversational economic intent into normalized offers/actions from authorized providers.

Canonical lifecycle:

`intent -> discover -> quote/availability -> normalize -> rank -> explicit choice -> execute -> status`

Not every vertical implements every verb.

## Model-visible rule

The model sees user-semantic verbs. Provider names and provider-specific IDs are internal unless disclosure is necessary for transparency.

Recommended vertical surface:

- `find_*`
- `quote_*` or `request_*_quotes`
- `get_*_offers`
- `book_*` / `order_*` / `register_*`
- `get_*_status`

## Provider adapter contract

Each adapter declares:

- provider_id
- authorization_basis
- supported_capabilities
- supported_geographies
- data_freshness
- quote semantics
- external-action semantics
- rate limits
- redistribution constraints
- attribution requirements
- health/latency state

## Deterministic ranking

Economic allocation should default to deterministic ranking over explicit features rather than LLM intuition.

Example:

`score = w_price*price + w_quality*quality + w_eta*eta + w_reliability*reliability + w_fit*fit`

The model can infer user preferences and choose a preset; the final candidate scoring must be auditable.

## Fairness/monetization

Paid placement must never silently override organic utility ranking. If advertising/sponsorship is ever allowed on the surrounding product surface, it must be separated and disclosed. Current OpenAI plugin rules prohibit serving ads in plugins.

## Provider legitimacy gate

A provider adapter is production-eligible only if `authorized=true`, `terms_reviewed=true`, and the integration is not an unofficial scraping/pass-through workaround.

## Persistence

After a successful service relationship, the customer may prefer the known provider first in future workflows, but that preference must come from explicit user history/preference available to the host—not covert tracking by AgentCom.
