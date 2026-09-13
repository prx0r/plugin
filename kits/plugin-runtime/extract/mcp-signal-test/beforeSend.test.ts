import { describe, expect, it } from 'vitest';
import { createSignal } from '../src/client';
import { dispatchPageHide, fakeAdapter } from './helpers';

const base = { autoCaptureLifecycle: false, autoCaptureErrors: false, flushIntervalMs: 0 } as const;

describe('beforeSend', () => {
  it('can mutate/redact an event', async () => {
    const adapter = fakeAdapter();
    const t = createSignal({
      ...base,
      adapters: [adapter],
      beforeSend: (e) => ({ ...e, properties: { ...e.properties, email: '[redacted]' } }),
    });
    t.track('signup', { email: 'user@example.com' });
    await t.flush();
    expect(adapter.sent[0].properties.email).toBe('[redacted]');
  });

  it('drops an event when it returns null', async () => {
    const adapter = fakeAdapter();
    const t = createSignal({
      ...base,
      adapters: [adapter],
      beforeSend: (e) => (e.event === 'secret' ? null : e),
    });
    t.track('secret');
    t.track('ok');
    await t.flush();
    expect(adapter.sent.map((e) => e.event)).toEqual(['ok']);
  });

  it('drops the event (fail-safe) when it throws', async () => {
    const adapter = fakeAdapter();
    const t = createSignal({
      ...base,
      adapters: [adapter],
      beforeSend: () => {
        throw new Error('bad redactor');
      },
    });
    expect(() => t.track('a')).not.toThrow();
    await t.flush();
    expect(adapter.sent).toHaveLength(0);
  });

  it('applies to teardown-flushed events too', async () => {
    const adapter = fakeAdapter();
    const t = createSignal({
      adapters: [adapter],
      autoCaptureErrors: false,
      flushIntervalMs: 0,
      beforeSend: (e) => ({ ...e, properties: { ...e.properties, red: true } }),
    });
    dispatchPageHide();
    const beaconed = adapter.beaconBatches.flat();
    expect(beaconed.length).toBeGreaterThan(0);
    expect(beaconed.every((e) => e.properties.red === true)).toBe(true);
    expect(beaconed.some((e) => e.event === 'mcp_signal_closed')).toBe(true);
  });
});
