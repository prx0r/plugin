# Privacy & data

`mcp-signal` is neutral plumbing. It has **no telemetry of its own, no phone-home, and no
hidden collection.** It sends exactly what you configure, to the destination you configure, and
nothing else. There is no "telemetry about the telemetry."

## What the SDK sends by default

For each event you emit (via `track()` or auto-capture), the SDK attaches a best-effort **context**
object, populated only where the value is reliably obtainable in the runtime:

| Field                            | Source                                                  | Sensitive?                      |
| -------------------------------- | ------------------------------------------------------- | ------------------------------- |
| `widgetName`, `widgetVersion`    | your config                                             | No                              |
| `sessionId`                      | `openai/widgetSessionId` if present, else a random UUID | No — anonymous, per widget load |
| `host`                           | best-effort runtime detection (`chatgpt`/`browser`/…)   | No                              |
| `theme`, `locale`, `displayMode` | host globals or `matchMedia`/`navigator.language`       | Low                             |
| `timeZone`                       | `Intl.DateTimeFormat().resolvedOptions()`               | Low                             |
| `viewport`                       | `window.innerWidth/Height`                              | Low                             |
| `sdk`                            | this package's name + version                           | No                              |

Auto-captured events carry only structural detail: interaction events record an element's
`data-mcp-signal` value, tag, and id — **never element text or input values**. Error events include the
message, source, line/column, and a truncated stack.

## What the SDK does **not** collect

- **No user identity.** There is no stable user id available inside a widget, and the SDK does not try
  to derive one. `distinct_id` (PostHog) defaults to the anonymous `sessionId`.
- **No fingerprinting.** It does not combine signals to identify a device or person, and does not read
  cookies, storage, history, or credentials.
- **No content.** It does not read your widget's DOM text, form values, or the conversation.

## You are responsible for what you add

Anything you put in `track(name, properties)` is sent as-is. **You are responsible for your end users'
privacy and for complying with applicable law** (GDPR, CCPA, etc.), including obtaining any consent you
need. Do not put personal data in event properties unless you intend to and are permitted to.

## Controls

- **Redact or drop per event** with `beforeSend`:

  ```js
  createSignal({
    adapters,
    beforeSend: (event) => {
      if (event.properties.email) event.properties.email = '[redacted]';
      if (event.event === 'private_action') return null; // drop entirely
      return event;
    },
  });
  ```

  A `beforeSend` that throws drops the event (fail-safe — a broken redactor can never leak).

- **Trim context** by redacting fields in `beforeSend`, e.g. `delete event.context.viewport`.

- **Redact server-side too.** `createSignalReceiver({ beforeSend })` runs on your trusted server —
  a good place to scrub before anything reaches your analytics vendor.

- **Turn it all off** with `enabled: false` — every method becomes a no-op and no listeners are
  attached. Useful behind your own consent gate:

  ```js
  createSignal({ enabled: userConsented, adapters });
  ```

## Where the data lives

The SDK forwards to _your_ destination (PostHog, your webhook, etc.). Their privacy terms and data
residency apply. PostHog offers US and EU hosts and self-hosting — choose per your requirements.
Consent-management and PII-scrubbing helpers are on the roadmap, not in v0.1.
