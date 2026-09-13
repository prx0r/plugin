import { describe, expect, it } from 'vitest';
import { createSignal } from '../src/client';
import { fakeAdapter } from './helpers';
import type { Adapter } from '../src/types';

const base = {
  autoCaptureLifecycle: false,
  autoCaptureErrors: false,
  flushIntervalMs: 0,
  retry: { maxRetries: 0 },
} as const;

describe('adapter contract', () => {
  it('isolates an adapter that throws synchronously', async () => {
    const throwing: Adapter = {
      name: 'boom',
      send() {
        throw new Error('kaboom');
      },
    };
    const good = fakeAdapter();
    const t = createSignal({ ...base, adapters: [throwing, good] });
    t.track('a');
    await expect(t.flush()).resolves.toBeUndefined();
    expect(good.sent.map((e) => e.event)).toEqual(['a']);
  });

  it('isolates an adapter that rejects', async () => {
    const rejecting: Adapter = {
      name: 'reject',
      send: () => Promise.reject(new Error('nope')),
    };
    const good = fakeAdapter();
    const t = createSignal({ ...base, adapters: [rejecting, good] });
    t.track('a');
    await expect(t.flush()).resolves.toBeUndefined();
    expect(good.sent).toHaveLength(1);
  });

  it('passes the resolved context to adapter.init', () => {
    const adapter = fakeAdapter();
    createSignal({ ...base, adapters: [adapter], widgetName: 'w' });
    expect(adapter.initContext?.widgetName).toBe('w');
    expect(adapter.initContext?.sessionId).toBeTruthy();
  });
});
