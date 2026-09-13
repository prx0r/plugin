import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSignal } from '../src/client';
import { fakeAdapter } from './helpers';

const base = { autoCaptureLifecycle: false, autoCaptureErrors: false, flushIntervalMs: 0 } as const;

afterEach(() => {
  vi.useRealTimers();
});

describe('createSignal', () => {
  it('queues events and flushes them to the adapter', async () => {
    const adapter = fakeAdapter();
    const t = createSignal({ ...base, adapters: [adapter] });
    t.track('a', { x: 1 });
    t.track('b');
    expect(t.queueLength).toBe(2);
    await t.flush();
    expect(t.queueLength).toBe(0);
    expect(adapter.sent.map((e) => e.event)).toEqual(['a', 'b']);
    expect(adapter.sent[0].properties).toEqual({ x: 1 });
  });

  it('attaches context, timestamp, and a messageId to every event', async () => {
    const adapter = fakeAdapter();
    const t = createSignal({
      ...base,
      adapters: [adapter],
      widgetName: 'w',
      widgetVersion: '2',
    });
    t.track('a');
    await t.flush();
    const evt = adapter.sent[0];
    expect(evt.context.widgetName).toBe('w');
    expect(evt.context.widgetVersion).toBe('2');
    expect(evt.context.sessionId).toBeTruthy();
    expect(evt.context.sdk.name).toBe('mcp-signal');
    expect(typeof evt.timestamp).toBe('string');
    expect(typeof evt.messageId).toBe('string');
  });

  it('flushes automatically when the queue reaches batchSize', async () => {
    vi.useFakeTimers();
    const adapter = fakeAdapter();
    const t = createSignal({ ...base, adapters: [adapter], batchSize: 3 });
    t.track('a');
    t.track('b');
    expect(adapter.sent).toHaveLength(0);
    t.track('c');
    await vi.advanceTimersByTimeAsync(1);
    expect(adapter.sent.map((e) => e.event)).toEqual(['a', 'b', 'c']);
  });

  it('flushes on the periodic interval', async () => {
    vi.useFakeTimers();
    const adapter = fakeAdapter();
    const t = createSignal({ ...base, adapters: [adapter], flushIntervalMs: 1000 });
    t.track('a');
    await vi.advanceTimersByTimeAsync(1000);
    expect(adapter.sent.map((e) => e.event)).toEqual(['a']);
    await t.shutdown();
  });

  it('coalesces many tracks in one tick into a single flush', async () => {
    vi.useFakeTimers();
    const adapter = fakeAdapter();
    const t = createSignal({ ...base, adapters: [adapter], batchSize: 2 });
    t.track('a');
    t.track('b');
    t.track('c');
    t.track('d');
    await vi.advanceTimersByTimeAsync(1);
    expect(adapter.batches).toHaveLength(1);
    expect(adapter.sent).toHaveLength(4);
  });

  it('drops the oldest events past maxQueueSize', async () => {
    const adapter = fakeAdapter();
    const t = createSignal({ ...base, adapters: [adapter], maxQueueSize: 2, batchSize: 100 });
    t.track('a', { i: 0 });
    t.track('b', { i: 1 });
    t.track('c', { i: 2 });
    expect(t.queueLength).toBe(2);
    await t.flush();
    expect(adapter.sent.map((e) => e.properties.i)).toEqual([1, 2]);
  });

  it('is a hard no-op when disabled', async () => {
    const adapter = fakeAdapter();
    const t = createSignal({ ...base, adapters: [adapter], enabled: false });
    expect(t.enabled).toBe(false);
    t.track('a');
    await t.flush();
    expect(adapter.calls).toBe(0);
    expect(t.queueLength).toBe(0);
  });

  it('defaults to a console adapter when none are provided', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const t = createSignal({ ...base });
    expect(t.enabled).toBe(true);
    expect(() => t.track('a')).not.toThrow();
    logSpy.mockRestore();
  });

  it('merges setContext into subsequent events', async () => {
    const adapter = fakeAdapter();
    const t = createSignal({ ...base, adapters: [adapter] });
    t.setContext({ plan: 'pro' });
    t.track('a');
    await t.flush();
    expect(adapter.sent[0].context.plan).toBe('pro');
  });

  it('stops accepting events after shutdown', async () => {
    const adapter = fakeAdapter();
    const t = createSignal({ ...base, adapters: [adapter] });
    await t.shutdown();
    t.track('a');
    await t.flush();
    expect(adapter.sent.some((e) => e.event === 'a')).toBe(false);
  });
});
