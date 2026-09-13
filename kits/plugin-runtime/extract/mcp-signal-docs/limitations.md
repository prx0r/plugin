# Limitations (v0.1)

An honest account of what the SDK can and can't do, and how it behaves at the edges. These come from
how widgets actually run in 2026, not from missing effort — several are properties of the environment,
not bugs.

## 1. Direct network egress is gated by the host CSP

Widgets run under a strict Content-Security-Policy. A direct `fetch`/`sendBeacon` to PostHog or your
webhook only leaves the iframe if the **integrating app declared that origin** in the widget
resource's CSP (`_meta.ui.csp.connectDomains`, or ChatGPT `openai/widgetCSP.connect_domains`). The SDK
cannot self-authorize egress.

- **Fix A (recommended):** use the [bridge transport](./bridge.md) — a tool call isn't subject to
  `connect-src`, so no CSP change is needed.
- **Fix B:** allowlist the origin. `cspMeta(adapters)` generates the fragment for you.
- **Diagnostic:** with `debug: true`, a blocked request logs the exact origin to add.

If egress is blocked and you're on a direct adapter, events are dropped (bounded, with a debug
warning) — the widget never crashes.

## 2. Tool-call approval is a host's prerogative

The bridge's tool is app-only and `readOnlyHint: true`, which means **silent on ChatGPT** and
**first-use-then-remembered on Claude**. But the MCP Apps spec only _permits_ silent execution; it
doesn't _mandate_ it. A particular host build could prompt on UI-initiated calls. We can't promise
zero prompts on every host, ever.

## 3. Sends are fire-and-forget (can't read responses)

To stay CORS-simple from a widget's opaque origin, in-session sends use `fetch(..., { mode: 'no-cors'
})`, whose response is unreadable. So "success" means "the request left the tab," not a confirmed
2xx. The SDK compensates with retries (in-session) and an idempotency `messageId` on every event
(mapped to PostHog's `uuid`), so any retry/beacon duplicate is deduped downstream. It does **not**
guarantee delivery.

## 4. Custom webhook headers break the simple-request guarantee

Any header beyond the CORS-safelisted set (e.g. `Authorization`) forces a CORS preflight, which is
fragile in sandboxes and impossible for teardown beacons. Put shared secrets in the URL path or body
instead. (`webhookAdapter` still supports `headers` for same-origin/relaxed cases, and switches to
`cors` mode when you use them.)

## 5. Host detection is best-effort

`window.openai` reliably identifies ChatGPT, and a top-level document is clearly a plain browser. But
MCP Apps vs mcp-ui inside a framed widget can't always be told apart synchronously (their handshakes
are async). `host` in context may read `unknown`; pass `config.host` to force it.

## 6. No cross-load persistence

Sandboxed widgets have no reliable cookie/`localStorage` (rawHtml widgets run in a null origin), so
the anonymous `sessionId` is per widget load and the retry queue is in-memory. A widget that closes
before a flush relies on the teardown beacon/tool-call, which is best-effort. A durable, cross-load
queue is on the roadmap.

## 7. Teardown reliability

Flushing happens on `visibilitychange → hidden` (primary) and `pagehide` (backup). The SDK
deliberately never uses `unload`/`beforeunload` (they break the back/forward cache and are unreliable
on mobile). On some mobile close paths even `pagehide` may not fire; the `hidden` flush is the safety
net. Teardown payloads are kept under ~60 KiB to respect the beacon/keepalive ceiling.

## Not in v0.1 (roadmap)

No storage/query backend, no dashboard, no server-side MCP telemetry (tool-call/resource metrics), no
consent-management or PII-scrubbing machinery. See the roadmap in the [README](../README.md#roadmap).
