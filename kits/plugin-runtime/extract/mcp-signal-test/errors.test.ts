import { afterEach, describe, expect, it } from 'vitest';
import { installErrorCapture } from '../src/errors';

let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
});

describe('installErrorCapture', () => {
  it('captures uncaught errors as mcp_signal_error', () => {
    const events: Array<{ event: string; props?: Record<string, unknown> }> = [];
    uninstall = installErrorCapture((event, props) => events.push({ event, props }));

    window.dispatchEvent(
      new ErrorEvent('error', { message: 'boom', error: new Error('boom'), filename: 'a.js' }),
    );

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('mcp_signal_error');
    expect(events[0].props?.kind).toBe('error');
    expect(events[0].props?.message).toBe('boom');
    expect(events[0].props?.source).toBe('a.js');
  });

  it('ignores resource-load errors (no message and no error object)', () => {
    const events: unknown[] = [];
    uninstall = installErrorCapture((event) => events.push(event));
    window.dispatchEvent(new ErrorEvent('error', { message: '' }));
    expect(events).toHaveLength(0);
  });

  it('captures unhandled promise rejections', () => {
    const events: Array<{ event: string; props?: Record<string, unknown> }> = [];
    uninstall = installErrorCapture((event, props) => events.push({ event, props }));

    const rejection = new Event('unhandledrejection') as Event & { reason?: unknown };
    rejection.reason = new Error('nope');
    window.dispatchEvent(rejection);

    expect(events).toHaveLength(1);
    expect(events[0].props?.kind).toBe('unhandledrejection');
    expect(events[0].props?.message).toBe('nope');
  });
});
