import { afterEach, describe, expect, it, vi } from 'vitest';
import { bridgeAdapter } from '../src/adapters/bridge';
import { setOpenAi } from './helpers';
import type { SignalEvent } from '../src/types';

function event(name: string): SignalEvent {
  return {
    event: name,
    properties: {},
    timestamp: '2026-07-15T00:00:00.000Z',
    messageId: 'id-1',
    context: {
      sessionId: 's',
      host: 'chatgpt',
      sdk: { name: 'mcp-signal', version: '0' },
    },
  };
}

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('bridgeAdapter', () => {
  it('calls the injected callTool with the event envelope', async () => {
    const callTool = vi.fn(async () => ({ ok: true }));
    const adapter = bridgeAdapter({ callTool });
    await adapter.send([event('a')], { beacon: false });
    expect(callTool).toHaveBeenCalledTimes(1);
    const [name, args] = callTool.mock.calls[0];
    expect(name).toBe('record_signal');
    expect(args.events).toHaveLength(1);
    expect((args.events as SignalEvent[])[0].event).toBe('a');
    expect(args.sdk).toBeTruthy();
    expect(args.sentAt).toBeTruthy();
  });

  it('honors a custom tool name', async () => {
    const callTool = vi.fn(async () => undefined);
    await bridgeAdapter({ toolName: 'log_events', callTool }).send([event('a')], { beacon: false });
    expect(callTool.mock.calls[0][0]).toBe('log_events');
  });

  it('auto-detects window.openai.callTool', async () => {
    const callTool = vi.fn(async () => undefined);
    cleanup = setOpenAi({ callTool });
    await bridgeAdapter().send([event('a')], { beacon: false });
    expect(callTool).toHaveBeenCalledTimes(1);
  });

  it('rejects (non-retryable) in-session when no bridge is available', async () => {
    const adapter = bridgeAdapter();
    await expect(adapter.send([event('a')], { beacon: false })).rejects.toMatchObject({
      retryable: false,
    });
  });

  it('is silent on the teardown path when no bridge is available', () => {
    const adapter = bridgeAdapter();
    expect(() => adapter.send([event('a')], { beacon: true })).not.toThrow();
  });

  it('reports no connect domains (it does not use the network)', () => {
    expect(bridgeAdapter().connectDomains).toEqual([]);
  });
});
