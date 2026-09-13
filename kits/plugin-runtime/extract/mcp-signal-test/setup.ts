import { webcrypto } from 'node:crypto';

// jsdom does not always expose Web Crypto; ensure uuid() has a source of randomness.
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
