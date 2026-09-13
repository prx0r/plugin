# Setup & integration

Two halves make up a working setup: **code inside your widget** (the SDK) and, for the bridge
transport, **a small handler on your MCP server**. Pick the transport that fits, then follow its
steps. All three transports can be mixed — a client can send to several adapters at once.

---

## Getting the SDK into your widget

**Bundled (most common).** If your widget is built with a bundler:

```js
import { createSignal, bridgeAdapter } from 'mcp-signal';
```

**Raw HTML / `srcdoc` widget (no bundler).** Inline the standalone build so you don't depend on a CDN
(which would require a `script-src`/`resourceDomains` CSP entry). Copy
`node_modules/mcp-signal/dist/mcp-signal.global.js` into your HTML inside a
`<script>` tag, then use the global:

```html
<script>
  /* …contents of mcp-signal.global.js… */
</script>
<script>
  const { createSignal, bridgeAdapter } = window.McpSignal;
  const signal = createSignal({ adapters: [bridgeAdapter()] });
</script>
```

**Server-rendered widget (`mcp-signal/inline`).** If your MCP server returns the widget HTML, let the
package inline the SDK for you — no copy-paste, no vendoring, no bundler config. `injectSignal` splices
the standalone build plus a `createSignal(...)` bootstrap into your HTML:

```ts
import { injectSignal } from 'mcp-signal/inline';

const html = injectSignal(widgetHtml, {
  widgetName: 'weather',
  bridge: { toolName: 'record_signal' }, // CSP-free; see Transport A
  autoCaptureInteractions: true,
});
```

Adapters are described declaratively (`bridge` / `webhook` / `posthog` / `console`) and constructed
inside the widget — `bridge` is the CSP-free default; `webhook`/`posthog` POST directly and need the
host to allowlist their origin. Two lower-level exports are available if you want to place the script
yourself: `source` (the raw IIFE string) and `renderInlineScript(config)` (the ready `<script>` tag).

---

## Transport A — bridge (recommended)

Route events through an app-only MCP tool on your own server. No CSP changes; your analytics key
stays server-side.

### 1. Widget

```js
import { createSignal, bridgeAdapter } from 'mcp-signal';

export const signal = createSignal({
  widgetName: 'weather',
  widgetVersion: '1.0.0',
  adapters: [bridgeAdapter({ toolName: 'record_signal' })],
});
```

`bridgeAdapter` auto-detects the host bridge (`window.openai.callTool` on ChatGPT, or a `tools/call`
`postMessage` on MCP Apps). If you already hold an `@modelcontextprotocol/ext-apps` `App`, pass its
call method for certainty: `bridgeAdapter({ callTool: (name, args) => app.callServerTool(name, args) })`.

### 2. Server — build a receiver

```js
import { createSignalReceiver, posthogAdapter } from 'mcp-signal/server';

const receiver = createSignalReceiver({
  adapters: [posthogAdapter({ apiKey: process.env.POSTHOG_KEY, host: 'eu' })],
  // Optional: enrich or scrub on the trusted side.
  // beforeSend: (e) => ({ ...e, properties: { ...e.properties, user_id: currentUserId } }),
});
```

### 3. Server — register the app-only tool

The descriptor is generated for you. Register it however your server registers tools:

```js
import { signalToolDefinition } from 'mcp-signal/server';

const tool = signalToolDefinition();
// tool = { name, description, inputSchema, annotations: { readOnlyHint: true, … },
//          _meta: { ui: { visibility: ['app'] }, 'openai/widgetAccessible': true } }
```

**Official MCP TypeScript SDK** (`@modelcontextprotocol/sdk`):

```js
server.registerTool(
  tool.name,
  {
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    _meta: tool._meta,
  },
  async (args) => receiver.handleToolCall(args),
);
```

**Raw `tools/call` handler:**

```js
if (request.params.name === tool.name) {
  return receiver.handleToolCall(request.params.arguments);
}
```

Make sure the widget's `toolName` matches the tool's `name` (default `record_signal`). That's it —
no CSP changes.

---

## Transport B — direct HTTP

Send straight from the widget. Simpler (no server tool) but you must allowlist the destination and
your public key ships in the widget.

### 1. Widget

```js
import { createSignal, posthogAdapter, webhookAdapter } from 'mcp-signal';

export const signal = createSignal({
  adapters: [
    posthogAdapter({ apiKey: 'phc_public_key', host: 'eu' }),
    // or webhookAdapter({ url: 'https://ingest.example.com/mcp' }),
  ],
});
```

### 2. Declare the CSP on your resource

Direct calls are blocked unless the destination origin is in your widget resource's CSP. Generate the
fragment and spread it into your `ui://` resource `_meta`:

```js
import { cspMeta } from 'mcp-signal';

const resourceMeta = {
  ...cspMeta([posthogAdapter({ apiKey: 'phc_public_key', host: 'eu' })]),
  // => { ui: { csp: { connectDomains: ['https://eu.i.posthog.com'] } } }
};
```

ChatGPT reads a legacy key — mirror it if you target older builds:

```js
import { requiredConnectDomains } from 'mcp-signal';
const domains = requiredConnectDomains([/* adapters */]);
const meta = {
  ...cspMeta(/* adapters */),
  'openai/widgetCSP': { connect_domains: domains, resource_domains: [] },
};
```

Turn on `debug: true` during setup — if a call is CSP-blocked, the SDK prints exactly which domain to
add.

---

## Transport C — console (local dev)

```js
createSignal({ adapters: [consoleAdapter()] });
```

Always works, never networks. Great as a fallback destination alongside the others.
