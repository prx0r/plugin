# Etsy + Pinterest distribution for Pog — integration thinking

Companion to `pogchat.md` (strategy) and the reference library. This maps
the strategy onto systems we actually have: the plugin-runtime modules in
`print/kits/plugin-runtime/runtime/` and the Pog product pipeline.

## The one-schema rule

pogchat mandates one product schema under Etsy, Pinterest, and ChatGPT. Define
it once as a capability manifest (runtime format) and compile outward:

- Etsy listing personalization fields = 5 bounded inputs (photo, name,
  occasion dropdown, story text, style dropdown). These map 1:1 onto tool args
  for `create_pog`. No free-composition fields, ever — bounded choices are
  what let an agent complete personalization unaided.
- Pinterest Pin data (title, description, link, alt text) is generated from
  the same manifest: occasion + aesthetic + product, never hand-written per
  SKU. Trend only mutates visual treatment.
- ChatGPT tools stay at five: find, create, preview, order, status. The
  `perform(pog, action, recipient)` endgame is the same job object with a
  persistent character id.

## What each runtime module does for Pog

- **Description optimization + evals**: gift routing is the whole
  game. "Last-minute birthday present for Mum, she loves Buster, £20" must
  select `find_pog_gift`, never a sibling. Build the eval file first with
  occasion × urgency × budget prompts, run against ChatGPT distractors, and
  record per-variant selection rates. The 545-site lesson applies directly:
  specific enough to route, compact enough not to bloat context.
- **Host adapters**: ChatGPT gets `_meta.ui` CSP + redirect domains
  for the checkout round trip; Claude/generic get the portable core. The
  `ui.domain` branding behavior means pog.pet's domain choice is acquisition
  surface, not plumbing.
- **redirect_domains as the commerce primitive**: checkout leaves the iframe
  through the approved domain and returns the buyer into the same conversation
  via redirectUrl. That is the digital-delivery upsell ("want the framed one
  too?") implemented as protocol, not copy.
- **Telemetry**: the reviewer-session stream doubles as the
  buyer-status stream. `get_pog_gift_status` reads the same event log the
  submission reviewer sees: briefed → generating → QA → delivered. For Etsy
  orders, the same stream drives the "your gift is ready" email and the manual
  upload step.
- **Discovery bundle**: every Pog capability page ships
  JSON-LD + llms.txt + canonical id. This is what makes Pog surfaces
  machine-readable for ChatGPT browsing, Pinterest crawlers, and the future
  JSON-LD app-discovery proposals alike.
- **Preflight**: the submission gate runs on every template instantiation,
  not just launch. Seasonal SKUs are generated, so generation must be gated.

## Etsy pipeline (respecting the digital-delivery limitation)

Etsy webhooks (`order.paid`) → read the 5 personalization answers → download
photo → construct Pog brief (progressive: photo+name+occasion minimum, story
as lift) → generate assets → automated quality checks → human QA → manual
Shop Manager upload for made-to-order digital (no API for this today, do not
hack around it) → email buyer → upsell physical via Prodigi/Printify with
tracking posted back through the fulfillment API.

Directive: build the automation so the manual upload is the ONLY human step.
When Etsy ships digital-delivery API or native ChatGPT customization, the
human step deletes and nothing else changes.

## Pinterest loop

Weekly: pull accelerating aesthetics per occasion cluster → instantiate
template SKUs (Pet × Recipient × Occasion × Trend × Aesthetic × Product) →
generate preview imagery through the Pog kernel → preflight each → publish
Pins pointing at capability pages (JSON-LD present) → measure saves-to-Etsy-
search lift → feed winning aesthetics back into the ChatGPT style dropdown.
Pinterest never gets its own product logic; it is a trend sensor plus
inspiration demand pointed at the same kernel.

## Launch sequence

1. One listing: Last-Minute Pet Birthday Gift (digital). Five fields exactly
   as specified in pogchat. Human-QA loop behind it.
2. Pog capability manifest + evals for the five tools. Selection rate over
   90% against distractors before any submission.
3. Native ChatGPT plugin in dev mode: create → preview → status, checkout
   via redirect domain. Submit when preflight is green for two weeks.
4. Pinterest template pipeline for the next occasion on the calendar.
5. Physical upsell (card + print) through POD with tracking callbacks.
6. Watch Etsy's ChatGPT integration for native customization/checkout; when
   it lands, listings are already agent-shaped, so adopt day one.

## Metric that matters

Share of gift outcomes completed without the buyer ever leaving a
conversation. Everything above serves that number.
