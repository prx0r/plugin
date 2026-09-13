import { describe, expect, it } from 'vitest';
import { posthogAdapter } from '../src/adapters/posthog';
import { mockFetch } from './helpers';
import type { SignalEvent } from '../src/types';

function event(name: string, props: Record<string, unknown> = {}): SignalEvent {
  return {
    event: name,
    properties: props,
    timestamp: '2026-07-15T00:00:00.000Z',
    messageId: 'msg-42',
    context: {
      sessionId: 'sess-1',
      host: 'chatgpt',
      widgetName: 'weather',
      widgetVersion: '1.2.0',
      theme: 'dark',
      sdk: { name: 'mcp-signal', version: '0' },
    },
  };
}

describe('posthogAdapter', () => {
  it('posts a correctly shaped batch to /batch/ as text/plain', async () => {
    const fetchImpl = mockFetch();
    const adapter = posthogAdapter({ apiKey: 'phc_test', host: 'eu', fetchImpl });
    await adapter.send([event('forecast_expanded', { day: 'tue' })], { beacon: false });

    const { url, init } = fetchImpl.calls[0];
    expect(url).toBe('https://eu.i.posthog.com/batch/');
    expect(init.mode).toBe('no-cors');
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/text\/plain/);
    expect(init.headers && 'Authorization' in (init.headers as object)).toBe(false);

    const body = JSON.parse(init.body as string);
    expect(body.api_key).toBe('phc_test');
    expect(body.historical_migration).toBe(false);
    const e = body.batch[0];
    expect(e.event).toBe('forecast_expanded');
    expect(e.uuid).toBe('msg-42');
    expect(e.timestamp).toBe('2026-07-15T00:00:00.000Z');
    expect(e.properties.distinct_id).toBe('sess-1'); // defaults to sessionId
    expect(e.properties.$session_id).toBe('sess-1');
    expect(e.properties.$lib).toBe('mcp-signal');
    expect(e.properties.widget_name).toBe('weather');
    expect(e.properties.day).toBe('tue'); // event property preserved
  });

  it('targets US by default and self-hosted when given a URL', () => {
    expect(posthogAdapter({ apiKey: 'phc' }).connectDomains).toEqual(['https://us.i.posthog.com']);
    expect(
      posthogAdapter({ apiKey: 'phc', host: 'https://ph.example.com/' }).connectDomains,
    ).toEqual(['https://ph.example.com']);
  });

  it('lets developer event properties override context-derived ones', async () => {
    const fetchImpl = mockFetch();
    const adapter = posthogAdapter({
      apiKey: 'phc',
      fetchImpl,
      defaultProperties: { plan: 'free' },
    });
    await adapter.send([event('a', { plan: 'enterprise' })], { beacon: false });
    const body = JSON.parse(fetchImpl.calls[0].init.body as string);
    expect(body.batch[0].properties.plan).toBe('enterprise');
  });

  it('supports a custom distinctId resolver', async () => {
    const fetchImpl = mockFetch();
    const adapter = posthogAdapter({
      apiKey: 'phc',
      fetchImpl,
      distinctId: (ctx) => `u:${ctx.host}`,
    });
    await adapter.send([event('a')], { beacon: false });
    const body = JSON.parse(fetchImpl.calls[0].init.body as string);
    expect(body.batch[0].properties.distinct_id).toBe('u:chatgpt');
  });

  it('throws without an apiKey', () => {
    expect(() => posthogAdapter({ apiKey: '' })).toThrow(/apiKey/);
  });
});
