import { POSTHOG_HOSTS, SDK_NAME, SDK_VERSION } from '../constants';
import { postSimple } from '../transport';
import type { Adapter, SignalContext, SignalEvent } from '../types';

export interface PostHogAdapterConfig {
  /** Public project API key (`phc_...`). Safe in the browser; sent in the body. */
  apiKey: string;
  /** `'us'` (default), `'eu'`, or a self-hosted base URL like `https://ph.example.com`. */
  host?: 'us' | 'eu' | (string & {});
  /**
   * Resolve the PostHog `distinct_id`. Defaults to the anonymous `sessionId`, since no
   * stable user identity is available inside a widget. Pass a value or a function to use
   * your own (e.g. an id you injected into the tool result).
   */
  distinctId?: string | ((context: SignalContext) => string);
  /** Extra properties merged into every event (below the event's own properties). */
  defaultProperties?: Record<string, unknown>;
  /** Override `fetch` (testing/SSR). */
  fetchImpl?: typeof fetch;
}

function resolveHost(host?: string): string {
  if (!host || host === 'us') return POSTHOG_HOSTS.us;
  if (host === 'eu') return POSTHOG_HOSTS.eu;
  return host.replace(/\/+$/, '');
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function toPosthogEvent(event: SignalEvent, config: PostHogAdapterConfig) {
  const ctx = event.context;
  const distinctId =
    typeof config.distinctId === 'function'
      ? config.distinctId(ctx)
      : (config.distinctId ?? ctx.sessionId);
  return {
    event: event.event,
    uuid: event.messageId,
    timestamp: event.timestamp,
    properties: {
      distinct_id: distinctId,
      $session_id: ctx.sessionId,
      $lib: SDK_NAME,
      $lib_version: SDK_VERSION,
      mcp_host: ctx.host,
      widget_name: ctx.widgetName,
      widget_version: ctx.widgetVersion,
      theme: ctx.theme,
      locale: ctx.locale,
      display_mode: ctx.displayMode,
      $timezone: ctx.timeZone,
      ...config.defaultProperties,
      ...event.properties,
    },
  };
}

/**
 * Sends events to PostHog's batch capture endpoint (`/batch/`). Works with PostHog
 * Cloud US/EU and self-hosted instances. Sends as `text/plain` with the public key in
 * the body (no auth header) to stay CORS-simple. Identical code runs client-side
 * (direct — needs the host allowlisted in CSP) or server-side (inside a receiver).
 *
 * Note: with no stable identity, `distinct_id` defaults to the per-load `sessionId`, so
 * PostHog will show one anonymous person per widget load unless you supply `distinctId`.
 */
export function posthogAdapter(config: PostHogAdapterConfig): Adapter {
  if (!config.apiKey) throw new Error('posthogAdapter: `apiKey` is required');
  const base = resolveHost(config.host);
  const endpoint = `${base}/batch/`;

  return {
    name: 'posthog',
    connectDomains: [originOf(base)],
    send(events: SignalEvent[], { beacon, signal }) {
      const body = JSON.stringify({
        api_key: config.apiKey,
        historical_migration: false,
        batch: events.map((e) => toPosthogEvent(e, config)),
      });
      return postSimple(endpoint, body, {
        beacon,
        signal,
        fetchImpl: config.fetchImpl,
        contentType: 'text/plain;charset=UTF-8',
        mode: 'no-cors',
      });
    },
  };
}
