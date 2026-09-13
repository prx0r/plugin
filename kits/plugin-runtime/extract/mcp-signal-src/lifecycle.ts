import { EVENTS } from './constants';

export interface LifecycleHooks {
  /** Emit an event into the pipeline. */
  emit(event: string): void;
  /** Best-effort teardown flush (beacon). */
  flushBeacon(reason: string): void;
  /** Emit `mcp_signal_closed` at most once. */
  emitClosedOnce(): void;
  /** Called on bfcache restore so a later real close still counts. */
  onRestore(): void;
}

/**
 * Wire widget lifecycle events using only web APIs that behave inside sandboxed
 * iframes. Emits `loaded` immediately, `visible`/`hidden` on visibility changes, and
 * `closed` on `pagehide`. Deliberately never binds `unload`/`beforeunload` — they break
 * the back/forward cache and are unreliable on mobile. Returns an uninstall function.
 */
export function installLifecycle(hooks: LifecycleHooks): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};

  hooks.emit(EVENTS.LOADED);
  if (document.visibilityState === 'visible') hooks.emit(EVENTS.VISIBLE);

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hooks.emit(EVENTS.HIDDEN);
      hooks.flushBeacon('hidden');
    } else if (document.visibilityState === 'visible') {
      hooks.emit(EVENTS.VISIBLE);
    }
  };

  const onPageHide = () => {
    hooks.emitClosedOnce();
    hooks.flushBeacon('pagehide');
  };

  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) hooks.onRestore();
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow as EventListener);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow as EventListener);
  };
}
