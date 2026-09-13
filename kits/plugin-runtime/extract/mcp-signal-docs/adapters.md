# Adapters reference

An adapter is a destination for events. Configure one or more in `createSignal({ adapters: [...] })`
(client) or `createSignalReceiver({ adapters: [...] })` (server). The destination adapters
(`console`, `webhook`, `posthog`) run in either place.

---

## `consoleAdapter(config?)`

Logs events to the console. Never makes a network request, so it always works — ideal for local dev
and as a safe fallback.

| Option   | Type               | Default          | Notes                                  |
| -------- | ------------------ | ---------------- | -------------------------------------- |
| `logger` | `Partial<Console>` | global `console` | Custom sink.                           |
| `pretty` | `boolean`          | `true`           | Use `console.group` + `console.table`. |
| `label`  | `string`           | `"[mcp-signal]"` | Prefix.                                |

```js
consoleAdapter({ label: '[my-widget]' });
```

---

## `webhookAdapter(config)`

POSTs event batches to any URL as `text/plain` (which keeps the request CORS-simple and beacon-able).

| Option        | Type                                                  | Default                  | Notes                                             |
| ------------- | ----------------------------------------------------- | ------------------------ | ------------------------------------------------- |
| `url`         | `string`                                              | —                        | **Required.** Destination endpoint.               |
| `contentType` | `'text/plain' \| 'application/x-www-form-urlencoded'` | `'text/plain'`           | Keep default to stay CORS-simple.                 |
| `transform`   | `(events) => unknown`                                 | `{ sdk, sentAt, batch }` | Shape the JSON body.                              |
| `headers`     | `Record<string,string>`                               | —                        | ⚠️ Non-empty forces a CORS preflight (see below). |
| `fetchImpl`   | `typeof fetch`                                        | global `fetch`           | For testing/SSR.                                  |

The default body is `{ sdk, sentAt, batch: SignalEvent[] }`; your receiver does
`JSON.parse(rawTextBody)`. Each event includes a `messageId` you can dedupe on.

**Headers caveat.** Any custom header (e.g. `Authorization`) makes the request non-simple → a CORS
preflight that is fragile in sandboxed widgets and impossible for teardown beacons. Prefer putting a
shared secret in the URL path or the body and validating it server-side.

`connectDomains` → the URL's origin (used by `cspMeta`).

---

## `posthogAdapter(config)`

Sends to PostHog's batch capture endpoint (`/batch/`). Works with PostHog Cloud US/EU and self-hosted.

| Option              | Type                        | Default         | Notes                                                              |
| ------------------- | --------------------------- | --------------- | ------------------------------------------------------------------ |
| `apiKey`            | `string`                    | —               | **Required.** Public project key (`phc_...`). Safe in the browser. |
| `host`              | `'us' \| 'eu' \| string`    | `'us'`          | Preset or a self-hosted base URL.                                  |
| `distinctId`        | `string \| (ctx) => string` | `ctx.sessionId` | See identity note below.                                           |
| `defaultProperties` | `Record<string,unknown>`    | —               | Merged below each event's own properties.                          |
| `fetchImpl`         | `typeof fetch`              | global `fetch`  | For testing/SSR.                                                   |

Each event maps to a PostHog event with `uuid` (= `messageId`, for server-side dedup), `$session_id`,
`$lib`/`$lib_version`, `mcp_host`, `widget_name`/`widget_version`, `theme`, `locale`, `display_mode`,
`$timezone`, then your `defaultProperties`, then the event's own `properties` (which win).

**Identity note.** No stable user identity exists inside a widget, so `distinct_id` defaults to the
anonymous per-load `sessionId` — PostHog will show one anonymous person per widget load. If you have a
real id (e.g. injected into the tool result and read from context), pass `distinctId`.

`connectDomains` → the resolved host origin (e.g. `https://eu.i.posthog.com`).

---

## `bridgeAdapter(config?)`

The recommended transport. Hands each batch to an app-only MCP tool via the host bridge; your server
forwards it. See [bridge.md](./bridge.md).

| Option     | Type                      | Default           | Notes                                |
| ---------- | ------------------------- | ----------------- | ------------------------------------ |
| `toolName` | `string`                  | `'record_signal'` | Must match the server tool's `name`. |
| `callTool` | `(name, args) => Promise` | auto-detected     | Override for certainty.              |

`connectDomains` → `[]` (it doesn't touch the network directly).

---

## `createSignalReceiver(config)` — server side

From `mcp-signal/server`. Receives bridge payloads and fans them out to destination adapters.

| Option       | Type                       | Notes                                             |
| ------------ | -------------------------- | ------------------------------------------------- |
| `adapters`   | `Adapter[]`                | **Required.** Destinations run server-side.       |
| `beforeSend` | `(event) => event \| null` | Optional server-side redact/enrich; `null` drops. |

Returns `{ ingest(payload), handleToolCall(args) }`. `handleToolCall` returns a valid MCP tool result
(`{ content: [...], structuredContent: { accepted } }`); `ingest` returns `{ accepted }`.

---

## `signalToolDefinition(options?)` — server side

Returns a ready-made descriptor for the app-only tool. See [bridge.md](./bridge.md).

| Option         | Type      | Default           | Notes                             |
| -------------- | --------- | ----------------- | --------------------------------- |
| `toolName`     | `string`  | `'record_signal'` |                                   |
| `openaiCompat` | `boolean` | `true`            | Also emit legacy `openai/*` meta. |

---

## CSP helpers

- `requiredConnectDomains(adapters)` → `string[]` of unique origins to allowlist.
- `cspMeta(adapters)` → `{ ui: { csp: { connectDomains: [...] } } }` to spread into your resource
  `_meta`.
