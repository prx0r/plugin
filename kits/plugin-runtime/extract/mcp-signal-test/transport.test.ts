import { describe, expect, it, vi } from 'vitest';
import { postSimple } from '../src/transport';
import { mockFetch } from './helpers';

describe('postSimple', () => {
  it('sends an in-session POST in no-cors mode with a text/plain body', async () => {
    const fetchImpl = mockFetch();
    await postSimple('https://x.example/i', '{"a":1}', { fetchImpl });
    expect(fetchImpl.calls).toHaveLength(1);
    const { init } = fetchImpl.calls[0];
    expect(init.method).toBe('POST');
    expect(init.mode).toBe('no-cors');
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/text\/plain/);
    expect(init.body).toBe('{"a":1}');
  });

  it('rejects when the in-session fetch rejects (so the core can retry)', async () => {
    const fetchImpl = mockFetch(['reject']);
    await expect(postSimple('https://x.example/i', 'body', { fetchImpl })).rejects.toThrow();
  });

  it('resolves on an opaque (no-cors) response regardless of status', async () => {
    const fetchImpl = mockFetch([0]);
    await expect(postSimple('https://x.example/i', 'body', { fetchImpl })).resolves.toBeUndefined();
  });

  it('uses cors mode and treats 5xx as retryable when custom headers are present', async () => {
    const fetchImpl = mockFetch([500]);
    await expect(
      postSimple('https://x.example/i', 'body', { fetchImpl, headers: { 'x-token': 'secret' } }),
    ).rejects.toThrow(/HTTP 500/);
    expect(fetchImpl.calls[0].init.mode).toBe('cors');
    expect((fetchImpl.calls[0].init.headers as Record<string, string>)['x-token']).toBe('secret');
  });

  it('uses sendBeacon with a text/plain blob on the teardown path', async () => {
    const sendBeaconImpl = vi.fn(() => true);
    const fetchImpl = mockFetch();
    await postSimple('https://x.example/i', 'body', { beacon: true, sendBeaconImpl, fetchImpl });
    expect(sendBeaconImpl).toHaveBeenCalledTimes(1);
    const blob = sendBeaconImpl.mock.calls[0][1] as Blob;
    expect(blob.type).toMatch(/text\/plain/);
    expect(fetchImpl.calls).toHaveLength(0); // beacon succeeded, no fallback
  });

  it('falls back to keepalive fetch when sendBeacon returns false', async () => {
    const sendBeaconImpl = vi.fn(() => false);
    const fetchImpl = mockFetch();
    await postSimple('https://x.example/i', 'body', { beacon: true, sendBeaconImpl, fetchImpl });
    expect(fetchImpl.calls).toHaveLength(1);
    expect(fetchImpl.calls[0].init.keepalive).toBe(true);
  });

  it('never rejects on the beacon path', async () => {
    const sendBeaconImpl = vi.fn(() => {
      throw new Error('boom');
    });
    await expect(
      postSimple('https://x.example/i', 'body', {
        beacon: true,
        sendBeaconImpl,
        fetchImpl: mockFetch(),
      }),
    ).resolves.toBeUndefined();
  });
});
