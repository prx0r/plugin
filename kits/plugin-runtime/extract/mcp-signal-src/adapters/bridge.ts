import { BRIDGE_DEFAULT_TOOL, SDK_NAME, SDK_VERSION } from '../constants';
import { detectBridge, type CallTool } from '../host-bridge';
import type { Adapter, SignalEvent } from '../types';

export interface BridgeAdapterConfig {
  /** The app-only MCP tool to call. Default `"record_signal"`. */
  toolName?: string;
  /**
   * How to invoke the tool. Defaults to auto-detection (`window.openai.callTool`, else a
   * `tools/call` postMessage to the parent frame). Provide your own for certainty — e.g.
   * if you already hold an `@modelcontextprotocol/ext-apps` App instance, pass its call
   * method here.
   */
  callTool?: CallTool;
}

/**
 * The recommended transport. Instead of making a (CSP-blocked) network call, it hands
 * each batch to an app-only MCP tool on your own server via the host bridge; your server
 * then forwards to the real destination. This bypasses `connect-src` entirely and keeps
 * your analytics key server-side. Pair it with `createSignalReceiver` +
 * `signalToolDefinition` from `mcp-signal/server`.
 */
export function bridgeAdapter(config: BridgeAdapterConfig = {}): Adapter {
  const toolName = config.toolName ?? BRIDGE_DEFAULT_TOOL;
  let resolved: CallTool | undefined;
  let attempted = false;

  function getCallTool(): CallTool | undefined {
    if (config.callTool) return config.callTool;
    if (!attempted) {
      resolved = detectBridge();
      attempted = true;
    }
    return resolved;
  }

  return {
    name: 'bridge',
    connectDomains: [],
    send(events: SignalEvent[], { beacon }) {
      const call = getCallTool();
      if (!call) {
        if (beacon) return; // silent on teardown
        return Promise.reject(
          Object.assign(
            new Error(
              'bridgeAdapter: no MCP host bridge detected (window.openai.callTool or a parent ' +
                'frame). Provide { callTool } or use a direct adapter.',
            ),
            { retryable: false },
          ),
        );
      }
      const args = {
        events,
        sdk: { name: SDK_NAME, version: SDK_VERSION },
        sentAt: new Date().toISOString(),
      };
      if (beacon) {
        // Best-effort on teardown: fire and don't await.
        try {
          void call(toolName, args);
        } catch {
          /* ignore */
        }
        return;
      }
      return call(toolName, args).then(() => undefined);
    },
  };
}
