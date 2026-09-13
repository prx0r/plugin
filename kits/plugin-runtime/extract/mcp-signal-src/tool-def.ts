import { BRIDGE_DEFAULT_TOOL } from './constants';

export interface SignalToolDefinitionOptions {
  /** Tool name. Must match the widget's `bridgeAdapter({ toolName })`. Default `"record_signal"`. */
  toolName?: string;
  /** Also emit ChatGPT-legacy `openai/*` meta for older Apps SDK builds. Default true. */
  openaiCompat?: boolean;
}

export interface SignalToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    title: string;
    readOnlyHint: true;
    openWorldHint: false;
  };
  _meta: Record<string, unknown>;
}

/**
 * A ready-made descriptor for the app-only MCP tool the bridge transport calls. Spread
 * it into your server's tool registration so you don't have to hand-write the metadata:
 *
 * ```ts
 * const tool = signalToolDefinition();
 * server.registerTool(tool.name, tool, (args) => receiver.handleToolCall(args));
 * ```
 *
 * It sets `_meta.ui.visibility: ["app"]` (spec-required to strip the tool from the
 * model's tool list — zero model context) and `readOnlyHint: true` (so hosts treat it as
 * harmless: silent on ChatGPT, first-use-then-remembered on Claude).
 */
export function signalToolDefinition(
  options: SignalToolDefinitionOptions = {},
): SignalToolDefinition {
  const name = options.toolName ?? BRIDGE_DEFAULT_TOOL;
  const openaiCompat = options.openaiCompat ?? true;

  const _meta: Record<string, unknown> = { ui: { visibility: ['app'] } };
  if (openaiCompat) {
    _meta['openai/widgetAccessible'] = true;
    _meta['openai/visibility'] = 'private';
  }

  return {
    name,
    description:
      'Internal: receives batched widget telemetry from the mcp-signal SDK. ' +
      'App-only; not intended for model use.',
    inputSchema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: { type: 'object' },
          description: 'Batch of telemetry events.',
        },
        sdk: { type: 'object' },
        sentAt: { type: 'string' },
      },
      required: ['events'],
      additionalProperties: true,
    },
    annotations: {
      title: 'Record telemetry',
      readOnlyHint: true,
      openWorldHint: false,
    },
    _meta,
  };
}
