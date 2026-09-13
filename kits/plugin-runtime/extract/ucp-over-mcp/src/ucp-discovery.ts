import type { UcpDiscoveryProfile } from "@ucp-js/sdk";

export const ucpDiscoveryProfile = {
  ucp: {
    version: "2026-04-08",
    services: {
      "dev.ucp.shopping": [
        {
          version: "2026-01-23",
          spec: "https://ucp.dev/specification/overview/",
          transport: "mcp",
          endpoint: "https://sofontsy.myshopify.com/api/ucp/mcp",
          schema: "https://ucp.dev/services/shopping/openrpc.json",
        },
        {
          version: "2026-01-23",
          spec: "https://ucp.dev/specification/overview/",
          transport: "embedded",
          schema: "https://ucp.dev/services/shopping/embedded.openrpc.json",
        },
      ],
    },
    capabilities: {},
  },
};
