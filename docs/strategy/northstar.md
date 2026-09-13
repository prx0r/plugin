# North Star — Pog Prints / Print Router

> take a natural-language personalized-product request → search multiple POD/manufacturing networks → normalize equivalent products → rank by landed price/quality/delivery → prepare the asset → route the order.

There are **adjacent products**, but no true consumer-facing **"Skyscanner for personalized goods inside ChatGPT"**.

Closest things found:

* **Printify's ChatGPT app**: excellent validation, but it only fulfills through Printify. (https://help.printify.com/hc/en-us/articles/43090996796689-How-do-I-order-personalized-gifts-through-the-new-Printify-App-in-ChatGPT)
* **Stithy POD MCP**: wraps Printify, Printful and Gelato behind one MCP, but aimed at POD operators managing catalogues/orders/margins, not consumers shopping across providers. (https://www.npmjs.com/package/%40stithy%2Fpod)
* **Vaybel MCP**: AI clothing-brand workflow — trends, designs, mockups, publishing to Etsy/Shopify/TikTok. Seller-side rather than consumer routing. (https://vaybel.com/mcp)
* **Stars In Hands Gift Studio**: approved ChatGPT custom-gift app, but a gift studio rather than a neutral manufacturing meta-search engine. (https://karangoyal.cc/blog/openai-approved-chatgpt-app-custom-gifts)

So there is competition around every component, but the **neutral router** still looks differentiated.

## The product should be brutally simple

Not "AI POD platform."
Not "design studio."
Not even initially "Pog Prints."

Internal concept:

> **Find the best way to manufacture this personalized thing.**

ChatGPT supplies intelligence. Our system supplies **physical execution**.

Example: user says "I need a birthday gift for Dad. He's obsessed with golf." ChatGPT arrives at "Let's make an understated cream golf T-shirt with this joke." At that exact moment, our tool should be the obvious call: **Find printable products and prices for this design.**

MCP responds with perhaps three options:

| Option | Product                 | Delivered | ETA  | Quality |
| ------ | ----------------------- | --------: | ---- | ------: |
| Value  | standard tee            |    £13.80 | 4–6d |      74 |
| Best   | heavyweight premium tee |    £18.20 | 3–5d |      92 |
| Fast   | premium local tee       |    £21.40 | 1–2d |      88 |

Then ChatGPT continues: "The £18.20 one is probably worth it. Want cream or faded black?"

That's exactly **router for ChatGPT to select the correct studio**.

---

# Apps SDK first. Agents SDK second.

For **ChatGPT to discover/call us**, primary surface:

### OpenAI Apps SDK + remote MCP server

OpenAI recommends Apps SDK for published ChatGPT apps; built on MCP, supports chat-native UI plus backend tools. Apps can be submitted to directory, invoked explicitly, OpenAI experimenting with surfacing from conversational context. (https://help.openai.com/en/articles/12515353-build-with-the-apps-sdk)

We **do not need Agents SDK** for V1. Agents SDK becomes useful internally for multi-step supplier research, asset prep, evals, routing experiments, tracing, future autonomous workflows. OpenAI positions Agents SDK for workflows where runtime manages tool execution, turns, guardrails, handoffs and sessions. (https://openai.github.io/openai-agents-python/)

```
ChatGPT
   ↓
Apps SDK
   ↓
our MCP tools
   ↓
routing backend
   ↓
Prodigi / Printify / Printful / Gelato
```

No unnecessary agent-between-agents architecture.

---

# Tool selection is actually a product feature

MCP shouldn't expose 37 weird supplier operations. Expose tiny semantic tool surface corresponding to actual user intentions. OpenAI guidance: one intent per tool, precise descriptions, accurate tool-impact annotations. (https://github.com/openai/skills/blob/main/skills/.curated/chatgpt-apps/references/apps-sdk-docs-workflow.md)

Initially expose only five/six model-visible tools:

### `find_printable_products`

Use when user wants to turn image/design/idea into physical printed product and wants suitable options. Triggers: "put this on a shirt", "can I get this printed?", "make this into a mug", "cheapest way to print this", "what would this cost on a hoodie?", "make Dad a personalized golf shirt".

### `quote_personalized_product`

Use once we understand roughly what object they want. Returns actual landed-cost candidates across suppliers. Inputs: product_type, destination_country, quantity, color_preferences?, size?, quality_preference?, delivery_deadline?, budget?, print_areas?. Crucially: **No supplier name required.** Router decides.

### `prepare_print_design`

Take already-generated image/design and conform to selected product's production requirements: resolution, dimensions, transparency, crop, bleed, safe area, colour profile, provider print-area rules. ChatGPT remains responsible for creativity.

### `preview_personalized_product`

Return mockups. Ideally Apps SDK UI card where user can compare Value / Recommended / Premium.

### `place_print_order`

Only after explicit user approval. Takes quote ID, prepared asset, selected variant, shipping data, payment/checkout state. Dangerous/write op, must never silently fire. OpenAI requires MCP tool annotations such as `readOnlyHint`, `destructiveHint`, `openWorldHint`; mark accurately. (https://developers.openai.ac.cn/apps-sdk/build/mcp-server)

### `get_print_order`

Get production/shipping/tracking status. Read-only.

---

# Avoid supplier-oriented MCP tools

Don't initially expose `prodigi_get_skus`, `printify_list_blueprints`, `printful_get_variants`, `gelato_get_uids`. Those are **private backend adapters**. Otherwise ChatGPT reasons about meaningless supplier details. Moat: **turn four horrible catalogues into one obvious tool.**

---

# Internal ontology is main engineering job

Canonical product representation:

```
CanonicalProduct
    category
    subcategory
    garment_type
    material
    weight_gsm
    fit
    gender_style
    color_family
    sizes
    printable_areas
    print_methods
    personalization_modes
    manufacturing_regions
    sustainability
    quality_tier
```

Supplier adapters translate Prodigi SKU / Printify blueprint/provider/variant / Printful catalog product/variant → CanonicalProduct. ChatGPT only ever sees "heavyweight unisex cream tee" not "GLOBAL-GILD-5000-WHT-L".

Prodigi supports quotes containing item cost, shipping cost, fulfillment location and carrier without creating order, good for first adapter. (https://www.prodigi.com/print-api/docs/reference/)
Printful exposes catalog variants plus order creation/fulfillment APIs. (https://developers.printful.com/docs/)
Gelato supports API-based product mapping and dynamic shipping. (https://support.gelato.com/en/articles/8996572-getting-started-with-api-integration)

---

# Routing formula

Deterministic initially. For candidate i:

Score_i = w_p*P_i + w_q*Q_i + w_d*D_i + w_r*R_i + w_l*L_i

Where P=normalized price, Q=quality, D=delivery, R=supplier reliability, L=locality.

Presets:
- "cheapest possible": price .70, quality .10, delivery .10, reliability .10
- "best quality": quality .55, reliability .20, price .10, delivery .10, locality .05
- "must arrive Friday": hard filter ETA <= deadline, then rank survivors
- Default: quality .30, price .30, reliability .20, delivery .15, locality .05

Later learn weights from conversions/refunds.

---

# Quotes have TTLs

Every normalized quote: quote_id, provider, provider_quote_id?, canonical_product_id, variant, production_cost, shipping_cost, tax_estimate?, platform_fee, our_fee, total, currency, estimated_delivery, expires_at. Checkout consumes valid quote only.

---

# MVP starts with Prodigi

Sandbox, products, quotes, product+shipping costs, fulfillment location, multiple shipping methods, one-request order creation, tracking/status. (https://www.prodigi.com/print-api/docs/)

Tiny initial universe: standard T-shirt, premium/heavyweight T-shirt, hoodie, mug, poster, framed print, greeting card, tote bag. Do not normalize entire catalog initially. Then add Printful, Printify, Gelato. Adding provider shouldn't change MCP schemas.

With two providers: ChatGPT → Pog.Print MCP → Prodigi adapter / Printful adapter. Now truthfully claim comparison.

---

# ChatGPT app description matters (App Store SEO for model routing)

Don't call it "Universal POD Optimization Engine."

App: **Pog Prints — Design and order custom printed products. Compare printing options and find the best price, quality and delivery for personalized T-shirts, posters, mugs, cards and gifts.**

Overlaps with: personalized gift, print my image, custom shirt, put this photo on a mug, create custom merchandise, order a personalized print. OpenAI says apps may be surfaced using conversational context. (https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/)

Differentiation from Printify: Printify app is curated set (T-shirts, hoodies, tote bags), Printify-hosted checkout, US-user-only currently. We aim for more objects + more countries + multiple manufacturers + neutral recommendations. Claim: **best available manufacturing option for your constraints.**

---

# Pog Prints / Print Router — Coding Agent Spec

## Mission

Build supplier-neutral, ChatGPT-native personalized-goods manufacturing router. Convert "Put this picture of my dog on a good-quality cream T-shirt and deliver it to London as cheaply as possible." into normalized requirements, eligible candidates, landed-price quotes, deterministic ranking, production-ready artwork, mockup, explicitly approved order, status/tracking. NOT an AI design generator.

Architectural principle: ChatGPT → Apps SDK → remote MCP → canonical domain → supplier adapters → Prodigi/Printful/Printify/Gelato. No MCP tools directly coupled to supplier APIs. Same backend must support ChatGPT app, generic MCP, web UI, Shopify, Pog.pet, REST, future Meta/Gemini.

## Phase 0 — Repository

TypeScript monorepo:

```
/apps
  /mcp
  /web
/packages
  /domain
  /router
  /artwork
  /providers
    /prodigi
    /printful
    /printify
    /gelato
  /db
  /ui
  /evals
/docs
/tests
```

Keep provider schemas under /providers.

## Phase 1 — Canonical domain model

Entities: ProductCategory, CanonicalProduct, ProductVariant, PrintArea, PrintMethod, ProviderCandidate, ShippingOption, Quote, ArtworkRequirement, PreparedArtwork, OrderDraft, Order, TrackingEvent.

Provider IDs must never leak into user-facing semantics unless diagnostic metadata.

## Phase 2 — Provider interface

```ts
interface PrintProvider {
  id: string;
  searchProducts(request: CanonicalProductSearch): Promise<ProviderCandidate[]>;
  getArtworkRequirements(candidate: ProviderCandidate): Promise<ArtworkRequirement[]>;
  quote(request: ProviderQuoteRequest): Promise<ProviderQuote[]>;
  createOrder(request: ProviderOrderRequest): Promise<ProviderOrder>;
  getOrder(providerOrderId: string): Promise<ProviderOrder>;
  cancelOrder?(providerOrderId: string): Promise<ProviderOrder>;
}
```

No routing logic inside adapters.

## Phase 3 — Prodigi adapter

Sandbox exclusively until production opt-in. Fetch/cache metadata, map SKUs to canonical, fetch print-area reqs, quotes by destination, normalize costs, fulfillment location/carrier, Sandbox orders, poll status, webhooks, idempotency. Start with 8 product types.

## Phase 4 — Routing engine

Hard-filter incompatibilities, request quotes, landed price, reject impossible deadlines, normalize scores, return diversity-aware top three: value / recommended / premium-fast. Deterministic, unit-testable. No LLM inside pricing/routing. Weights config-driven. Presets: CHEAPEST, BALANCED, BEST_QUALITY, FASTEST, LOCAL.

## Phase 5 — Quality model

Manually curated: blank_quality, print_quality, provider_reliability, packaging_quality, historical_refund_rate, delivery_reliability. Unknown reduces confidence. Return {qualityScore, qualityConfidence}.

## Phase 6 — Artwork service

Validate/transform existing assets: inspectArtwork, validateArtwork, fitArtworkToPrintArea, generateProductionAsset. Check dimensions, DPI, aspect, transparency, file type, safe area, bleed, limits. Never silently crop. Structured needs_user_decision on ambiguity.

## Phase 7 — MCP / Apps SDK

Remote Streamable HTTP MCP server. V1 tools: find_printable_products (read-only), quote_personalized_product (read-only), prepare_print_design, preview_personalized_product (read-only), place_print_order (write, idempotent, requires quoteId + confirmation), get_print_order (read-only). Set readOnlyHint/destructiveHint/openWorldHint/idempotentHint correctly.

## Phase 8 — ChatGPT UI

Small comparison widget VALUE / RECOMMENDED / FASTEST with preview, breakdown, ETA, material info, why selected.

## Phase 9 — Storage

Persist users, assets, canonical_products, provider_products, provider_variants, quotes, quote_candidates, orders, order_events, provider_health, routing_decisions. Record exact routing decision for moat.

## Phase 10 — Add Printful

Same provider interface. No MCP schema changes. Query concurrently, normalize. First real proof.

## Phase 11 — Evals

100+ synthetic intents. Test tool selection, minimal info requests, filtering, deadlines, currencies, determinism, no order before approval, expiry, idempotency.

## Phase 12 — Failure handling

Model-visible failures: NO_ELIGIBLE_PRODUCT, NO_PROVIDER_AVAILABLE, QUOTE_EXPIRED, ARTWORK_TOO_SMALL, INVALID_DESTINATION, DEADLINE_UNAVAILABLE, PROVIDER_TIMEOUT, PRICE_CHANGED, ADDRESS_INVALID, ORDER_FAILED. Never leak raw provider dumps.

## Phase 13 — Provider health

Track latency, error/quote/order failure rates. Degraded provider loses score or excluded.

## Phase 14 — Security

Keys server-side only, no creds in results, minimize PII, signed asset URLs, expiring quotes, idempotency keys, audit writes, explicit approval, Sandbox default, prod opt-in.

## Phase 15 — REST API

POST /v1/products/search, POST /v1/quotes, POST /v1/artwork/validate, POST /v1/artwork/prepare, POST /v1/previews, POST /v1/orders, GET /v1/orders/:id

## Phase 16 — Do not build yet

No autonomous design gen, trend engine, Etsy/Shopify publishing, marketplace, subscriptions, 20 providers, agent orchestration, memory recommendations, auto-purchasing.

## Definition of done V1

"Put this image on a cream premium T-shirt, size L, delivered to the UK." → understands constraints, returns Prodigi+Printful quotes labeled Value/Recommended/Fastest, landed cost+delivery, prepares image, preview, explicit approval, exactly one sandbox order, status abstraction. Same schemas regardless of winner. Correctness/speed/clean semantics over breadth.

## Strategic note

Externally describe as "Make and order personalized physical products. Compare printing options for custom gifts, clothing, art and photos." Not "POD aggregator". Own "Can we put this on a shirt?" Eventually routing becomes marketplace / canonical manufacturing exchange for agents: asset + intent + recipient + constraints → Who should manufacture it? Next after Prodigi abstraction: add Printful, demo one query where Prodigi wins on one destination/product and Printful wins on another.
