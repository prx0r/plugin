// AgentCom MCP server — plan.md surfaces/mcp.
// Real Apps SDK transport: McpServer + Streamable HTTP at /mcp (stateless).
// ChatGPT-facing tool semantics live here; provider APIs stay private in
// packages/*/providers. Run: npm run mcp (PORT env, default 8787).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createServer, type Server } from "node:http";
import { CANONICAL_CATALOG } from "@print/domain";
import { findAvailable, normalizeDomain, RdapProvider, type FetchImpl } from "@print/domains";
import { batchDomainsRest, checkDomainRest, suggestDomainsRest } from "@print/http";
import { buildJsonLd, buildManifest, LLMS_TXT } from "./discovery.ts";
import {
  findPrintableProducts,
  getPrintOrder,
  placePrintOrder,
  preparePrintDesign,
  quotePersonalizedProduct,
} from "./index.ts";

const domainCheckShape = {
  input: z.string(),
  ascii: z.string().nullable(),
  valid: z.boolean(),
  invalidReason: z.string().optional(),
  available: z.boolean().nullable(),
  source: z.string().optional(),
  checkedAt: z.string().optional(),
};

const PRODUCT_TYPES = [
  "tshirt",
  "hoodie",
  "mug",
  "poster",
  "framed_print",
  "greeting_card",
  "tote_bag",
] as const;

