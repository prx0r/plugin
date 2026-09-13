# The bridge transport

Widgets run in a sandbox where the host's Content-Security-Policy blocks network calls to any origin
the integrating app didn't pre-declare. Rather than fight that, the **bridge** sends telemetry the way
a widget is already allowed to talk to its backend: an **MCP tool call**. Your server receives the
batch and forwards it to the real destination — where there is no CSP or CORS to worry about.

```
widget (bridgeAdapter)
   │  callTool('record_signal', { events, sdk, sentAt })
   ▼
host  (window.openai.callTool  /  tools/call postMessage)
   │
   ▼
your MCP server  (app-only tool → createSignalReceiver)
   │  ordinary server-side HTTPS
   ▼
PostHog / webhook / any adapter
```

## Why it's low-friction

The tool is registered **app-only and read-only**, via the descriptor `signalToolDefinition()`
gives you:

- `_meta.ui.visibility: ["app"]` — the MCP Apps spec **requires** hosts to strip app-only tools from
  the model's `tools/list`. The model never sees it, so it costs **zero context** and can't be called
  by the model — only your widget can.
- `annotations.readOnlyHint: true` — hosts treat it as harmless. On **ChatGPT**, read-only tools are
  called **silently**. On **Claude**, the user approves once and it's remembered — not a prompt per
  batch.
- `openai/widgetAccessible: true` (+ `openai/visibility: "private"`) — legacy compat so older ChatGPT
  builds also allow the widget-initiated call. Disable with `signalToolDefinition({ openaiCompat:
false })`.

> **Honest caveat.** The spec makes per-call approval a _host's_ prerogative — it _permits_ silent
> execution but doesn't _mandate_ it. In practice you get silent (ChatGPT) or approve-once (Claude),
> but a given host build could prompt. This is the one thing we can't guarantee across every host.

## The envelope

The widget calls `callTool(toolName, payload)` where the payload is:

```jsonc
{
  "events": [/* SignalEvent[] */],
  "sdk": { "name": "mcp-signal", "version": "0.1.0" },
  "sentAt": "2026-07-15T12:00:00.000Z",
}
```

`createSignalReceiver().handleToolCall(payload)` reads `payload.events`, runs your adapters, and
returns a valid MCP tool result. Any third party can implement either side against this contract.

## Detection & overrides

`bridgeAdapter()` resolves a `callTool` in this order:

1. `config.callTool` if you pass one (most reliable).
2. `window.openai.callTool` (ChatGPT).
3. A JSON-RPC `tools/call` `postMessage` to the parent frame (MCP Apps), correlated by id.

If none is available, in-session sends reject (non-retryable, surfaced in `debug`) and teardown sends
are silently dropped. When in doubt — especially with `@modelcontextprotocol/ext-apps` — pass
`callTool` explicitly:

```js
import { App } from '@modelcontextprotocol/ext-apps';
const app = new App(/* … */);
bridgeAdapter({ callTool: (name, args) => app.callServerTool(name, args) });
```

## Teardown

On `pagehide`, the bridge fires the tool call without awaiting (best-effort) — the same "we did our
best as the page went away" contract as network beacons. The bridge's real strength is reliable
**in-session** delivery, which covers the common case of a locked-down CSP where direct HTTP wouldn't
leave the iframe at all.
