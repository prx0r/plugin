import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeSources, normalizeDomain, suggestDomains, findAvailable, RdapProvider } from "@agentcom/domains";

const ok = (json) => async () => ({ status: 200, json: async () => json });
const notFound = async () => ({ status: 404, json: async () => null });
const serverError = async () => ({ status: 500, json: async () => null });

describe("domains vertical", () => {
  it("normalizes and validates without throwing", () => {
    assert.deepEqual(normalizeDomain("  Example.COM. "), { ascii: "example.com", valid: true });
    assert.equal(normalizeDomain("no spaces here.com").valid, false);
    assert.equal(normalizeDomain("notld").valid, false);
    assert.equal(normalizeDomain("").valid, false);
    assert.equal(normalizeDomain("-bad-.com").valid, false);
  });

  it("404 → available (medium, RDAP-only wording), 200 domain object → registered", async () => {
    const avail = new RdapProvider({ fetchImpl: notFound });
    const a = await avail.check("free-domain-xyz.com");
    assert.equal(a.status, "available");
    assert.equal(a.confidence, "medium");
    assert.ok(a.message.includes("RDAP"));
    assert.ok(a.checked_at);
    const taken = new RdapProvider({ fetchImpl: ok({ objectClassName: "domain" }) });
    const t = await taken.check("example.com");
    assert.equal(t.status, "registered");
    assert.equal(t.confidence, "high");
  });

  it("network failure, 500s and odd shapes → unknown, never available", async () => {
    for (const impl of [serverError, ok({ objectClassName: "nameserver" }), async () => { throw new Error("net down"); }]) {
      const p = new RdapProvider({ fetchImpl: impl });
      const r = await p.check("example.com");
      assert.equal(r.status, "unknown", "must never invent availability");
    }
  });

  it("timeout → unknown, never available", async () => {
    const hanging = (_url, opts) => new Promise((_, reject) => {
      opts?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    });
    const p = new RdapProvider({ fetchImpl: hanging, timeoutMs: 30 });
    assert.equal((await p.check("example.com")).status, "unknown");
  });

  it("malformed input → unsupported without touching network", async () => {
    let called = 0;
    const p = new RdapProvider({ fetchImpl: async (...a) => { called++; return notFound(...a); } });
    const r = await p.check("not a domain!!");
    assert.equal(r.valid, false);
    assert.equal(r.status, "unsupported");
    assert.equal(called, 0);
  });

  it("corroboration: disagreement → conflicting, never the favorable answer", async () => {
    const at = new Date().toISOString();
    const r = mergeSources([
      { type: "rdap", provider: "rdap", status: "available", at },
      { type: "registrar", provider: "reg", status: "registered", at },
    ]);
    assert.equal(r.status, "conflicting");
    const reg = mergeSources([
      { type: "rdap", provider: "rdap", status: "available", at },
      { type: "registrar", provider: "reg", status: "available", at },
    ]);
    assert.deepEqual(reg, { status: "available", confidence: "high" });
  });

  it("batch preserves input order under concurrency", async () => {
    const p = new RdapProvider({
      fetchImpl: async (url) => (url.includes("taken") ? ok({ objectClassName: "domain" })() : notFound()),
    });
    const out = await p.batch(["a-free.com", "taken-one.com", "b-free.com"], 2);
    assert.deepEqual(out.map((r) => r.status), ["available", "registered", "available"]);
  });

  it("findAvailable returns ONLY confirmed available (unknowns excluded)", async () => {
    let n = 0;
    const flaky = async () => (++n % 2 === 0 ? notFound() : serverError());
    const p = new RdapProvider({ fetchImpl: flaky });
    const found = await findAvailable(p, "plumbsoft", 10);
    assert.ok(found.length > 0);
    assert.ok(found.every((f) => f.status === "available"));
  });

  it("suggestions are deterministic", async () => {
    assert.deepEqual(suggestDomains("plumb soft"), suggestDomains("plumb soft"));
    assert.ok(suggestDomains("plumbsoft").includes("plumbsoft.com"));
    assert.deepEqual(suggestDomains("!!!"), []);
  });

  it("declares read-only capabilities (no quote/messaging/booking)", () => {
    const p = new RdapProvider();
    assert.equal(p.capabilities.discovery, true);
    assert.equal(p.capabilities.realtimeAvailability, true);
    assert.equal(p.capabilities.booking, false);
  });
});