export function createAgentComServer(opts?: { domainsFetch?: FetchImpl }): McpServer {
  const rdap = new RdapProvider(opts?.domainsFetch ? { fetchImpl: opts.domainsFetch } : undefined);

  const server = new McpServer(
    { name: "agentcom", version: "0.2.0" },
    {
      instructions:
        "AgentCom routes real-world market intent to ranked offers. " +
        "Check a domain's availability before suggesting alternatives. " +
        "Quote print jobs before preparing artwork or placing orders. " +
        "Never place an order or booking without explicit user confirmation.",
    },
  );

  // ---- Domains (first publication experiment: read-only, no login) ----
  server.registerTool(
    "check_exact_domain",
    {
      title: "Check domain availability",
      description:
        "Check whether an exact domain name is available to register. Use when the user asks if a specific domain is taken, free, or available.",
      inputSchema: { domain: z.string().min(1).max(253) },
      outputSchema: domainCheckShape,
      annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
    },
    async ({ domain }: { domain: string }) => {
      const norm = normalizeDomain(domain);
      if (!norm.valid || !norm.ascii) {
        const result = { input: domain, ascii: norm.ascii, valid: false, invalidReason: norm.invalidReason, available: null as boolean | null };
        return { structuredContent: result, content: [{ type: "text" as const, text: result.invalidReason ?? "Invalid domain." }] };
      }
      const { checkedAt: _dropped, ...result } = await rdap.check(domain);
      const text =
        result.available === true
          ? `${result.ascii} looks available.`
          : result.available === false
            ? `${result.ascii} is taken.`
            : `Could not confirm availability for ${result.ascii} right now.`;
      return { structuredContent: result, content: [{ type: "text" as const, text }] };
    },
  );

  server.registerTool(
    "batch_check_domains",
    {
      title: "Check domains in bulk",
      description:
        "Check availability for up to 20 exact domain names at once. Use when the user lists several domains to compare.",
      inputSchema: { domains: z.array(z.string().min(1).max(253)).min(1).max(20) },
      outputSchema: { results: z.array(z.object(domainCheckShape)) },
      annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
    },
    async ({ domains }: { domains: string[] }) => {
      const results = (await rdap.batch(domains)).map(({ checkedAt: _dropped, ...r }) => r);
      const free = results.filter((r) => r.available === true).length;
      return {
        structuredContent: { results },
        content: [{ type: "text" as const, text: `${free} of ${results.length} domains look available.` }],
      };
    },
  );

  server.registerTool(
    "find_available_domains",
    {
      title: "Suggest available domains",
      description:
        "Suggest available domain names for a business, brand or idea. Use when the user wants domain ideas rather than checking one exact name.",
      inputSchema: { keywords: z.string().min(1).max(80), maxResults: z.number().int().min(1).max(10).optional() },
      outputSchema: { results: z.array(z.object(domainCheckShape)) },
      annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
    },
    async ({ keywords, maxResults }: { keywords: string; maxResults?: number }) => {
      const results = (await findAvailable(rdap, keywords, maxResults ?? 5)).map(({ checkedAt: _dropped, ...r }) => r);
      return {
        structuredContent: { results },
        content: [
          {
            type: "text" as const,
            text:
              results.length > 0
                ? `Found ${results.length} available options, starting with ${results[0]!.ascii}.`
                : "No suggestions for those keywords.",
          },
        ],
      };
    },
  );

  // ---- Print (Pog Prints router behind intent verbs) ----
  server.registerTool(
    "find_printable_products",
    {
      title: "Find printable products",
      description:
        "Find suitable physical products for printing or personalizing an image, artwork, text, or custom design. Use when the user wants to make, print, order, personalize, or put a design/photo onto a physical item such as a T-shirt, hoodie, mug, poster, card, tote or gift.",
      inputSchema: {
        desiredProduct: z.string().max(200).optional(),
        colorPreferences: z.array(z.string().max(40)).max(5).optional(),
        size: z.string().max(20).optional(),
        qualityPreference: z.enum(["economy", "balanced", "premium"]).optional(),
        budget: z.number().positive().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    async (args: Record<string, unknown>) => {
      const result = findPrintableProducts(args as Parameters<typeof findPrintableProducts>[0]);
      return {
        structuredContent: result as unknown as Record<string, unknown>,
        content: [{ type: "text" as const, text: `Found ${result.products.length} printable products.` }],
      };
    },
  );

  server.registerTool(
    "quote_personalized_product",
    {
      title: "Compare print manufacturing options",
      description:
        "Compare current manufacturing options for a personalized physical product across available print providers. Use when the user wants price, delivery, quality, cheapest option, best option, or wants to choose where a custom item should be produced.",
      inputSchema: {
        productType: z.enum(PRODUCT_TYPES),
        destinationCountry: z.string().length(2),
        colorPreferences: z.array(z.string().max(40)).max(5).optional(),
        size: z.string().max(20).optional(),
        qualityPreference: z.enum(["economy", "balanced", "premium"]).optional(),
        budget: z.number().positive().optional(),
        deliveryDeadline: z.string().max(10).optional(),
        intent: z.enum(["CHEAPEST", "BALANCED", "BEST_QUALITY", "FASTEST", "LOCAL"]).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
    },
    async (args: Record<string, unknown>) => {
      const result = await quotePersonalizedProduct(
        args as Parameters<typeof quotePersonalizedProduct>[0],
      );
      const top = result.quotes[0];
      return {
        structuredContent: result as unknown as Record<string, unknown>,
        content: [
          {
            type: "text" as const,
            text: top
              ? `Best option: ${top.productName} at ${top.total.amount} ${top.total.currency} delivered.`
              : "No eligible manufacturing options.",
          },
        ],
      };
    },
  );

  server.registerTool(
    "prepare_print_design",
    {
      title: "Prepare design for printing",
      description:
        "Validate and prepare an existing image or design for a selected printable product. Use after the user has chosen or created artwork and wants it printed.",
      inputSchema: {
        widthPx: z.number().int().positive().max(20000),
        heightPx: z.number().int().positive().max(20000),
        fileType: z.string().max(10),
        hasTransparency: z.boolean(),
        canonicalProductId: z.string().max(60).optional(),
        printAreaId: z.string().max(40).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async (args: Record<string, unknown>) => {
      const result = preparePrintDesign(args as Parameters<typeof preparePrintDesign>[0]) as Record<string, unknown>;
      return {
        structuredContent: result,
        content: [{ type: "text" as const, text: `Artwork check: ${String(result["status"] ?? "unknown")}.` }],
      };
    },
  );

  server.registerTool(
    "preview_personalized_product",
    {
      title: "Preview product print areas",
      description:
        "Describe how artwork maps onto a printable product: print areas, minimum resolutions and finishes. Use when the user asks what a design will look like or where it prints on an item.",
      inputSchema: { canonicalProductId: z.string().max(60).optional() },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    async ({ canonicalProductId }: { canonicalProductId?: string }) => {
      const product =
        CANONICAL_CATALOG.find((p) => p.id === canonicalProductId) ?? CANONICAL_CATALOG[1]!;
      const result = {
        productId: product.id,
        name: product.name,
        colors: product.colors,
        sizes: product.sizes,
        printAreas: product.printAreas.map((a) => ({
          id: a.id,
          widthMm: a.widthMm,
          heightMm: a.heightMm,
          minWidthPx: Math.round((a.widthMm / 25.4) * a.minDpi),
          minHeightPx: Math.round((a.heightMm / 25.4) * a.minDpi),
        })),
      };
      return {
        structuredContent: result as unknown as Record<string, unknown>,
        content: [{ type: "text" as const, text: `${product.name}: ${product.printAreas.length} printable area(s).` }],
      };
    },
  );

  server.registerTool(
    "place_print_order",
    {
      title: "Place print order",
      description:
        "Place a previously quoted and explicitly approved personalized print order. Call only after the user has selected a specific quote/product and explicitly confirmed purchase.",
      inputSchema: {
        quoteId: z.string().min(1),
        confirmed: z.boolean(),
        idempotencyKey: z.string().min(1).max(100),
        shipping: z
          .object({
            name: z.string().min(1),
            country: z.string().min(2).max(60),
            postal: z.string().max(20).optional(),
            addressLine1: z.string().max(200).optional(),
            city: z.string().max(100).optional(),
            email: z.string().max(200).optional(),
          })
          .optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: true },
    },
    async (args: Record<string, unknown>) => {
      const result = (await placePrintOrder(
        args as Parameters<typeof placePrintOrder>[0],
      )) as Record<string, unknown>;
      return {
        structuredContent: result,
        content: [{ type: "text" as const, text: `Order status: ${String(result["status"] ?? result["code"] ?? "unknown")}.` }],
      };
    },
  );

  server.registerTool(
    "get_print_order",
    {
      title: "Get print order status",
      description: "Get production, shipping and tracking status for an existing print order.",
      inputSchema: { orderId: z.string().min(1) },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    async ({ orderId }: { orderId: string }) => {
      const result = getPrintOrder({ orderId }) as Record<string, unknown>;
      return {
        structuredContent: result,
        content: [{ type: "text" as const, text: `Order ${orderId}: ${String(result["status"] ?? result["code"] ?? "unknown")}.` }],
      };
    },
  );

  return server;
}

/** Read a capped JSON body (1MB). Rejects on overflow or bad JSON. */
function readJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 1024 * 1024) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"));
      } catch {
        reject(new Error("invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

export function startMcpServer(port = 8787): Server {  const httpServer = createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "OPTIONS" && url.pathname === "/mcp") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, mcp-session-id",
        "Access-Control-Expose-Headers": "Mcp-Session-Id",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/plain" }).end("AgentCom MCP server");
      return;
    }

    if (req.method === "GET" && url.pathname === "/llms.txt") {
      res.writeHead(200, { "content-type": "text/plain" }).end(LLMS_TXT);
      return;
    }

    if (req.method === "GET" && url.pathname === "/.well-known/agentcom.json") {
      const host = `http://${req.headers.host ?? "localhost"}`;
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(buildManifest(host), null, 2));
      return;
    }

    if (req.method === "GET" && url.pathname === "/capability.jsonld") {
      const host = `http://${req.headers.host ?? "localhost"}`;
      res.writeHead(200, { "content-type": "application/ld+json" }).end(JSON.stringify(buildJsonLd(host), null, 2));
      return;
    }

    // Domain-verification challenge (submission flow). Set the env token from
    // the portal; without it the route honestly 404s instead of half-working.
    if (req.method === "GET" && url.pathname === "/.well-known/openai-apps-challenge") {
      const token = process.env["OPENAI_APPS_CHALLENGE_TOKEN"];
      if (token) {
        res.writeHead(200, { "content-type": "text/plain" }).end(token);
      } else {
        res.writeHead(404).end("challenge not configured");
      }
      return;
    }

    // HTTP API surface (devplan: same capability, REST transport).
    if (req.method === "POST" && url.pathname.startsWith("/v1/domains/")) {
      const payload = await readJsonBody(req).catch(() => null);
      const provider = new RdapProvider();
      let result;
      if (url.pathname === "/v1/domains/check") {
        result = await checkDomainRest(provider, (payload as Record<string, unknown> | null)?.["domain"]);
      } else if (url.pathname === "/v1/domains/batch") {
        result = await batchDomainsRest(provider, (payload as Record<string, unknown> | null)?.["domains"]);
      } else if (url.pathname === "/v1/domains/suggest") {
        const p = (payload ?? {}) as Record<string, unknown>;
        result = await suggestDomainsRest(provider, p["keywords"], p["maxResults"]);
      } else {
        result = { status: 404, body: { error: "unknown endpoint" } };
      }
      res.writeHead(result.status, { "content-type": "application/json" }).end(JSON.stringify(result.body));
      return;
    }

    if (url.pathname === "/mcp" && req.method && ["POST", "GET", "DELETE"].includes(req.method)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
      const server = createAgentComServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, undefined);
      } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) res.writeHead(500).end("Internal server error");
      }
      return;
    }

    res.writeHead(404).end("Not Found");
  });

  httpServer.listen(port, () => {
    console.log(`AgentCom MCP server listening on http://localhost:${port}/mcp`);
  });
  return httpServer;
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  startMcpServer(Number(process.env["PORT"] ?? 8787));
}
