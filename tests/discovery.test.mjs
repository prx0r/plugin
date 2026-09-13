import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { startMcpServer } from "@agentcom/mcp/server";

async function liveServer() {
  const srv = startMcpServer(0);
  await new Promise((res) => srv.on("listening", res));
  const { port } = srv.address();
  return { srv, base: `http://localhost:${port}` };
}

describe("discovery surface", () => {
  it("serves manifest, llms.txt, json-ld and honest challenge 404", async () => {
    const { srv, base } = await liveServer();
    try {
      const manifest = await (await fetch(`${base}/.well-known/agentcom.json`)).json();
      assert.equal(manifest.manifest, "agentcom-manifest-v1");
      assert.ok(manifest.mcp.endsWith("/mcp"));
      assert.ok(manifest.capabilities.some((c) => c.id === "domains.check"));

      const llms = await (await fetch(`${base}/llms.txt`)).text();
      assert.ok(llms.includes("check_exact_domain"));
      assert.ok(llms.includes("Never place an order"));

      const jsonld = await (await fetch(`${base}/capability.jsonld`)).json();
      assert.ok(JSON.stringify(jsonld).includes("/mcp"));

      const chal = await fetch(`${base}/.well-known/openai-apps-challenge`);
      assert.equal(chal.status, 404);
    } finally {
      srv.close();
    }
  });

  it("canonical base URL wins over Host headers when configured", async () => {
    process.env.PUBLIC_BASE_URL = "https://domains.agentcom.org";
    const { srv, base } = await liveServer();
    try {
      const manifest = await (await fetch(`${base}/.well-known/agentcom.json`)).json();
      assert.equal(manifest.mcp, "https://domains.agentcom.org/mcp");
      const jsonld = await (await fetch(`${base}/capability.jsonld`)).json();
      assert.ok(JSON.stringify(jsonld).includes("https://domains.agentcom.org"));
    } finally {
      delete process.env.PUBLIC_BASE_URL;
      srv.close();
    }
  });
});
