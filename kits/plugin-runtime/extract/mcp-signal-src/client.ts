import { consoleAdapter } from './adapters/console';
import { DEFAULTS, EVENTS } from './constants';
import { installContextRefresh, resolveContext } from './context';
import { createDiagnostics } from './diagnostics';
import { installErrorCapture } from './errors';
import { uuid, nowIso } from './ids';
import { installInteractionCapture } from './interactions';
import { installLifecycle } from './lifecycle';
import { EventQueue } from './queue';
import { withRetry } from './retry';
import type { Adapter, SignalClient, SignalConfig, SignalContext, SignalEvent } from './types';

/**
 * Create a telemetry client for a widget. Attaches lifecycle/error capture, batches
 * events, and forwards them to the configured adapters. Every method is safe to call
 * from plain JS and never throws into your widget.
 */
export function createSignal(config: SignalConfig = {}): SignalClient {
  const enabled = config.enabled ?? DEFAULTS.enabled;
  if (!enabled) return createNoopClient(config);

  const diag = createDiagnostics(config.debug ?? DEFAULTS.debug);
  const adapters: Adapter[] =
    config.adapters && config.adapters.length > 0 ? config.adapters : [consoleAdapter()];
  if (!config.adapters || config.adapters.length === 0) {
    diag.log('no adapters configured; defaulting to consoleAdapter()');
  }

  const context = resolveContext(config);
  const batchSize = config.batchSize ?? DEFAULTS.batchSize;
  const flushIntervalMs = config.flushIntervalMs ?? DEFAULTS.flushIntervalMs;
  const maxQueueSize = config.maxQueueSize ?? DEFAULTS.maxQueueSize;
  const requestTimeoutMs = config.requestTimeoutMs ?? DEFAULTS.requestTimeoutMs;

  const queue = new EventQueue(maxQueueSize, (dropped) =>
    diag.warn(`queue overflow: dropped ${dropped} oldest event(s)`),
  );

  let closedEmitted = false;
  let pendingFlush = false;
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  // Initialize adapters, isolating any failure.
  for (const adapter of adapters) {
    try {
      const maybe = adapter.init?.(context);
      if (maybe && typeof (maybe as Promise<void>).then === 'function') {
        (maybe as Promise<void>).catch((err) =>
          diag.warn(`adapter "${adapter.name}" init failed`, err),
        );
      }
    } catch (err) {
      diag.warn(`adapter "${adapter.name}" init failed`, err);
    }
  }

  function makeEvent(event: string, properties?: Record<string, unknown>): SignalEvent {
    return {
      event,
      properties: properties ?? {},
      timestamp: nowIso(),
      messageId: uuid(),
      context: { ...context },
    };
  }

  function enqueue(event: string, properties?: Record<string, unknown>): void {
    if (disposed) return;
    let evt = makeEvent(event, properties);
    if (config.beforeSend) {
      try {
        const result = config.beforeSend(evt);
        if (!result) return;
        evt = result;
      } catch (err) {
        diag.warn('beforeSend threw; dropping event', err);
        return;
      }
    }
    queue.push(evt);
    if (queue.length >= batchSize) scheduleFlush();
  }

  function scheduleFlush(): void {
    if (pendingFlush) return;
    pendingFlush = true;
    setTimeout(() => {
      pendingFlush = false;
      void flush();
    }, 0);
  }

  async function sendToAdapter(adapter: Adapter, batch: SignalEvent[]): Promise<void> {
    await withRetry(async () => {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
      const timeoutId = controller
        ? setTimeout(() => controller.abort(), requestTimeoutMs)
        : undefined;
      try {
        await adapter.send(batch, { beacon: false, signal: controller?.signal });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }, config.retry);
  }

  async function flush(): Promise<void> {
    const batch = queue.drain();
    if (batch.length === 0) return;
    const results = await Promise.allSettled(adapters.map((a) => sendToAdapter(a, batch)));
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        diag.warn(`adapter "${adapters[i].name}" send failed after retries`, result.reason);
      }
    });
  }

  function flushBeacon(reason: string): void {
    const batch = queue.drain();
    if (batch.length === 0) return;
    diag.log(`beacon flush (${reason}): ${batch.length} event(s)`);
    for (const adapter of adapters) {
      try {
        const maybe = adapter.send(batch, { beacon: true });
        if (maybe && typeof (maybe as Promise<void>).then === 'function') {
          (maybe as Promise<void>).catch(() => undefined);
        }
      } catch {
        // Never let a teardown send throw.
      }
    }
  }

  function emitClosedOnce(): void {
    if (closedEmitted) return;
    closedEmitted = true;
    enqueue(EVENTS.CLOSED);
  }

  const uninstalls: Array<() => void> = [];

  if (config.autoCaptureLifecycle ?? DEFAULTS.autoCaptureLifecycle) {
    uninstalls.push(
      installLifecycle({
        emit: enqueue,
        flushBeacon,
        emitClosedOnce,
        onRestore: () => {
          closedEmitted = false;
        },
      }),
    );
  }
  if (config.autoCaptureErrors ?? DEFAULTS.autoCaptureErrors) {
    uninstalls.push(installErrorCapture(enqueue));
  }
  const interactionCfg = config.autoCaptureInteractions ?? DEFAULTS.autoCaptureInteractions;
  if (interactionCfg) {
    uninstalls.push(
      installInteractionCapture(enqueue, typeof interactionCfg === 'object' ? interactionCfg : {}),
    );
  }
  uninstalls.push(installContextRefresh(context));

  const allDomains = adapters.flatMap((a) => a.connectDomains ?? []);
  uninstalls.push(diag.installCspWatch(allDomains));

  if (flushIntervalMs > 0 && typeof setInterval !== 'undefined') {
    timer = setInterval(() => {
      if (queue.length > 0) void flush();
    }, flushIntervalMs);
    // Don't keep a Node process alive on account of the telemetry timer.
    (timer as unknown as { unref?: () => void }).unref?.();
  }

  return {
    track(event, properties) {
      enqueue(event, properties);
    },
    async flush() {
      await flush();
    },
    async shutdown() {
      if (disposed) return;
      emitClosedOnce();
      for (const uninstall of uninstalls) {
        try {
          uninstall();
        } catch {
          /* ignore */
        }
      }
      if (timer) clearInterval(timer);
      disposed = true;
      await flush();
    },
    setContext(patch) {
      Object.assign(context, patch);
    },
    getContext() {
      return context;
    },
    get queueLength() {
      return queue.length;
    },
    get enabled() {
      return true;
    },
  };
}

function createNoopClient(config: SignalConfig): SignalClient {
  const context = resolveContext(config);
  return {
    track() {},
    async flush() {},
    async shutdown() {},
    setContext() {},
    getContext() {
      return context;
    },
    get queueLength() {
      return 0;
    },
    get enabled() {
      return false;
    },
  };
}
