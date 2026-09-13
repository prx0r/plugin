import { afterEach, describe, expect, it, vi } from 'vitest';
import { withRetry } from '../src/retry';

afterEach(() => {
  vi.useRealTimers();
});

describe('withRetry', () => {
  it('retries on rejection and eventually succeeds', async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValueOnce('ok');
    const promise = withRetry(fn, { jitter: false, baseDelayMs: 10, maxRetries: 3 });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('gives up after maxRetries', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValue(new Error('always'));
    const promise = withRetry(fn, { jitter: false, baseDelayMs: 1, maxRetries: 2 });
    const assertion = expect(promise).rejects.toThrow('always');
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry an error marked retryable: false', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('permanent'), { retryable: false }));
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
