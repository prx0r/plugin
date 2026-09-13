/**
 * Public type surface for mcp-signal.
 *
 * The one interface that matters most is {@link Adapter}: implement it and you can
 * send events anywhere. Everything else configures the core pipeline.
 */

/** Best-effort detection of the runtime the widget is rendered in. */
export type HostEnv = 'chatgpt' | 'mcp-apps' | 'mcp-ui' | 'browser' | 'unknown';

/** SDK self-identification attached to every event's context. */
export interface SdkInfo {
  name: 'mcp-signal';
  version: string;
}

/**
 * Non-invasive context attached to every event. Fields are best-effort: they are
 * present only when reliably obtainable in the current runtime. No user identity is
 * ever collected — `sessionId` is anonymous and scoped to a single widget load.
 */
export interface SignalContext {
  widgetName?: string;
  widgetVersion?: string;
  /** Stable for one widget load. `openai/widgetSessionId` when available, else a minted UUID. */
  sessionId: string;
  host: HostEnv;
  theme?: string;
  locale?: string;
  displayMode?: string;
  timeZone?: string;
  viewport?: { width: number; height: number };
  sdk: SdkInfo;
  /** Developer-supplied static context is merged in here. */
  [key: string]: unknown;
}

/** A single captured event. */
export interface SignalEvent {
  /** Event name, e.g. `"mcp_signal_loaded"` or a custom name passed to `track()`. */
  event: string;
  properties: Record<string, unknown>;
  /** ISO-8601 emit time. */
  timestamp: string;
  /** Idempotency key. Deduplicates retried/beacon double-sends downstream. */
  messageId: string;
  /** Snapshot of {@link SignalContext} at emit time. */
  context: SignalContext;
}

/** Options passed to {@link Adapter.send}. */
export interface SendOptions {
  /**
   * `false` (in-session): return a Promise; **reject to have the core retry**.
   * `true` (teardown): the page is going away — send fire-and-forget (sendBeacon /
   * keepalive), do not await, do not retry, keep the payload under ~60 KiB.
   */
  beacon: boolean;
  /** Abort signal enforcing the request timeout (in-session sends only). */
  signal?: AbortSignal;
}

/**
 * A destination for telemetry events — the central pluggable contract.
 *
 * Implement `name` and `send` (and optionally `init`) and nothing else. The core owns
 * batching, retries, teardown flushing, context, and error isolation. A `send` that
 * throws or rejects never reaches the widget.
 */
export interface Adapter {
  /** Unique, human-readable name shown in debug logs. */
  readonly name: string;
  /**
   * Origins this adapter needs to reach directly over HTTP from the widget, e.g.
   * `["https://us.i.posthog.com"]`. Used by {@link cspMeta} / {@link requiredConnectDomains}
   * to help declare the widget's CSP `connect-src`. Adapters that don't make direct
   * network calls (console, bridge) report `[]`.
   */
  readonly connectDomains?: string[];
  /** Optional one-time setup. Receives resolved context. Errors are isolated. */
  init?(context: SignalContext): void | Promise<void>;
  /** Transmit a batch. See {@link SendOptions} for the beacon contract. */
  send(events: SignalEvent[], options: SendOptions): void | Promise<void>;
}

/** Retry/backoff policy for in-session sends. */
export interface RetryConfig {
  /** Default 3. */
  maxRetries?: number;
  /** Default 1000. */
  baseDelayMs?: number;
  /** Default 30000. */
  maxDelayMs?: number;
  /** Default 2. */
  factor?: number;
  /** Full jitter on the delay. Default true. */
  jitter?: boolean;
}

/** Opt-in automatic capture of basic click interactions. */
export interface InteractionCaptureConfig {
  /** Capture clicks on elements carrying this attribute. Default `"data-mcp-signal"`. */
  attribute?: string;
  /** Also capture every other click (tag + id only, no text). Noisy. Default false. */
  captureAllClicks?: boolean;
  /** Event name emitted. Default `"mcp_signal_interaction"`. */
  eventName?: string;
}

/** Configuration for {@link createSignal}. */
export interface SignalConfig {
  /** Destinations. If empty/omitted, defaults to `[consoleAdapter()]`. */
  adapters?: Adapter[];
  widgetName?: string;
  widgetVersion?: string;
  /** Master switch. `false` makes every method a no-op and attaches no listeners. Default true. */
  enabled?: boolean;
  /** Auto-emit loaded/visible/hidden/closed. Default true. */
  autoCaptureLifecycle?: boolean;
  /** Auto-capture uncaught errors and unhandled rejections. Default true. */
  autoCaptureErrors?: boolean;
  /** Opt-in click capture. `true` uses defaults; pass an object to configure. Default false. */
  autoCaptureInteractions?: boolean | InteractionCaptureConfig;
  /** Flush when the queue reaches this many events. Default 20. */
  batchSize?: number;
  /** Periodic flush interval in ms. `0` disables the timer. Default 5000. */
  flushIntervalMs?: number;
  /** Backpressure cap; oldest events are dropped beyond this. Default 500. */
  maxQueueSize?: number;
  /** Per in-session send timeout in ms. Default 8000. */
  requestTimeoutMs?: number;
  retry?: RetryConfig;
  /** Redact or drop each event before it is queued. Return `null` to drop. */
  beforeSend?: (event: SignalEvent) => SignalEvent | null;
  /** Static context merged into every event. */
  context?: Record<string, unknown>;
  /** Force the session id (else `openai/widgetSessionId`, else a minted UUID). */
  sessionId?: string;
  /** Force host detection instead of auto-detecting. */
  host?: HostEnv;
  /** Verbose internal logging + CSP diagnostics. Default false. */
  debug?: boolean;
}

/** The object returned by {@link createSignal}. */
export interface SignalClient {
  /** Queue a custom event. No-op when disabled. Never throws. */
  track(event: string, properties?: Record<string, unknown>): void;
  /** Send everything queued now (in-session, awaitable, retried). */
  flush(): Promise<void>;
  /** Emit `mcp_signal_closed` once, flush, detach listeners, stop the timer. Idempotent. */
  shutdown(): Promise<void>;
  /** Merge additional static context applied to subsequent events. */
  setContext(patch: Record<string, unknown>): void;
  /** Read the resolved context (debugging). */
  getContext(): Readonly<SignalContext>;
  /** Current queue depth. */
  readonly queueLength: number;
  /** Resolved enabled flag. */
  readonly enabled: boolean;
}
