/**
 * mcp-signal/inline — server / build-time helpers for **server-rendered widgets**.
 *
 * Widgets that are shipped as raw HTML strings from an MCP server (no client bundler)
 * can't `import` the SDK — they must inline the standalone IIFE build into their markup
 * and boot it from the `window.McpSignal` global (see docs/setup.md). This entry does
 * exactly that, without any vendoring/codegen on the consumer's side:
 *
 * ```ts
 * import { injectSignal } from 'mcp-signal/inline';
 * const html = injectSignal(widgetHtml, {
 *   widgetName: 'weather',
 *   bridge: { toolName: 'record_signal' },
 *   autoCaptureInteractions: true,
 * });
 * ```
 *
 * `source` is the built IIFE embedded as a string (swapped in at build time), so a static
 * `import` is bundler-safe on any host — Vercel/Next serverless, Lambda, Cloudflare, Node.
 *
 * Pure string manipulation only: no `window`, no `fs`, no `Buffer`, zero dependencies.
 * The generated bootstrap runs *inside the widget*, so adapters are described
 * declaratively here and constructed from `window.McpSignal` at widget runtime — live
 * adapter objects (and any function-valued option like `beforeSend`) can't cross into an
 * HTML string, so they're intentionally absent from {@link InlineConfig}.
 */
import { IIFE_GLOBAL } from './constants';
import type { InteractionCaptureConfig, RetryConfig, SignalConfig } from './types';

/**
 * The standalone IIFE build (`dist/mcp-signal.global.js`) as a string, ready to drop
 * inside a `<script>` tag. Defines the `window.McpSignal` global.
 *
 * The value below is a build-time placeholder; `scripts/embed-inline-source.mjs` splices
 * the real minified bundle into `dist/inline.{js,cjs}` after `tsup` runs. Importing from
 * `../src/inline` (e.g. in tests) therefore sees the placeholder, not the bundle.
 */
export const source: string = '__MCP_SIGNAL_IIFE_PLACEHOLDER__';

/** Declarative descriptor for the bridge transport (recommended for CSP-locked widgets). */
export interface InlineBridgeConfig {
  /** App-only MCP tool the bridge calls. Default `"record_signal"`. */
  toolName?: string;
}

/** JSON-safe subset of the webhook adapter's config (functions are unsupported inline). */
export interface InlineWebhookConfig {
  url: string;
  contentType?: 'text/plain' | 'application/x-www-form-urlencoded';
  headers?: Record<string, string>;
}

/** JSON-safe subset of the PostHog adapter's config (only the string `distinctId` form). */
export interface InlinePosthogConfig {
  apiKey: string;
  host?: 'us' | 'eu' | (string & {});
  distinctId?: string;
  defaultProperties?: Record<string, unknown>;
}

/** JSON-safe subset of the console adapter's config. */
export interface InlineConsoleConfig {
  pretty?: boolean;
  label?: string;
}

/**
 * Declarative `createSignal` config for inline injection. Mirrors {@link SignalConfig}'s
 * JSON-safe options, minus `adapters`/`beforeSend` (not serializable), plus per-adapter
 * descriptors. Each descriptor present emits one `window.McpSignal.<name>Adapter(...)`
 * call in the generated bootstrap; omit them all and the widget falls back to the SDK's
 * default (`consoleAdapter`).
 */
export interface InlineConfig extends Omit<SignalConfig, 'adapters' | 'beforeSend'> {
  /** Route events through an app-only MCP tool on your server. CSP-free — the default choice. */
  bridge?: InlineBridgeConfig;
  /** POST batches directly to a URL. Needs the host CSP to allowlist the origin. */
  webhook?: InlineWebhookConfig | InlineWebhookConfig[];
  /** Send directly to PostHog. Needs the host CSP to allowlist the ingestion host. */
  posthog?: InlinePosthogConfig | InlinePosthogConfig[];
  /** Log to the widget console. `true` uses defaults; pass an object to configure. */
  console?: boolean | InlineConsoleConfig;
}

/** Re-export the interaction/retry shapes so consumers can type nested config. */
export type { InteractionCaptureConfig, RetryConfig };

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Break any `</script>` in a string so it can't prematurely close the `<script>` tag it's
 * embedded in. The HTML parser sees `<\/script`; the JS string is unaffected at runtime.
 */
function defuse(s: string): string {
  return s.split('</script').join('<\\/script');
}

/** Build the IIFE that boots `createSignal` inside the widget from `window.McpSignal`. */
function buildBootstrap(config: InlineConfig): string {
  const { bridge, webhook, posthog, console: consoleCfg, ...options } = config;

  const adapters: string[] = [];
  if (bridge !== undefined) adapters.push(`S.bridgeAdapter(${JSON.stringify(bridge)})`);
  for (const w of toArray(webhook)) adapters.push(`S.webhookAdapter(${JSON.stringify(w)})`);
  for (const p of toArray(posthog)) adapters.push(`S.posthogAdapter(${JSON.stringify(p)})`);
  if (consoleCfg !== undefined && consoleCfg !== false) {
    adapters.push(`S.consoleAdapter(${JSON.stringify(consoleCfg === true ? {} : consoleCfg)})`);
  }

  // `options` holds only JSON-safe scalars; adapters are appended as constructor calls so
  // they resolve against the widget's global. When no adapter is described we leave
  // `adapters` unset, so createSignal applies its documented default.
  const assignAdapters = adapters.length ? `o.adapters=[${adapters.join(',')}];` : '';
  return (
    `(function(){try{var S=window.${IIFE_GLOBAL};` +
    `if(!S||!S.createSignal)return;` +
    `var o=${JSON.stringify(options)};${assignAdapters}` +
    `S.createSignal(o);}catch(e){}})();`
  );
}

/**
 * Render a self-contained `<script>` tag: the inlined SDK bundle followed by a bootstrap
 * that calls `createSignal(config)`. Any `</script>` in the payload is defused, so the tag
 * is safe to splice into arbitrary HTML.
 */
export function renderInlineScript(config: InlineConfig = {}): string {
  const body = defuse(`${source}\n${buildBootstrap(config)}`);
  return `<script>${body}</script>`;
}

/**
 * Inject the SDK `<script>` (see {@link renderInlineScript}) into a widget HTML document.
 * Inserts just before `</head>`, else `</body>`, else appends. Index-based (never
 * `String.replace`, whose `$` substitution would corrupt the minified bundle).
 */
export function injectSignal(html: string, config: InlineConfig = {}): string {
  const script = renderInlineScript(config);
  for (const marker of ['</head>', '</body>']) {
    const i = html.indexOf(marker);
    if (i !== -1) return html.slice(0, i) + script + html.slice(i);
  }
  return html + script;
}
