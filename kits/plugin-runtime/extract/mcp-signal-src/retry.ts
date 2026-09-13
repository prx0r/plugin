import { RETRY_DEFAULTS } from './constants';
import type { RetryConfig } from './types';

/** An error can opt out of retries by carrying `retryable: false`. */
export interface RetryableError {
  retryable?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn`, retrying on rejection with exponential backoff + full jitter. Stops early
 * if the thrown error is explicitly `retryable: false` (e.g. a permanent misconfig).
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  config?: RetryConfig,
): Promise<T> {
  const cfg = { ...RETRY_DEFAULTS, ...config };
  let attempt = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (err && (err as RetryableError).retryable === false) throw err;
      if (attempt >= cfg.maxRetries) throw err;
      const base = Math.min(cfg.maxDelayMs, cfg.baseDelayMs * Math.pow(cfg.factor, attempt));
      const delay = cfg.jitter ? base * (0.5 + Math.random()) : base;
      await sleep(delay);
      attempt += 1;
    }
  }
}
