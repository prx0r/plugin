// Injected at build time by tsup `define` (and by vitest `define` under test).
// Guarded reads fall back to a dev string when it is not replaced.
declare const __SDK_VERSION__: string;
