# Writing your own adapter

An adapter is the entire integration surface. Implement a two-property object and you can send events
anywhere. The core owns batching, retries, teardown flushing, context, and error isolation — you only
transmit.

## The contract

```ts
interface Adapter {
  readonly name: string;
  readonly connectDomains?: string[]; // origins you POST to directly (for the CSP helper)
  init?(context: SignalContext): void | Promise<void>;
  send(
    events: SignalEvent[],
    options: { beacon: boolean; signal?: AbortSignal },
  ): void | Promise<void>;
}
```

### `send(events, { beacon, signal })` — the one method that matters

- **`beacon: false` (in-session).** Return a `Promise`. **Reject to have the core retry** (exponential
  backoff). Resolve on success. The `signal` aborts on the request timeout.
- **`beacon: true` (teardown).** The page is going away. Send **fire-and-forget** — do not await, do
  not retry, keep the payload under ~60 KiB. Use `navigator.sendBeacon` or `fetch(url, { keepalive:
true })`.

Throwing or rejecting **never** reaches the widget — the core catches everything and (in `debug`)
logs it. Adapters are isolated from each other: one failing destination doesn't affect the others.

### `init(context)` (optional)

Called once with the resolved context. Use it to log a ready line or precompute something. Errors are
isolated.

### `connectDomains` (optional)

If you POST directly from the widget, list the origins so `cspMeta()` / `requiredConnectDomains()` can
help users allowlist you. Return `[]` (or omit) if you don't touch the network directly.

## A minimal example

```ts
import type { Adapter, SignalEvent } from 'mcp-signal';

export function myAdapter(config: { url: string }): Adapter {
  const origin = new URL(config.url).origin;
  return {
    name: 'my-destination',
    connectDomains: [origin],
    send(events: SignalEvent[], { beacon }) {
      const body = JSON.stringify({ batch: events });
      // Keep it CORS-simple: text/plain, no custom headers.
      if (beacon) {
        navigator.sendBeacon?.(config.url, new Blob([body], { type: 'text/plain' }));
        return;
      }
      return fetch(config.url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body,
      }).then(() => undefined);
    },
  };
}
```

Prefer not to hand-roll the HTTP? The webhook and PostHog adapters share an internal `postSimple`
helper; the pattern above mirrors it. Copy it and swap the payload shaping.

## Running server-side

If your adapter only uses `fetch` and guards `navigator`/`window` behind the `beacon` branch, it works
**unchanged** inside `createSignalReceiver` on the server. That's how `posthogAdapter` and
`webhookAdapter` run in both places.

## Testing your adapter

Inject a fake `fetch` (and, for beacons, a fake `sendBeacon`) and assert what you send:

```ts
import { describe, expect, it, vi } from 'vitest';

it('posts a batch', async () => {
  const fetchImpl = vi.fn(async () => ({ status: 200, ok: true }) as Response);
  const adapter = myAdapter({ url: 'https://x.example/in' });
  // pass your own fetch via config, or stub global fetch
  await adapter.send([/* event */], { beacon: false });
  expect(fetchImpl).toHaveBeenCalled();
});
```

The repo's `test/helpers.ts` (`fakeAdapter`, `mockFetch`, `installSendBeaconMock`) shows the full
pattern, and `test/contract.test.ts` is the contract every adapter should satisfy (errors isolated,
`init` receives context).
