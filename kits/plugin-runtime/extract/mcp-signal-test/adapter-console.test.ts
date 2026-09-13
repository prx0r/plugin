import { describe, expect, it, vi } from 'vitest';
import { consoleAdapter } from '../src/adapters/console';
import type { SignalEvent } from '../src/types';

function event(name: string, props: Record<string, unknown> = {}): SignalEvent {
  return {
    event: name,
    properties: props,
    timestamp: '2026-07-15T00:00:00.000Z',
    messageId: 'id-1',
    context: {
      sessionId: 's',
      host: 'browser',
      sdk: { name: 'mcp-signal', version: '0' },
    },
  };
}

describe('consoleAdapter', () => {
  it('pretty-prints with group + table', () => {
    const logger = {
      log: vi.fn(),
      group: vi.fn(),
      groupEnd: vi.fn(),
      table: vi.fn(),
      warn: vi.fn(),
    };
    const adapter = consoleAdapter({ logger });
    adapter.send([event('a', { x: 1 })], { beacon: false });
    expect(logger.group).toHaveBeenCalledTimes(1);
    expect(logger.table).toHaveBeenCalledTimes(1);
    expect(logger.table.mock.calls[0][0]).toEqual([{ event: 'a', x: 1 }]);
  });

  it('falls back to log when table is unavailable', () => {
    const logger = { log: vi.fn() };
    const adapter = consoleAdapter({ logger });
    adapter.send([event('a')], { beacon: false });
    expect(logger.log).toHaveBeenCalled();
  });

  it('logs a ready line on init and reports no connect domains', () => {
    const logger = { log: vi.fn() };
    const adapter = consoleAdapter({ logger });
    adapter.init?.({
      sessionId: 's',
      host: 'browser',
      sdk: { name: 'mcp-signal', version: '0' },
    });
    expect(logger.log).toHaveBeenCalled();
    expect(adapter.connectDomains).toEqual([]);
  });
});
