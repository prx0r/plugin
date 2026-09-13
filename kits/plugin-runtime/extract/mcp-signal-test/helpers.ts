import { vi } from 'vitest';
import type { Adapter, SendOptions, SignalContext, SignalEvent } from '../src/types';

export interface FakeAdapter extends Adapter {
  batches: SignalEvent[][];
  beaconBatches: SignalEvent[][];
  sent: SignalEvent[];
  calls: number;
  initContext?: SignalContext;
}

/** An in-memory adapter that records what it receives. `failTimes` rejects the first N in-session sends. */
export function fakeAdapter(opts: { name?: string; failTimes?: number } = {}): FakeAdapter {
  let remainingFails = opts.failTimes ?? 0;
  const adapter: FakeAdapter = {
    name: opts.name ?? 'fake',
    connectDomains: [],
    batches: [],
    beaconBatches: [],
    sent: [],
    calls: 0,
    init(context: SignalContext) {
      adapter.initContext = context;
    },
    send(batch: SignalEvent[], options: SendOptions) {
      adapter.calls += 1;
      if (options.beacon) {
        adapter.beaconBatches.push(batch);
        adapter.sent.push(...batch);
        return;
      }
      if (remainingFails > 0) {
        remainingFails -= 1;
        return Promise.reject(new Error('fake adapter failure'));
      }
      adapter.batches.push(batch);
      adapter.sent.push(...batch);
      return Promise.resolve();
    },
  };
  return adapter;
}

export interface MockFetch {
  (input: unknown, init?: RequestInit): Promise<Response>;
  calls: Array<{ url: string; init: RequestInit }>;
}

/** A fetch stand-in. `script` items: 'reject' throws, a number sets the status, else 200. */
export function mockFetch(script?: Array<'reject' | number>): MockFetch {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const fn = vi.fn(async (input: unknown, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    const step = script?.[i++] ?? 'ok';
    if (step === 'reject') throw new Error('network error');
    const status = typeof step === 'number' ? step : 200;
    return { status, ok: status < 400 } as Response;
  }) as unknown as MockFetch;
  fn.calls = calls;
  return fn;
}

/** Install a navigator.sendBeacon mock. Returns recorded calls + a restore fn. */
export function installSendBeaconMock(result = true) {
  const calls: Array<{ url: string; data: unknown }> = [];
  const fn = vi.fn((url: string, data: unknown) => {
    calls.push({ url: String(url), data });
    return result;
  });
  const nav = navigator as unknown as { sendBeacon?: unknown };
  const previous = nav.sendBeacon;
  nav.sendBeacon = fn;
  return {
    calls,
    fn,
    restore() {
      nav.sendBeacon = previous;
    },
  };
}

/** Define document.visibilityState without dispatching an event. */
export function defineVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

/** Define visibilityState and dispatch visibilitychange. */
export function setVisibility(state: 'visible' | 'hidden'): void {
  defineVisibility(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

export function dispatchPageHide(persisted = false): void {
  const event = new Event('pagehide') as Event & { persisted?: boolean };
  event.persisted = persisted;
  window.dispatchEvent(event);
}

export function dispatchPageShow(persisted: boolean): void {
  const event = new Event('pageshow') as Event & { persisted?: boolean };
  event.persisted = persisted;
  window.dispatchEvent(event);
}

/** Set window.openai for a test and return a cleanup fn. */
export function setOpenAi(value: Record<string, unknown> | undefined): () => void {
  const w = window as unknown as { openai?: unknown };
  const previous = w.openai;
  w.openai = value;
  return () => {
    w.openai = previous;
  };
}
