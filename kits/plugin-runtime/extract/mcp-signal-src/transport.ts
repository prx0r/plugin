/**
 * A single CORS-simple POST helper shared by the webhook and PostHog adapters.
 *
 * Why it looks the way it does — widgets run in a null/opaque origin under a strict
 * host CSP, so:
 *   - In-session sends use `mode: 'no-cors'`. A CORS-simple POST to an ingest host that
 *     returns no `Access-Control-Allow-Origin` is still *received* by the server, but a
 *     `cors`-mode fetch would reject on the unreadable response — a false negative that
 *     would trigger pointless retries and duplicate delivery. `no-cors` resolves once
 *     the request leaves the tab and rejects only when egress is actually blocked.
 *   - Bodies are `text/plain` with no custom headers, so the request stays "simple" and
 *     never triggers a CORS preflight (preflights fail during page teardown).
 *   - Teardown uses `navigator.sendBeacon` (falling back to keepalive fetch), which
 *     survives the widget being torn down.
 */
export interface PostSimpleOptions {
  /** Teardown path: fire-and-forget via sendBeacon/keepalive; never rejects. */
  beacon?: boolean;
  /** In-session near-teardown hint: use keepalive on the fetch. */
  keepalive?: boolean;
  /** Defaults to `text/plain;charset=UTF-8` (a CORS-safelisted content type). */
  contentType?: string;
  /** Defaults to `no-cors` unless custom headers force `cors`. */
  mode?: 'no-cors' | 'cors';
  /** Custom headers. Non-empty forces `cors` mode + a preflight (see webhook docs). */
  headers?: Record<string, string>;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  sendBeaconImpl?: (url: string, data: BodyInit) => boolean;
}

function resolveFetch(opts: PostSimpleOptions): typeof fetch | undefined {
  if (opts.fetchImpl) return opts.fetchImpl;
  return typeof fetch !== 'undefined' ? fetch : undefined;
}

function resolveSendBeacon(
  opts: PostSimpleOptions,
): ((url: string, data: BodyInit) => boolean) | undefined {
  if (opts.sendBeaconImpl) return opts.sendBeaconImpl;
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    return navigator.sendBeacon.bind(navigator);
  }
  return undefined;
}

export async function postSimple(
  url: string,
  body: string,
  opts: PostSimpleOptions = {},
): Promise<void> {
  const contentType = opts.contentType ?? 'text/plain;charset=UTF-8';

  // ---- Teardown path: fire-and-forget, never rejects ----
  if (opts.beacon) {
    const sendBeacon = resolveSendBeacon(opts);
    if (sendBeacon) {
      try {
        const blob = new Blob([body], { type: contentType });
        if (sendBeacon(url, blob)) return;
      } catch {
        // fall through to keepalive fetch
      }
    }
    const f = resolveFetch(opts);
    if (f) {
      try {
        void f(url, {
          method: 'POST',
          body,
          keepalive: true,
          mode: opts.mode ?? 'no-cors',
          headers: { 'Content-Type': contentType, ...opts.headers },
        });
      } catch {
        // best-effort during teardown
      }
    }
    return;
  }

  // ---- In-session path: awaitable, rejection => the core retries ----
  const f = resolveFetch(opts);
  if (!f) throw new Error('mcp-signal: fetch is not available in this environment');

  const hasCustomHeaders = !!opts.headers && Object.keys(opts.headers).length > 0;
  const mode = opts.mode ?? (hasCustomHeaders ? 'cors' : 'no-cors');
  const headers = { 'Content-Type': contentType, ...opts.headers };

  const init: RequestInit = { method: 'POST', body, mode, headers };
  if (opts.signal) init.signal = opts.signal;
  if (opts.keepalive) init.keepalive = true;

  const res = await f(url, init);

  // In no-cors mode the response is opaque (status 0) — resolution == success.
  // In cors mode we can inspect status; treat 5xx as retryable.
  if (mode !== 'no-cors' && res && typeof res.status === 'number' && res.status >= 500) {
    throw new Error(`mcp-signal: destination returned HTTP ${res.status}`);
  }
}
