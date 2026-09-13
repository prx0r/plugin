import { afterEach, describe, expect, it } from 'vitest';
import { detectBridge } from '../src/host-bridge';
import { setOpenAi } from './helpers';

let restoreParent: (() => void) | undefined;
let cleanupOpenAi: (() => void) | undefined;

function useFakeParent(): Array<{ id: string; method: string; params: unknown }> {
  const posted: Array<{ id: string; method: string; params: unknown }> = [];
  const fakeParent = { postMessage: (msg: unknown) => posted.push(msg as never) };
  Object.defineProperty(window, 'parent', { configurable: true, get: () => fakeParent });
  restoreParent = () =>
    Object.defineProperty(window, 'parent', { configurable: true, get: () => window });
  return posted;
}

afterEach(() => {
  restoreParent?.();
  restoreParent = undefined;
  cleanupOpenAi?.();
  cleanupOpenAi = undefined;
});

describe('detectBridge (postMessage transport)', () => {
  it('prefers window.openai.callTool when present', () => {
    cleanupOpenAi = setOpenAi({ callTool: async () => undefined });
    expect(typeof detectBridge()).toBe('function');
  });

  it('posts a JSON-RPC tools/call to the parent and resolves on the correlated response', async () => {
    cleanupOpenAi = setOpenAi(undefined);
    const posted = useFakeParent();
    const call = detectBridge();
    expect(call).toBeTypeOf('function');

    const promise = call!('record_signal', { events: [] });
    expect(posted).toHaveLength(1);
    expect(posted[0].method).toBe('tools/call');
    expect(posted[0].params).toEqual({ name: 'record_signal', arguments: { events: [] } });

    window.dispatchEvent(new MessageEvent('message', { data: { id: posted[0].id, result: 'ok' } }));
    await expect(promise).resolves.toBe('ok');
  });

  it('rejects on a JSON-RPC error response', async () => {
    cleanupOpenAi = setOpenAi(undefined);
    const posted = useFakeParent();
    const call = detectBridge();
    const promise = call!('record_signal', {});
    window.dispatchEvent(
      new MessageEvent('message', { data: { id: posted[0].id, error: { message: 'denied' } } }),
    );
    await expect(promise).rejects.toThrow('denied');
  });

  it('returns undefined when there is no host and no parent frame', () => {
    cleanupOpenAi = setOpenAi(undefined);
    expect(detectBridge()).toBeUndefined();
  });
});
