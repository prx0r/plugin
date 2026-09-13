import { EVENTS, LIMITS } from './constants';

type Emit = (event: string, properties?: Record<string, unknown>) => void;

function truncate(stack?: string): string | undefined {
  return stack ? stack.slice(0, LIMITS.stackMaxChars) : undefined;
}

/**
 * Capture uncaught errors and unhandled promise rejections as `mcp_signal_error`
 * events. Filters out resource-load errors (missing images/scripts), truncates stacks,
 * and guards against re-entrancy so a fault in the handler cannot loop. Never calls
 * `preventDefault`, so the host still sees the error. Returns an uninstall function.
 */
export function installErrorCapture(emit: Emit): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  let handling = false;

  const onError = (event: ErrorEvent) => {
    if (handling) return;
    // Resource-load failures surface as an error event with no message and no error object.
    if (!event.message && !event.error) return;
    handling = true;
    try {
      emit(EVENTS.ERROR, {
        kind: 'error',
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: truncate(event.error?.stack),
      });
    } finally {
      handling = false;
    }
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    if (handling) return;
    handling = true;
    try {
      const reason = event.reason as { message?: string; stack?: string } | undefined;
      emit(EVENTS.ERROR, {
        kind: 'unhandledrejection',
        message: String(reason?.message ?? reason),
        stack: truncate(reason?.stack),
      });
    } finally {
      handling = false;
    }
  };

  window.addEventListener('error', onError as EventListener);
  window.addEventListener('unhandledrejection', onRejection as EventListener);

  return () => {
    window.removeEventListener('error', onError as EventListener);
    window.removeEventListener('unhandledrejection', onRejection as EventListener);
  };
}
