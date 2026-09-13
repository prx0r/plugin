/**
 * Coverage for defensive fallback branches — the code that only runs when a browser API
 * is missing or throws, which the jsdom happy path doesn't reproduce on its own.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSignal } from '../src/client';
import { uuid } from '../src/ids';
import { postSimple } from '../src/transport';
import { detectBridge } from '../src/host-bridge';
import { installContextRefresh, resolveContext } from '../src/context';
import { installErrorCapture } from '../src/errors';
import { installLifecycle } from '../src/lifecycle';
import { createDiagnostics } from '../src/diagnostics';
import { withRetry } from '../src/retry';
import { requiredConnectDomains } from '../src/csp';
import { webhookAdapter } from '../src/adapters/webhook';
import { posthogAdapter } from '../src/adapters/posthog';
import { bridgeAdapter } from '../src/adapters/bridge';
import { defineVisibility, fakeAdapter, mockFetch, setOpenAi, setVisibility } from './helpers';
import type { SignalEvent } from '../src/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function sampleEvent(): SignalEvent {
  return {
    event: 'e',
    properties: {},
    timestamp: '2026-07-15T00:00:00.000Z',
    messageId: 'id',
    context: {
      sessionId: 's',
      host: 'browser',
      sdk: { name: 'mcp-signal', version: '0' },
    },
  };
}

describe('uuid fallbacks', () => {
  const realCrypto = globalThis.crypto;
  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true });
  });

  it('uses getRandomValues when randomUUID is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (a: Uint8Array) => {
          for (let i = 0; i < a.length; i++) a[i] = i;
          return a;
        },
      },
    });
    expect(uuid()).toMatch(UUID_RE);
  });

  it('falls back to a valid v4 uuid when crypto is entirely absent', () => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    for (let i = 0; i < 20; i++) expect(uuid()).toMatch(UUID_RE); // variant nibble must always be 8-b
  });
});

describe('transport teardown fallbacks', () => {
  const nav = navigator as unknown as { sendBeacon?: unknown };

  it('uses keepalive fetch when no sendBeacon exists', async () => {
    const prev = nav.sendBeacon;
    delete nav.sendBeacon;
    const fetchImpl = mockFetch();
    await postSimple('https://x.example/i', 'b', { beacon: true, fetchImpl });
    nav.sendBeacon = prev;
    expect(fetchImpl.calls[0].init.keepalive).toBe(true);
  });

  it('swallows a throwing keepalive fetch on teardown', async () => {
    const prev = nav.sendBeacon;
    delete nav.sendBeacon;
    const fetchImpl = (() => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    await expect(
      postSimple('https://x.example/i', 'b', { beacon: true, fetchImpl }),
    ).resolves.toBeUndefined();
    nav.sendBeacon = prev;
  });

  it('throws in-session when no fetch is available', async () => {
    const g = globalThis as unknown as { fetch?: unknown };
    const prev = g.fetch;
    g.fetch = undefined;
    await expect(postSimple('https://x.example/i', 'b', {})).rejects.toThrow(
      /fetch is not available/,
    );
    g.fetch = prev;
  });
});

describe('host-bridge edge paths', () => {
  const restore = () =>
    Object.defineProperty(window, 'parent', { configurable: true, get: () => window });

  it('rejects on a tools/call timeout', async () => {
    vi.useFakeTimers();
    const clean = setOpenAi(undefined);
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => ({ postMessage() {} }),
    });
    const call = detectBridge()!;
    const promise = call('t', {});
    const assertion = expect(promise).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    restore();
    clean();
    vi.useRealTimers();
  });

  it('rejects when postMessage throws', async () => {
    const clean = setOpenAi(undefined);
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => ({
        postMessage() {
          throw new Error('post failed');
        },
      }),
    });
    await expect(detectBridge()!('t', {})).rejects.toThrow('post failed');
    restore();
    clean();
  });
});

describe('context fallbacks', () => {
  it('detects theme via matchMedia when window.openai is absent', () => {
    const clean = setOpenAi(undefined);
    const w = window as unknown as { matchMedia?: unknown };
    const prev = w.matchMedia;
    w.matchMedia = () => ({ matches: true });
    const ctx = resolveContext({});
    w.matchMedia = prev;
    clean();
    expect(ctx.theme).toBe('dark');
  });

  it('refresh handler is a no-op when there is no openai global', () => {
    const clean = setOpenAi(undefined);
    const ctx = resolveContext({});
    const uninstall = installContextRefresh(ctx);
    expect(() => window.dispatchEvent(new Event('openai:set_globals'))).not.toThrow();
    uninstall();
    clean();
  });
});

describe('errors fallbacks', () => {
  it('captures an error whose Error object has no stack', () => {
    const events: Array<{ props?: Record<string, unknown> }> = [];
    const uninstall = installErrorCapture((_e, props) => events.push({ props }));
    const err = new Error('x');
    delete err.stack;
    window.dispatchEvent(new ErrorEvent('error', { message: 'x', error: err }));
    uninstall();
    expect(events[0].props?.stack).toBeUndefined();
    expect(events[0].props?.message).toBe('x');
  });
});

describe('lifecycle re-show', () => {
  it('re-emits visible when the widget becomes visible again', () => {
    defineVisibility('visible');
    const emitted: string[] = [];
    const uninstall = installLifecycle({
      emit: (e) => emitted.push(e),
      flushBeacon() {},
      emitClosedOnce() {},
      onRestore() {},
    });
    setVisibility('hidden');
    setVisibility('visible');
    uninstall();
    expect(emitted.filter((e) => e === 'mcp_signal_visible').length).toBeGreaterThanOrEqual(2);
  });
});

describe('retry jitter', () => {
  afterEach(() => vi.useRealTimers());
  it('applies jitter by default and still succeeds', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValueOnce(new Error('1')).mockResolvedValueOnce('ok');
    const promise = withRetry(fn, { baseDelayMs: 10, maxRetries: 2 }); // jitter defaults to true
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
  });
});

describe('adapter edge cases', () => {
  it('bridge fires the tool call fire-and-forget on teardown', () => {
    const callTool = vi.fn(async () => undefined);
    const result = bridgeAdapter({ callTool }).send([sampleEvent()], { beacon: true });
    expect(result).toBeUndefined();
    expect(callTool).toHaveBeenCalledTimes(1);
  });

  it('webhook with a relative URL reports no connect domains', () => {
    expect(webhookAdapter({ url: '/webhook' }).connectDomains).toEqual([]);
  });

  it('posthog keeps an unparseable self-host string as its connect domain', () => {
    expect(posthogAdapter({ apiKey: 'phc', host: 'not-a-url' }).connectDomains).toEqual([
      'not-a-url',
    ]);
  });

  it('requiredConnectDomains tolerates adapters without connectDomains', () => {
    expect(requiredConnectDomains([{ name: 'x', send() {} }])).toEqual([]);
  });
});

describe('client edge cases', () => {
  const base = {
    autoCaptureLifecycle: false,
    autoCaptureErrors: false,
    flushIntervalMs: 0,
  } as const;

  it('exposes context via getContext (enabled and disabled)', () => {
    const enabled = createSignal({ ...base, adapters: [fakeAdapter()] });
    enabled.setContext({ plan: 'pro' });
    expect(enabled.getContext().plan).toBe('pro');

    const disabled = createSignal({ ...base, enabled: false });
    expect(disabled.getContext().sdk.name).toBe('mcp-signal');
    expect(disabled.queueLength).toBe(0);
  });

  it('isolates an adapter whose async init rejects', async () => {
    const adapter = {
      name: 'slow-init',
      init: () => Promise.reject(new Error('init boom')),
      send: () => {},
    };
    expect(() => createSignal({ ...base, adapters: [adapter] })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0)); // let the isolated rejection settle
  });

  it('shutdown is idempotent', async () => {
    const t = createSignal({ ...base, adapters: [fakeAdapter()] });
    await t.shutdown();
    await expect(t.shutdown()).resolves.toBeUndefined();
  });
});

describe('more defensive branches', () => {
  it('diagnostics log/warn emit when debug is on', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const diag = createDiagnostics(true);
    diag.log('a');
    diag.warn('b');
    expect(log).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    log.mockRestore();
    warn.mockRestore();
  });

  it('transport resolves in cors mode on a 2xx response', async () => {
    const fetchImpl = mockFetch([200]);
    await expect(
      postSimple('https://x.example/i', 'b', { fetchImpl, headers: { 'x-a': 'b' } }),
    ).resolves.toBeUndefined();
  });

  it('errors captures an event with a message but no error object', () => {
    const events: Array<{ props?: Record<string, unknown> }> = [];
    const uninstall = installErrorCapture((_e, props) => events.push({ props }));
    window.dispatchEvent(new ErrorEvent('error', { message: 'boom', filename: 'a.js' }));
    uninstall();
    expect(events).toHaveLength(1);
    expect(events[0].props?.stack).toBeUndefined();
  });

  it('bridge swallows a synchronous callTool throw on teardown', () => {
    const callTool = () => {
      throw new Error('x');
    };
    expect(() => bridgeAdapter({ callTool }).send([sampleEvent()], { beacon: true })).not.toThrow();
  });
});

describe('diagnostics with non-URL domains', () => {
  it('matches a raw (non-URL) connect domain string', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const uninstall = createDiagnostics(true).installCspWatch(['weird-domain']);
    const event = new Event('securitypolicyviolation') as Event & {
      violatedDirective?: string;
      blockedURI?: string;
    };
    event.violatedDirective = 'connect-src';
    event.blockedURI = 'weird-domain/x';
    window.dispatchEvent(event);
    uninstall();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
