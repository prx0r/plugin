import type { Adapter } from './types';

/**
 * Collect the unique origins a set of adapters needs to reach directly over HTTP. Use
 * this to declare your widget's CSP `connect-src` so direct-HTTP adapters aren't blocked.
 * Adapters that don't make direct calls (console, bridge) contribute nothing.
 */
export function requiredConnectDomains(adapters: Adapter[]): string[] {
  const set = new Set<string>();
  for (const adapter of adapters) {
    for (const domain of adapter.connectDomains ?? []) set.add(domain);
  }
  return [...set];
}

/**
 * Build the `_meta.ui.csp` fragment to spread into your `ui://` resource registration:
 *
 * ```ts
 * const resourceMeta = { ...cspMeta([posthogAdapter({ apiKey, host: 'eu' })]) };
 * // => { ui: { csp: { connectDomains: ['https://eu.i.posthog.com'] } } }
 * ```
 *
 * (ChatGPT reads the legacy `openai/widgetCSP.connect_domains`; see docs/limitations.md.)
 */
export function cspMeta(adapters: Adapter[]): {
  ui: { csp: { connectDomains: string[] } };
} {
  return { ui: { csp: { connectDomains: requiredConnectDomains(adapters) } } };
}
