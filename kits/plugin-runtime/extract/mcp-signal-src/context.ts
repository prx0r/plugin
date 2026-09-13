import { SDK_NAME, SDK_VERSION } from './constants';
import { uuid } from './ids';
import type { HostEnv, SignalConfig, SignalContext } from './types';

/**
 * The subset of ChatGPT's injected `window.openai` global we read. Everything is
 * optional and accessed defensively — the global is absent in Claude/mcp-ui/plain
 * browsers, and the SDK never depends on it.
 */
interface OpenAiGlobals {
  theme?: string;
  locale?: string;
  displayMode?: string;
  toolResponseMetadata?: { _meta?: Record<string, unknown> } | null;
}

function getOpenAi(): OpenAiGlobals | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { openai?: OpenAiGlobals }).openai;
}

/** Best-effort detection of the widget runtime. */
export function detectHost(configHost?: HostEnv): HostEnv {
  if (configHost) return configHost;
  if (getOpenAi()) return 'chatgpt';
  if (typeof window === 'undefined') return 'unknown';
  try {
    if (window.self === window.top) return 'browser';
  } catch {
    // Cross-origin access to window.top throws inside a framed widget.
  }
  return 'unknown';
}

function resolveSessionId(config: SignalConfig): string {
  if (config.sessionId) return config.sessionId;
  const sid = getOpenAi()?.toolResponseMetadata?._meta?.['openai/widgetSessionId'];
  if (typeof sid === 'string' && sid.length > 0) return sid;
  return uuid();
}

function detectTheme(): string | undefined {
  const oa = getOpenAi();
  if (oa?.theme) return oa.theme;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      /* matchMedia can throw in some sandboxes */
    }
  }
  return undefined;
}

function detectLocale(): string | undefined {
  const oa = getOpenAi();
  if (oa?.locale) return oa.locale;
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return undefined;
}

function detectTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function detectViewport(): { width: number; height: number } | undefined {
  if (typeof window === 'undefined') return undefined;
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (typeof width !== 'number' || typeof height !== 'number') return undefined;
  return { width, height };
}

/** Build the context snapshot for this widget load. Pure and side-effect free. */
export function resolveContext(config: SignalConfig): SignalContext {
  const ctx: SignalContext = {
    sessionId: resolveSessionId(config),
    host: detectHost(config.host),
    sdk: { name: SDK_NAME, version: SDK_VERSION },
    ...config.context,
  };
  if (config.widgetName !== undefined) ctx.widgetName = config.widgetName;
  if (config.widgetVersion !== undefined) ctx.widgetVersion = config.widgetVersion;

  const theme = detectTheme();
  if (theme) ctx.theme = theme;
  const locale = detectLocale();
  if (locale) ctx.locale = locale;
  const displayMode = getOpenAi()?.displayMode;
  if (displayMode) ctx.displayMode = displayMode;
  const timeZone = detectTimeZone();
  if (timeZone) ctx.timeZone = timeZone;
  const viewport = detectViewport();
  if (viewport) ctx.viewport = viewport;

  return ctx;
}

/**
 * Keep theme/locale/displayMode fresh when ChatGPT dispatches `openai:set_globals`.
 * Mutates the passed context object in place (new events snapshot it by copy).
 * Returns an uninstall function.
 */
export function installContextRefresh(ctx: SignalContext): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const handler = () => {
    const oa = getOpenAi();
    if (!oa) return;
    if (oa.theme) ctx.theme = oa.theme;
    if (oa.locale) ctx.locale = oa.locale;
    if (oa.displayMode) ctx.displayMode = oa.displayMode;
  };
  window.addEventListener('openai:set_globals', handler);
  return () => window.removeEventListener('openai:set_globals', handler);
}
