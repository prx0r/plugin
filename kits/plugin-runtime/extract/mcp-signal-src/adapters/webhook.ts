import { SDK_NAME, SDK_VERSION } from '../constants';
import { nowIso } from '../ids';
import { postSimple } from '../transport';
import type { Adapter, SignalEvent } from '../types';

export interface WebhookAdapterConfig {
  /** Destination URL. Receives a POST with a JSON body (sent as `text/plain`). */
  url: string;
  /** Body content type. Default `text/plain` (keeps the request CORS-simple). */
  contentType?: 'text/plain' | 'application/x-www-form-urlencoded';
  /** Shape the payload. Default `{ sdk, sentAt, batch }`. Result is JSON-stringified. */
  transform?: (events: SignalEvent[]) => unknown;
  /**
   * Custom headers. WARNING: any header beyond the CORS-safelisted set forces the
   * request into `cors` mode + a preflight, which is fragile inside sandboxed widgets
   * and impossible for teardown beacons. Prefer putting a shared secret in the body or
   * URL path. Empty by default.
   */
  headers?: Record<string, string>;
  /** Override `fetch` (testing/SSR). */
  fetchImpl?: typeof fetch;
}

function safeOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/**
 * POSTs event batches to any URL. Sends the JSON body as `text/plain` with no custom
 * headers so the request stays CORS-simple and survives page teardown via beacon.
 * Usable client-side (direct) or server-side (inside a receiver).
 */
export function webhookAdapter(config: WebhookAdapterConfig): Adapter {
  if (!config.url) throw new Error('webhookAdapter: `url` is required');
  const origin = safeOrigin(config.url);
  const hasCustomHeaders = !!config.headers && Object.keys(config.headers).length > 0;

  return {
    name: 'webhook',
    connectDomains: origin ? [origin] : [],
    send(events: SignalEvent[], { beacon, signal }) {
      const payload = config.transform
        ? config.transform(events)
        : { sdk: { name: SDK_NAME, version: SDK_VERSION }, sentAt: nowIso(), batch: events };
      const body = JSON.stringify(payload);
      return postSimple(config.url, body, {
        beacon,
        signal,
        fetchImpl: config.fetchImpl,
        contentType: config.contentType ?? 'text/plain;charset=UTF-8',
        headers: config.headers,
        mode: hasCustomHeaders ? 'cors' : 'no-cors',
      });
    },
  };
}
