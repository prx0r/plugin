# Local services Get Quote conversion spec (OpenAI — saved 2026-09-13)

Source: https://developers.openai.com/plugins/guides/local-services-request-quote-conversion-spec.md

> STATUS: beta, tested with approved partners. To apply: https://chatgpt.com/merchants/
> This is a SECOND distribution lane beyond conversational tool-calling:
> a native **Get Quote** button on local business cards/sidebar in ChatGPT.

## Purpose

ChatGPT can directly invoke partner plugins for high-intent local services use
cases such as requesting a quote. Provide local business data identifying your
service, and expose an MCP tool opening your quote-request widget.

## UX

When a user searches for an eligible local business, the business card/sidebar
shows **Get Quote**. Selecting it opens the provider's quote-request widget in
a ChatGPT modal. Shown only when the business has an eligible service provider
with a configured partner plugin.

## Required contract

- Register MCP tool named `request_service`, widget resource `ui://widget/request-service.html`.
- ChatGPT launches widget in `modal` display mode, passing the provider's business ID:

```ts
const launcherTool = { name: "request_service", _meta: { ui: { resourceUri: "ui://widget/request-service.html" } } };
const launcherInput = { business_id: "biz_123" };
```

- `business_id` MUST be the `provider_business_id` from the matching service provider record (may differ from the containing business record ID).
- Set `_meta["openai/widgetAccessible"] = true` on helper tools the widget calls directly.

## Business feed

A paginated collection of local business records ChatGPT indexes for search.
Expose e.g. `GET /v1/businesses` with one pagination style (page/page_size,
offset/limit, or opaque next_page_token). Accept optional `changes_token`,
return `checksum` + `businesses` page.

Required business fields: stable `id`, `name`, `address` (structured or
formatted), `location` {latitude, longitude}, `phone_number` (E.164 preferred),
`website_url`, `platform_url` (canonical listing URL).

Quote-request action: per business accepting quote requests, add
`service_providers[]` with `provider` (must match configured partner plugin),
`provider_business_id` (nonempty; passed as `business_id`), `action_type:
request_a_quote`, `provider_action_url` (absolute http/https),
optional `display_name` (does NOT override the ChatGPT "Get Quote" label).

Launcher eligibility: nonempty business ID + nonempty `provider_business_id` +
valid `provider_action_url` + configured partner plugin.

## Strategic read for us

- Lane 1 (open now): conversational MCP tools — our `find_heating_engineers` /
  `request_heating_quotes` style surface. No approval needed to build; publish
  via normal plugin submission.
- Lane 2 (gated): Get Quote button + business feed. Requires partner approval
  via merchants form. Our supplier graph (Geoffs with normalized profiles) IS
  the feed asset — every tradie we normalize becomes a feed record.
- Future expansion note says booking actions are NOT yet in this contract —
  our conversational `book_heating_job` tool covers booking until the spec grows.
