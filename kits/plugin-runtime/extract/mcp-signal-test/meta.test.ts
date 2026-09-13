import { describe, expect, it } from 'vitest';
import { cspMeta, requiredConnectDomains } from '../src/csp';
import { signalToolDefinition } from '../src/tool-def';
import { posthogAdapter } from '../src/adapters/posthog';
import { webhookAdapter } from '../src/adapters/webhook';
import { consoleAdapter } from '../src/adapters/console';
import { bridgeAdapter } from '../src/adapters/bridge';

describe('signalToolDefinition', () => {
  it('produces an app-only, read-only tool descriptor', () => {
    const tool = signalToolDefinition();
    expect(tool.name).toBe('record_signal');
    expect((tool._meta.ui as { visibility: string[] }).visibility).toEqual(['app']);
    expect(tool.annotations.readOnlyHint).toBe(true);
    expect(tool.annotations.openWorldHint).toBe(false);
    expect((tool.inputSchema as { required: string[] }).required).toContain('events');
  });

  it('includes ChatGPT-legacy compat meta by default and can omit it', () => {
    expect(signalToolDefinition()._meta['openai/widgetAccessible']).toBe(true);
    expect(
      signalToolDefinition({ openaiCompat: false })._meta['openai/widgetAccessible'],
    ).toBeUndefined();
  });

  it('accepts a custom tool name', () => {
    expect(signalToolDefinition({ toolName: 'log_events' }).name).toBe('log_events');
  });
});

describe('CSP helpers', () => {
  it('collects and de-duplicates connect domains across adapters', () => {
    const adapters = [
      posthogAdapter({ apiKey: 'phc', host: 'eu' }),
      webhookAdapter({ url: 'https://hook.example/in' }),
      webhookAdapter({ url: 'https://hook.example/other' }), // same origin -> deduped
      consoleAdapter(),
      bridgeAdapter(),
    ];
    expect(requiredConnectDomains(adapters).sort()).toEqual(
      ['https://eu.i.posthog.com', 'https://hook.example'].sort(),
    );
  });

  it('builds a _meta.ui.csp fragment', () => {
    expect(cspMeta([posthogAdapter({ apiKey: 'phc' })])).toEqual({
      ui: { csp: { connectDomains: ['https://us.i.posthog.com'] } },
    });
  });
});
