import { uuid } from './ids';

/** A function that invokes an MCP tool on the host/server from inside the widget. */
export type CallTool = (name: string, args: Record<string, unknown>) => Promise<unknown>;

interface OpenAiCallHost {
  callTool?: CallTool;
}

function getOpenAi(): OpenAiCallHost | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { openai?: OpenAiCallHost }).openai;
}

/**
 * Resolve a way to call an MCP tool from the widget, or `undefined` if none is
 * available. Tries, in order:
 *   1. ChatGPT Apps SDK: `window.openai.callTool`.
 *   2. MCP Apps / mcp-ui: a JSON-RPC `tools/call` posted to the parent frame.
 *
 * When neither is present (e.g. a plain browser tab), returns `undefined` so the
 * caller can fail loudly or fall back to a direct-HTTP adapter.
 */
export function detectBridge(): CallTool | undefined {
  const oa = getOpenAi();
  if (oa && typeof oa.callTool === 'function') {
    return (name, args) => oa.callTool!(name, args);
  }
  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
    return postMessageCallTool;
  }
  return undefined;
}

/**
 * Minimal JSON-RPC 2.0 `tools/call` over postMessage for MCP Apps hosts. Correlates
 * the response by request id. `targetOrigin` is `"*"` because a sandboxed widget does
 * not know its host's origin; the host is responsible for validating messages.
 */
function postMessageCallTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = uuid();
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('mcp-signal: bridge tools/call timed out'));
    }, 10_000);

    function onMessage(event: MessageEvent) {
      const data = event.data as { id?: unknown; result?: unknown; error?: { message?: string } };
      if (!data || typeof data !== 'object' || data.id !== id) return;
      cleanup();
      if (data.error) reject(new Error(String(data.error.message ?? 'bridge error')));
      else resolve(data.result);
    }

    function cleanup() {
      clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    }

    window.addEventListener('message', onMessage);
    const message = { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } };
    try {
      window.parent.postMessage(message, '*');
    } catch (err) {
      cleanup();
      reject(err as Error);
    }
  });
}
