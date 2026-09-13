import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createDomainsServer, startMcpServer } from "@agentcom/mcp/server";
import { RdapProvider } from "@agentcom/domains";
import { checkDomainRest } from "@agentcom/http";
import { probeDeployment, logSurfaceAttempt } from "@agentcom/studio";

const stub404 = async () => ({ status: 404, json: async () => null });

function stripVolatile(result) {
  const { checked_at: _c, sources: _s, ...rest } = result;
  void _c; void _s;
  return rest;
}

describe("deployments, telemetry, parity", () => {
  it("probeDeployment passes against a live local surface", async () => {
    const srv = startMcpServer(0);
    await new Promise((res) => srv.on("listening", res));
    const { port } = srv.address();
    try {
      const probe = await probeDeployment(`http://localhost:${port}`, {
        frozenToolNames: ["check_exact_domain", "batch_check_domains", "find_available_domains"],
      });
      assert.ok(probe.checks.every((c) => c.pass), JSON.stringify(probe.checks));
      assert.ok(typeof probe.latencyMs === "number");
    } finally {
      srv.close();
    }
  });

  it("probeDeployment never throws on dead hosts", async () => {
    const probe = await probeDeployment("http://localhost:1", { timeoutMs: 500 });
    assert.ok(probe.checks.length > 0);
    assert.ok(probe.checks.every((c) => c.pass === false));
  });

  it("surface_attempt carries selection+execution+completion per surface", () => {
    const ev = logSurfaceAttempt({
      capability: "domains.check",
      surface: "chatgpt",
      surface_version: "agentcom-mcp@0.2.0",
      host: "chatgpt",
      selection: { expected: "check_exact_domain", actual: "check_exact_domain" },
      execution: { success: true, duration_ms: 282, truth_status: "confirmed" },
      completion: { success: true },
    });
    assert.equal(ev.event, "surface_attempt");
    assert.equal(ev.execution.truth_status, "confirmed");
    const httpEv = logSurfaceAttempt({ capability: "domains.check", surface: "http", surface_version: "v1" });
    assert.equal(httpEv.selection, undefined);
  });

  it("MCP and HTTP agree on canonical truth for one fixture", async () => {
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    const server = createDomainsServer({ domainsFetch: stub404 });
    const client = new Client({ name: "parity-test", version: "0.0.0" });
    await Promise.all([server.connect(serverT), client.connect(clientT)]);
    try {
      const mcp = await client.callTool({ name: "check_exact_domain", arguments: { domain: "parity-probe-xyz.com" } });
      const http = await checkDomainRest(new RdapProvider({ fetchImpl: stub404 }), "parity-probe-xyz.com");
      assert.deepEqual(stripVolatile(mcp.structuredContent), stripVolatile(http.body));
    } finally {
      await client.close();
      await server.close();
    }
  });
});
