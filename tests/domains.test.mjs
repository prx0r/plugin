import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeDomain, suggestDomains, findAvailable, RdapProvider } from "@print/domains";

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

  it("404 → available, 200 domain object → taken", async () => {
    const avail = new RdapProvider({ fetchImpl: notFound });
    assert.equal((await avail.check("free-domain-xyz.com")).available, true);
    const taken = new RdapProvider({ fetchImpl: ok({ objectClassName: "domain" }) });
    assert.equal((await taken.check("example.com")).available, false);
  });

  it("errors and odd shapes → unknown, never invented", async () => {
    const err = new RdapProvider({ fetchImpl: serverError });
    assert.equal((await err.check("example.com")).available, null);
    const weird = new RdapProvider({ fetchImpl: ok({ objectClassName: "nameserver" }) });
    assert.equal((await weird.check("example.com")).available, null);
    const boom = new RdapProvider({ fetchImpl: async () => { throw new Error("net down"); } });
    assert.equal((await boom.check("example.com")).available, null);
  });

  it("invalid input skips the network entirely", async () => {
    let called = 0;
    const p = new RdapProvider({ fetchImpl: async (...a) => { called++; return notFound(...a); } });
    const r = await p.check("not a domain!!");
    assert.equal(r.valid, false);
    assert.equal(called, 0);
  });

  it("batch preserves input order under concurrency", async () => {
    const p = new RdapProvider({
      fetchImpl: async (url) => (url.includes("taken") ? ok({ objectClassName: "domain" })() : notFound()),
    });
    const out = await p.batch(["a-free.com", "taken-one.com", "b-free.com"], 2);
    assert.deepEqual(out.map((r) => r.available), [true, false, true]);
  });

  it("suggestions are deterministic and findAvailable prefers available", async () => {
    assert.deepEqual(suggestDomains("plumb soft"), suggestDomains("plumb soft"));
    assert.ok(suggestDomains("plumbsoft").includes("plumbsoft.com"));
    assert.deepEqual(suggestDomains("!!!"), []);
    const p = new RdapProvider({ fetchImpl: notFound });
    const found = await findAvailable(p, "plumbsoft", 3);
    assert.equal(found.length, 3);
    assert.ok(found.every((f) => f.available === true));
  });

  it("declares read-only capabilities (no quote/messaging/booking)", () => {
    const p = new RdapProvider();
    assert.equal(p.capabilities.discovery, true);
    assert.equal(p.capabilities.realtimeAvailability, true);
    assert.equal(p.capabilities.booking, false);
  });
});
