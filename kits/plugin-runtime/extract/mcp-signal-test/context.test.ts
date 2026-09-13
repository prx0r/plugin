import { afterEach, describe, expect, it } from 'vitest';
import { detectHost, installContextRefresh, resolveContext } from '../src/context';
import { setOpenAi } from './helpers';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('context', () => {
  it('detects the chatgpt host when window.openai is present', () => {
    cleanup = setOpenAi({});
    expect(detectHost()).toBe('chatgpt');
  });

  it('detects a plain browser at the top level', () => {
    expect(detectHost()).toBe('browser');
  });

  it('respects a forced host', () => {
    expect(detectHost('mcp-apps')).toBe('mcp-apps');
  });

  it('resolves session id with the right precedence (config > openai > minted)', () => {
    expect(resolveContext({ sessionId: 'fixed' }).sessionId).toBe('fixed');

    cleanup = setOpenAi({ toolResponseMetadata: { _meta: { 'openai/widgetSessionId': 'abc' } } });
    expect(resolveContext({}).sessionId).toBe('abc');
  });

  it('mints a session id when none is available', () => {
    const a = resolveContext({}).sessionId;
    const b = resolveContext({}).sessionId;
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('reads theme and locale from window.openai when present', () => {
    cleanup = setOpenAi({ theme: 'dark', locale: 'fr-FR' });
    const ctx = resolveContext({});
    expect(ctx.theme).toBe('dark');
    expect(ctx.locale).toBe('fr-FR');
  });

  it('always includes SDK identity and a timezone', () => {
    const ctx = resolveContext({});
    expect(ctx.sdk.name).toBe('mcp-signal');
    expect(ctx.sdk.version).toBeTruthy();
    expect(typeof ctx.timeZone).toBe('string');
  });

  it('merges developer-supplied static context', () => {
    const ctx = resolveContext({ context: { tenant: 'acme' } });
    expect(ctx.tenant).toBe('acme');
  });

  it('refreshes theme on openai:set_globals', () => {
    cleanup = setOpenAi({ theme: 'light' });
    const ctx = resolveContext({});
    expect(ctx.theme).toBe('light');
    const uninstall = installContextRefresh(ctx);
    (window as unknown as { openai: { theme: string } }).openai.theme = 'dark';
    window.dispatchEvent(new Event('openai:set_globals'));
    expect(ctx.theme).toBe('dark');
    uninstall();
  });
});
