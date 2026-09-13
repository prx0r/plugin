import { describe, expect, it } from 'vitest';
import { webhookAdapter } from '../src/adapters/webhook';
import { installSendBeaconMock, mockFetch } from './helpers';
import type { SignalEvent } from '../src/types';

function event(name: string): SignalEvent {
  return {
    event: name,
    properties: {},
    timestamp: '2026-07-15T00:00:00.000Z',
    messageId: 'id-1',
    context: {
      sessionId: 's',
      host: 'browser',
      sdk: { name: 'mcp-signal', version: '0' },
    },
  };
}

describe('webhookAdapter', () => {
  it('POSTs the default { sdk, sentAt, batch } envelope as text/plain', async () => {
    const fetchImpl = mockFetch();
    const adapter = webhookAdapter({ url: 'https://hook.example/in', fetchImpl });
    await adapter.send([event('a')], { beacon: false });
    const { url, init } = fetchImpl.calls[0];
    expect(url).toBe('https://hook.example/in');
    expect(init.mode).toBe('no-cors');
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/text\/plain/);
    const body = JSON.parse(init.body as string);
    expect(body.sdk.name).toBe('mcp-signal');
    expect(body.batch).toHaveLength(1);
    expect(body.batch[0].event).toBe('a');
  });

  it('honors a custom transform', async () => {
    const fetchImpl = mockFetch();
    const adapter = webhookAdapter({
      url: 'https://hook.example/in',
      fetchImpl,
      transform: (events) => ({ count: events.length }),
    });
    await adapter.send([event('a'), event('b')], { beacon: false });
    expect(JSON.parse(fetchImpl.calls[0].init.body as string)).toEqual({ count: 2 });
  });

  it('switches to cors mode when custom headers are set', async () => {
    const fetchImpl = mockFetch();
    const adapter = webhookAdapter({
      url: 'https://hook.example/in',
      fetchImpl,
      headers: { 'x-secret': 'abc' },
    });
    await adapter.send([event('a')], { beacon: false });
    expect(fetchImpl.calls[0].init.mode).toBe('cors');
    expect((fetchImpl.calls[0].init.headers as Record<string, string>)['x-secret']).toBe('abc');
  });

  it('reports its origin as a connect domain', () => {
    expect(webhookAdapter({ url: 'https://hook.example/in' }).connectDomains).toEqual([
      'https://hook.example',
    ]);
  });

  it('uses sendBeacon on the teardown path', async () => {
    const beacon = installSendBeaconMock();
    const adapter = webhookAdapter({ url: 'https://hook.example/in' });
    await adapter.send([event('a')], { beacon: true });
    expect(beacon.calls).toHaveLength(1);
    expect(beacon.calls[0].url).toBe('https://hook.example/in');
    beacon.restore();
  });
});
