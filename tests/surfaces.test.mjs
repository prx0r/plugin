import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAgentComServer } from "@print/mcp/server";
import { TOOLS } from "@print/mcp";
import { domainCheckToolDef } from "@print/web/webmcp";

const frozen = JSON.parse(readFileSync(new URL("../schemas/domain/v1.json", import.meta.url)));

describe("surface contracts", () => {
  it("live MCP tools match frozen schemas/domain/v1.json", async () => {
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    const server = createAgentComServer({ domainsFetch: async () => ({ status: 404, json: async () => null }) });
    const client = new Client({ name: "freeze-test", version: "0.0.0" });
    await Promise.all([server.connect(serverT), client.connect(clientT)]);
    try {
      const { tools } = await client.listTools();
      for (const f of frozen.tools) {
        const live = tools.find((t) => t.name === f.name);
        assert.ok(live, `frozen tool missing live: ${f.name}`);
        assert.equal(live.description, f.description);
        for (const hint of ["readOnlyHint", "openWorldHint", "destructiveHint"]) {
          assert.equal(live.annotations[hint], f.annotations[hint], `${f.name}.${hint}`);
        }
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("WebMCP trigger language matches the MCP tool", async () => {
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    const server = createAgentComServer();
    const client = new Client({ name: "consistency-test", version: "0.0.0" });
    await Promise.all([server.connect(serverT), client.connect(clientT)]);
    try {
      const { tools } = await client.listTools();
      const mcp = tools.find((t) => t.name === "check_exact_domain");
      assert.equal(domainCheckToolDef().description, mcp.description);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("print tools match the single-source TOOLS registry", async () => {
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    const server = createAgentComServer();
    const client = new Client({ name: "registry-test", version: "0.0.0" });
    await Promise.all([server.connect(serverT), client.connect(clientT)]);
    try {
      const { tools } = await client.listTools();
      for (const def of TOOLS) {
        const live = tools.find((t) => t.name === def.name);
        assert.ok(live, `registry tool missing live: ${def.name}`);
        assert.equal(live.description, def.description);
        for (const hint of ["readOnlyHint", "openWorldHint", "destructiveHint"]) {
          assert.equal(live.annotations[hint], def.annotations[hint], `${def.name}.${hint}`);
        }
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("registry capabilities match the served manifest", async () => {
    const registry = JSON.parse(readFileSync(new URL("../registry/capabilities.json", import.meta.url)));
    const { startMcpServer } = await import("@print/mcp/server");
    const srv = startMcpServer(0);
    await new Promise((res) => srv.on("listening", res));
    const { port } = srv.address();
    try {
      const manifest = await (await fetch(`http://localhost:${port}/.well-known/agentcom.json`)).json();
      const servedIds = new Set(manifest.capabilities.map((c) => c.id));
      for (const cap of registry.capabilities) {
        assert.ok(servedIds.has(cap.id), `registry capability not served: ${cap.id}`);
      }
    } finally {
      srv.close();
    }
  });
});
