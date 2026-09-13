/**
 * Debug-only diagnostics. Everything here is silent unless `debug: true`, so the SDK
 * never spams an end user's console in production. Turn `debug` on during setup.
 */
export interface Diagnostics {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  /**
   * Watch for CSP `connect-src` violations to the given destination origins and print
   * an actionable message telling the developer how to fix it. No-op unless debugging.
   * Returns an uninstall function.
   */
  installCspWatch(domains: string[]): () => void;
}

const PREFIX = '[mcp-signal]';

export function createDiagnostics(debug: boolean): Diagnostics {
  const c = typeof console !== 'undefined' ? console : undefined;
  return {
    log(...args) {
      if (debug) c?.log?.(PREFIX, ...args);
    },
    warn(...args) {
      if (debug) c?.warn?.(PREFIX, ...args);
    },
    installCspWatch(domains) {
      if (
        !debug ||
        typeof window === 'undefined' ||
        typeof window.addEventListener !== 'function' ||
        domains.length === 0
      ) {
        return () => {};
      }
      const origins = domains.map((d) => {
        try {
          return new URL(d).origin;
        } catch {
          return d;
        }
      });
      const handler = (event: Event) => {
        const e = event as SecurityPolicyViolationEvent;
        if (e.violatedDirective && !e.violatedDirective.includes('connect-src')) return;
        const blocked = e.blockedURI || '';
        const relevant = origins.some((o) => blocked.startsWith(o));
        if (!relevant) return;
        c?.warn?.(
          `${PREFIX} a request to "${blocked}" was blocked by the host Content-Security-Policy ` +
            `(connect-src). Add it to your widget resource's _meta.ui.csp.connectDomains ` +
            `(or ChatGPT openai/widgetCSP.connect_domains), or switch to the bridge transport ` +
            `(bridgeAdapter + a server-side receiver). See docs/limitations.md.`,
        );
      };
      window.addEventListener('securitypolicyviolation', handler);
      return () => window.removeEventListener('securitypolicyviolation', handler);
    },
  };
}
