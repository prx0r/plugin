/**
 * mcp-signal/server — Node entry.
 *
 * Use this on your MCP server to receive telemetry forwarded by the bridge transport and
 * fan it out to destination adapters (the same adapters that run client-side). Keep this
 * out of your widget bundle — it never touches `window`.
 */
export { createSignalReceiver } from './receiver';
export type { IngestResult, SignalReceiver, SignalReceiverConfig } from './receiver';

export { signalToolDefinition } from './tool-def';
export type { SignalToolDefinition, SignalToolDefinitionOptions } from './tool-def';

// The destination adapters are isomorphic — reuse them server-side.
export { consoleAdapter } from './adapters/console';
export { webhookAdapter } from './adapters/webhook';
export { posthogAdapter } from './adapters/posthog';

export { cspMeta, requiredConnectDomains } from './csp';

export type { Adapter, SendOptions, SignalContext, SignalEvent } from './types';
export type { ConsoleAdapterConfig } from './adapters/console';
export type { WebhookAdapterConfig } from './adapters/webhook';
export type { PostHogAdapterConfig } from './adapters/posthog';
