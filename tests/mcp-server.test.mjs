import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAgentComServer, createDomainsServer, createPrintServer } from "@agentcom/mcp/server";

const stub404 = async () => ({ status: 404, json: async () => null });

async function linkedClient(fetchImpl = stub404) {
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const server = createAgentComServer({ domainsFetch: fetchImpl });
  const client = new Client({ name: "agentcom-test", version: "0.0.0" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return { server, client };
}

describe("mcp transport", () => {
  it("advertises all 9 intent-verb tools, no supplier ops", async () => {
    const { server, client } = await linkedClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "batch_check_domains",
      "check_exact_domain",
      "find_available_domains",
      "find_printable_products",
      "get_print_order",
      "place_print_order",
      "prepare_print_design",
      "preview_personalized_product",
      "quote_personalized_product",
    ]);
    assert.ok(!names.some((n) => /prodigi|printful|checkatrade|rdap/i.test(n)));
    await client.close();
    await server.close();
  });

  it("micro-apps are isolated: domains=3 tools, print=6, no cross-contamination", async () => {
    for (const [factory, names] of [
      [() => createDomainsServer({ domainsFetch: stub404 }), ["batch_check_domains", "check_exact_domain", "find_available_domains"]],
      [createPrintServer, ["find_printable_products", "get_print_order", "place_print_order", "prepare_print_design", "preview_personalized_product", "quote_personalized_product"]],
    ]) {
      const [clientT, serverT] = InMemoryTransport.createLinkedPair();
      const server = factory();
      const client = new Client({ name: "isolation-test", version: "0.0.0" });
      await Promise.all([server.connect(serverT), client.connect(clientT)]);
      try {
        const { tools } = await client.listTools();
        assert.deepEqual(tools.map((t) => t.name).sort(), names);
      } finally {
        await client.close();
        await server.close();
      }
    }
  });

  it("check_exact_domain end to end over MCP (stubbed RDAP)", async () => {
    const { server, client } = await linkedClient();
    const res = await client.callTool({ name: "check_exact_domain", arguments: { domain: "free-xyz-123.com" } });
    assert.equal(res.structuredContent.status, "available");
    const bad = await client.callTool({ name: "check_exact_domain", arguments: { domain: "not a domain" } });
    assert.equal(bad.structuredContent.valid, false);
    await client.close();
    await server.close();
  });

  it("quote_personalized_product end to end over MCP", async () => {
    const { server, client } = await linkedClient();
    const res = await client.callTool({
      name: "quote_personalized_product",
      arguments: { productType: "tshirt", destinationCountry: "GB", size: "L" },
    });
    assert.ok(res.structuredContent.quotes.length > 0);
    await client.close();
    await server.close();
  });
});
