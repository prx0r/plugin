// Remote MCP server for ChatGPT plugin workflow (domains.check only).
// Local dev: `npm run remote-plugin` or `npm run remote-plugin -- --port 2092`
// Public deploy: stable HTTPS endpoint at /mcp
// ChatGPT test: tunnel localhost → ngrok/cloudflared → Developer Mode.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createDomainCapability } from "../../../capabilities/domains/index.ts";

const PORT = Number(process.env.PORT ?? 2092);
const capability = createDomainCapability();
const meta = capability.tool().meta;

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 1024 * 1024) {
        req.destroy();
        reject(new Error("Request body too large"));
      } else {
        chunks.push(c);
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null") as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function healthJson(req: IncomingMessage) {
  return {
    ok: true,
    server: "agentcom-domains-plugin",
    port: PORT,
    host: req.headers.host ?? "localhost",
    tool: meta.name,
  };
}

function readCapabilitiesJson(req: IncomingMessage) {
  const host = req.headers.host ?? "localhost";
  const manifest = JSON.parse(readFileSync("apps/web/public/.well-known/agentcom/capabilities.json", "utf8"));
  return {
    ...manifest,
    mcp: {
      ...manifest.mcp,
      endpoint: `http://${host}/mcp`,
    },
  };
}

function readLlmsTxt() {
  return readFileSync("apps/web/public/llms.txt", "utf8");
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "OPTIONS" && url.pathname === "/mcp") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, mcp-session-id",
        "Access-Control-Expose-Headers": "Mcp-Session-Id",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(healthJson(req), null, 2));
      return;
    }

    if (req.method === "GET" && url.pathname === "/.well-known/agentcom/capabilities.json") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(readCapabilitiesJson(req), null, 2));
      return;
    }

    if (req.method === "GET" && url.pathname === "/llms.txt") {
      res.writeHead(200, { "Content-Type": "text/plain" }).end(readLlmsTxt());
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/domains.check") {
      const payload = await readJsonBody(req);
      const result = capability.tool().invoke(payload);
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result, null, 2));
      return;
    }

    if (url.pathname === "/mcp") {
      const mcp = new McpServer({ name: "agentcom-domains", version: "1.0.0" });

      mcp.tool(
        meta.name,
        meta.description,
        { domain: z.string().optional(), domains: z.array(z.string()).optional(), keywords: z.string().optional(), maxResults: z.number().int().min(1).max(10).optional() },
        async (args: { domain?: string; domains?: string[]; keywords?: string; maxResults?: number }) => {
          const result = capability.tool().invoke(args);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        },
      );

      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

      res.on("close", () => transport.close());
      await mcp.connect(transport);
      await transport.handleRequest(req, res, undefined);
      return;
    }

    res.writeHead(404).end("Not Found");
  } catch (err) {
    console.error("plugin server error", err);
    res.writeHead(500).end("Internal Server Error");
  }
});

server.listen(PORT, () => {
  console.log(`AgentCom Domains Plugin Server listening on http://localhost:${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health: http://localhost:${PORT}/healthz`);
  console.log(`Capability manifest: http://localhost:${PORT}/.well-known/agentcom/capabilities.json`);
  console.log(`llms.txt: http://localhost:${PORT}/llms.txt`);
});
