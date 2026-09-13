import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RdapProvider } from "@agentcom/domains";
import { batchDomainsRest, checkDomainRest, suggestDomainsRest } from "@agentcom/http";
import { startMcpServer } from "@agentcom/mcp/server";

const notFound = async () => ({ status: 404, json: async () => null });
const taken = async () => ({ status: 200, json: async () => ({ objectClassName: "domain" }) });

describe("http surface", () => {
  it("check/batch/suggest handlers share core semantics (stubbed)", async () => {
    const free = new RdapProvider({ fetchImpl: notFound });
    assert.equal((await checkDomainRest(free, "free-xyz.com")).status, 200);
    assert.equal((await checkDomainRest(free, "free-xyz.com")).body.status, "available");
    const busy = new RdapProvider({ fetchImpl: taken });
    assert.equal((await checkDomainRest(busy, "example.com")).body.status, "registered");
    assert.equal((await checkDomainRest(free, "")).status, 400);
    assert.equal((await checkDomainRest(free, "not a domain")).status, 422);
    assert.equal((await batchDomainsRest(free, [])).status, 400);
    assert.equal((await batchDomainsRest(free, new Array(21).fill("a.com"))).status, 400);
    const b = await batchDomainsRest(free, ["a.com", "b.io"]);
    assert.equal(b.body.results.length, 2);
    assert.equal((await suggestDomainsRest(free, "")).status, 400);
    const s = await suggestDomainsRest(free, "plumbsoft", 999);
    assert.ok(s.body.results.length <= 10);
  });

  it("live routes reject bad input without network", async () => {
    const srv = startMcpServer(0);
    await new Promise((res) => srv.on("listening", res));
    const { port } = srv.address();
    try {
      const bad = await fetch(`http://localhost:${port}/v1/domains/check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: "not a domain!!" }),
      });
      assert.equal(bad.status, 422);
      const missing = await fetch(`http://localhost:${port}/v1/domains/batch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      assert.equal(missing.status, 400);
      const unknown = await fetch(`http://localhost:${port}/v1/domains/nope`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      assert.equal(unknown.status, 404);
    } finally {
      srv.close();
    }
  });
});
