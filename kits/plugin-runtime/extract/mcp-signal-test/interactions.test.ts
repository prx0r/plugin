import { afterEach, describe, expect, it } from 'vitest';
import { createSignal } from '../src/client';
import { installInteractionCapture } from '../src/interactions';
import { fakeAdapter } from './helpers';

let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
  document.body.innerHTML = '';
});

function click(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('installInteractionCapture', () => {
  it('captures clicks on [data-mcp-signal] elements', () => {
    const events: Array<{ event: string; props?: Record<string, unknown> }> = [];
    uninstall = installInteractionCapture((event, props) => events.push({ event, props }), {});
    const btn = document.createElement('button');
    btn.setAttribute('data-mcp-signal', 'buy');
    btn.id = 'buy-btn';
    document.body.appendChild(btn);

    click(btn);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('mcp_signal_interaction');
    expect(events[0].props).toEqual({ action: 'buy', tag: 'button', id: 'buy-btn' });
  });

  it('resolves the marked ancestor for a nested click target', () => {
    const events: Array<{ props?: Record<string, unknown> }> = [];
    uninstall = installInteractionCapture((_e, props) => events.push({ props }), {});
    const btn = document.createElement('button');
    btn.setAttribute('data-mcp-signal', 'open');
    const span = document.createElement('span');
    btn.appendChild(span);
    document.body.appendChild(btn);

    click(span);

    expect(events[0].props?.action).toBe('open');
  });

  it('ignores unmarked clicks unless captureAllClicks is set', () => {
    const events: unknown[] = [];
    uninstall = installInteractionCapture((event) => events.push(event), {});
    const div = document.createElement('div');
    document.body.appendChild(div);
    click(div);
    expect(events).toHaveLength(0);
  });

  it('captures all clicks (tag/id only) when captureAllClicks is set', () => {
    const events: Array<{ props?: Record<string, unknown> }> = [];
    uninstall = installInteractionCapture((_e, props) => events.push({ props }), {
      captureAllClicks: true,
    });
    const div = document.createElement('div');
    document.body.appendChild(div);
    click(div);
    expect(events[0].props).toEqual({ tag: 'div', id: undefined });
  });

  it('is off by default at the client level', async () => {
    const adapter = fakeAdapter();
    const t = createSignal({
      adapters: [adapter],
      autoCaptureLifecycle: false,
      autoCaptureErrors: false,
      flushIntervalMs: 0,
    });
    const btn = document.createElement('button');
    btn.setAttribute('data-mcp-signal', 'buy');
    document.body.appendChild(btn);
    click(btn);
    await t.flush();
    expect(adapter.sent.some((e) => e.event === 'mcp_signal_interaction')).toBe(false);
  });
});
