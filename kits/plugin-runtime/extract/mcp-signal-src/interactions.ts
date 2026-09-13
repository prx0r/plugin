import { DEFAULT_INTERACTION_ATTR, EVENTS } from './constants';
import type { InteractionCaptureConfig } from './types';

type Emit = (event: string, properties?: Record<string, unknown>) => void;

/**
 * Opt-in click capture. A single delegated listener (capture + passive, so it never
 * interferes with the app's own handlers) emits an interaction event for clicks on
 * elements carrying the marker attribute (default `data-mcp-signal`). It records the
 * attribute value, tag, and id only — never element text or input values — to stay
 * PII-safe by default. Returns an uninstall function.
 */
export function installInteractionCapture(
  emit: Emit,
  config: InteractionCaptureConfig,
): () => void {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
    return () => {};
  }
  const attribute = config.attribute ?? DEFAULT_INTERACTION_ATTR;
  const eventName = config.eventName ?? EVENTS.INTERACTION;

  const onClick = (event: Event) => {
    const target = event.target as Element | null;
    const marked =
      target && typeof target.closest === 'function' ? target.closest(`[${attribute}]`) : null;

    if (marked) {
      emit(eventName, {
        action: marked.getAttribute(attribute) || undefined,
        tag: marked.tagName.toLowerCase(),
        id: marked.id || undefined,
      });
    } else if (config.captureAllClicks && target && target.tagName) {
      emit(eventName, {
        tag: target.tagName.toLowerCase(),
        id: (target as HTMLElement).id || undefined,
      });
    }
  };

  const options: AddEventListenerOptions = { capture: true, passive: true };
  document.addEventListener('click', onClick, options);
  return () => document.removeEventListener('click', onClick, options);
}
