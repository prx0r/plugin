import {
  McpServer,
  StreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk";
import type { DomainCapability } from "../index.js";

export interface DomainMcpOptions {
  capability: DomainCapability;
}

export interface DomainMcpResult {
  connect(): Promise<void>;
  close(): Promise<void>;
}

export function registerDomainsMcpServer(opts: DomainMcpOptions): DomainMcpResult {
  const server = new McpServer({
    name: "domains-check-server",
    version: "0.1.0",
  });

  server.tool("domains.check", "Check whether one or more domains are available to register and discover available name suggestions.", async (args: unknown) => {
    const payload = args as { domain?: string; domains?: string[]; keywords?: string; maxResults?: number };
    const result = await opts.capability.invoke(payload);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  const transport = new StreamableHTTPServerTransport({ url: new URL("http://localhost:2092/mcp") });
  return {
    async connect() {
      await server.connect(transport);
    },
    async close() {
      await server.close();
    },
  };
}
