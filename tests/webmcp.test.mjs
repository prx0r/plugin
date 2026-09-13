import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectModelContext, domainCheckToolDef, declarativeFormSnippet, recoveryError, registerAgentComTools } from "@print/web/webmcp";

describe("webmcp starter", () => {
  it("never throws without a browser, registers nothing", () => {
    assert.equal(detectModelContext({}), null);
    assert.equal(registerAgentComTools(async () => ({})), 0);
  });

  it("tool def mirrors the MCP trigger language", () => {
    const def = domainCheckToolDef();
    assert.equal(def.annotations.readOnlyHint, true);
    assert.ok(def.description.includes("Use when the user asks"));
    assert.deepEqual(def.inputSchema.required, ["domain"]);
  });

  it("registers through either attachment point", () => {
    const seen = [];
    const fake = { registerTool: (t) => seen.push(t.name) };
    assert.equal(registerAgentComTools(async () => ({}), { modelContext: fake }), 1);
    assert.deepEqual(seen, ["check_domain_availability"]);
  });

  it("declarative form exposes the same capability as HTML", () => {
    const html = declarativeFormSnippet();
    assert.ok(html.includes('toolname="check_domain_availability"'));
    assert.ok(html.includes('action="/v1/domains/check"'));
    assert.ok(html.includes('name="domain"'));
  });

  it("errors guide the next action", () => {
    const msg = recoveryError("No domain entered.", "Provide an exact domain like example.com.").content[0].text;
    assert.ok(msg.includes("No domain entered.") && msg.includes("example.com"));
  });
});
