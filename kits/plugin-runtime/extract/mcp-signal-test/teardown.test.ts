import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSignal } from '../src/client';
import {
  defineVisibility,
  dispatchPageHide,
  dispatchPageShow,
  fakeAdapter,
  setVisibility,
} from './helpers';
import type { SignalClient } from '../src/types';

const base = {
  autoCaptureErrors: false,
  autoCaptureInteractions: false,
  flushIntervalMs: 0,
} as const;
let client: SignalClient | undefined;

beforeEach(() => defineVisibility('visible'));
afterEach(async () => {
  await client?.shutdown();
  client = undefined;
});

const beaconedNames = (a: ReturnType<typeof fakeAdapter>) =>
  a.beaconBatches.flat().map((e) => e.event);

describe('lifecycle + teardown', () => {
  it('emits loaded (and visible) on start', async () => {
    const adapter = fakeAdapter();
    client = createSignal({ ...base, adapters: [adapter] });
    await client.flush();
    const names = adapter.sent.map((e) => e.event);
    expect(names).toContain('mcp_signal_loaded');
    expect(names).toContain('mcp_signal_visible');
  });

  it('beacon-flushes on visibilitychange -> hidden', () => {
    const adapter = fakeAdapter();
    client = createSignal({ ...base, adapters: [adapter] });
    client.track('custom');
    setVisibility('hidden');
    const names = beaconedNames(adapter);
    expect(names).toContain('custom');
    expect(names).toContain('mcp_signal_hidden');
  });

  it('emits mcp_signal_closed exactly once on pagehide', () => {
    const adapter = fakeAdapter();
    client = createSignal({ ...base, adapters: [adapter] });
    dispatchPageHide();
    dispatchPageHide();
    const closed = beaconedNames(adapter).filter((n) => n === 'mcp_signal_closed');
    expect(closed).toHaveLength(1);
  });

  it('does not send the same event twice across hidden then pagehide', () => {
    const adapter = fakeAdapter();
    client = createSignal({ ...base, adapters: [adapter] });
    client.track('x');
    setVisibility('hidden');
    client.track('y');
    dispatchPageHide();
    const all = adapter.sent.map((e) => e.event);
    expect(all.filter((n) => n === 'x')).toHaveLength(1);
    expect(all.filter((n) => n === 'y')).toHaveLength(1);
  });

  it('re-arms closed after a bfcache restore (pageshow persisted)', () => {
    const adapter = fakeAdapter();
    client = createSignal({ ...base, adapters: [adapter] });
    dispatchPageHide();
    dispatchPageShow(true);
    dispatchPageHide();
    const closed = beaconedNames(adapter).filter((n) => n === 'mcp_signal_closed');
    expect(closed).toHaveLength(2);
  });
});
