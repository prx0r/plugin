import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiagnostics } from '../src/diagnostics';

function violation(directive: string, blockedURI: string) {
  const event = new Event('securitypolicyviolation') as Event & {
    violatedDirective?: string;
    blockedURI?: string;
  };
  event.violatedDirective = directive;
  event.blockedURI = blockedURI;
  window.dispatchEvent(event);
}

let warn: ReturnType<typeof vi.spyOn> | undefined;
let uninstall: (() => void) | undefined;

afterEach(() => {
  uninstall?.();
  uninstall = undefined;
  warn?.mockRestore();
  warn = undefined;
});

describe('diagnostics CSP watch', () => {
  it('warns with an actionable message when a matching connect-src violation fires (debug on)', () => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    uninstall = createDiagnostics(true).installCspWatch(['https://us.i.posthog.com']);
    violation('connect-src', 'https://us.i.posthog.com/batch/');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/connectDomains|bridge transport/);
  });

  it('ignores unrelated violations', () => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    uninstall = createDiagnostics(true).installCspWatch(['https://us.i.posthog.com']);
    violation('img-src', 'https://cdn.example.com/x.png');
    violation('connect-src', 'https://unrelated.example.com/x');
    expect(warn).not.toHaveBeenCalled();
  });

  it('is a no-op when debug is off', () => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    uninstall = createDiagnostics(false).installCspWatch(['https://us.i.posthog.com']);
    violation('connect-src', 'https://us.i.posthog.com/batch/');
    expect(warn).not.toHaveBeenCalled();
  });
});
