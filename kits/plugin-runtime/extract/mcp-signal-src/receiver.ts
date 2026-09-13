import type { Adapter, SignalEvent } from './types';

export interface SignalReceiverConfig {
  /** Destination adapters run server-side (PostHog, webhook, console, custom). */
  adapters: Adapter[];
  /** Redact or drop each event server-side. Return `null` to drop. */
  beforeSend?: (event: SignalEvent) => SignalEvent | null;
}

export interface IngestResult {
  accepted: number;
}

export interface SignalReceiver {
  /** Ingest a bridge payload (`{ events: [...] }`) or a raw event array. */
  ingest(payload: unknown): Promise<IngestResult>;
  /**
   * Convenience wrapper for an MCP `tools/call` handler: ingests `args` and returns a
   * valid MCP tool result.
   */
  handleToolCall(
    args: unknown,
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; structuredContent: IngestResult }>;
}

function extractEvents(payload: unknown): SignalEvent[] {
  if (Array.isArray(payload)) return payload as SignalEvent[];
  if (payload && typeof payload === 'object') {
    const events = (payload as { events?: unknown }).events;
    if (Array.isArray(events)) return events as SignalEvent[];
  }
  return [];
}

/**
 * Server-side counterpart to the bridge transport. Receives batches forwarded from the
 * widget (via your app-only MCP tool) and fans them out to the same destination adapters
 * — the one adapter contract, reused where there is no CSP/CORS constraint. Adapter
 * errors are isolated so one failing destination never fails the whole ingest.
 */
export function createSignalReceiver(config: SignalReceiverConfig): SignalReceiver {
  if (!config.adapters || config.adapters.length === 0) {
    throw new Error('createSignalReceiver: at least one adapter is required');
  }

  async function ingest(payload: unknown): Promise<IngestResult> {
    let events = extractEvents(payload);
    if (config.beforeSend) {
      const beforeSend = config.beforeSend;
      events = events
        .map((event) => beforeSend(event))
        .filter((event): event is SignalEvent => event !== null && event !== undefined);
    }
    if (events.length === 0) return { accepted: 0 };
    await Promise.allSettled(
      config.adapters.map((adapter) =>
        Promise.resolve(adapter.send(events, { beacon: false })).catch(() => undefined),
      ),
    );
    return { accepted: events.length };
  }

  return {
    ingest,
    async handleToolCall(args: unknown) {
      const result = await ingest(args);
      return {
        content: [{ type: 'text' as const, text: `ok: accepted ${result.accepted} event(s)` }],
        structuredContent: result,
      };
    },
  };
}
