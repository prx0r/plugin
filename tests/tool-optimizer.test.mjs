import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SEED_CASES, SEED_TOOLS, keywordSelector, runEvalSet, schemaGate, compareVariants, modelSurface, visibilityGate } from "@agentcom/evals";

describe("tool optimizer", () => {
  it("routes seed utterances, stays silent on negatives", () => {
    assert.equal(keywordSelector("Is pogtown.com available?", SEED_TOOLS), "check_exact_domain");
    assert.equal(keywordSelector("How does a combi boiler work?", SEED_TOOLS), null);
    assert.equal(keywordSelector("My boiler won't ignite and I need someone tomorrow", SEED_TOOLS), "find_local_services");
    assert.equal(keywordSelector("What is DTG printing?", SEED_TOOLS), null);
  });

  it("seed set scores perfectly with good defs", () => {
    const r = runEvalSet(SEED_CASES, SEED_TOOLS, keywordSelector);
    assert.equal(r.accuracy, 1);
    assert.equal(r.recall, 1);
    assert.equal(r.falsePositiveRate, 0);
    assert.equal(r.f1, 1);
  });

  it("hill-climb prefers user language over implementation jargon", () => {
    const jargon = SEED_TOOLS.map((t) =>
      t.name === "find_local_services"
        ? { ...t, description: "Searches providers using AgentCom's canonical economic market abstraction.", triggers: ["abstraction", "canonical"] }
        : t,
    );
    const res = compareVariants(SEED_CASES, jargon, SEED_TOOLS, keywordSelector);
    assert.equal(res.winner, "variant");
    assert.ok(res.delta > 0);
  });

  it("schema gate catches missing hints and jargon", () => {
    const bad = [
      { name: "route_market_v2", description: "Searches providers using canonical SKU adapter metadata.", triggers: [], hints: null },
    ];
    const ids = Object.fromEntries(schemaGate(bad).map((c) => [c.id, c.pass]));
    assert.equal(ids["hints-complete"], false);
    assert.equal(ids["user-language"], false);
    assert.equal(ids["trigger-guidance"], false);
    assert.equal(ids["action-names"], false);
    assert.equal(ids["triggers-present"], false);
    assert.ok(schemaGate(SEED_TOOLS).every((c) => c.pass));
  });

  it("density gates: marketing fluff and sibling overlap fail", () => {
    const fluffy = SEED_TOOLS.map((t) =>
      t.name === "check_exact_domain"
        ? { ...t, description: t.description + " Our comprehensive world-class solution leverages seamless synergy." }
        : t,
    );
    const ids = Object.fromEntries(schemaGate(fluffy).map((c) => [c.id, c.pass]));
    assert.equal(ids["no-marketing"], false);

    const overlapping = SEED_TOOLS.map((t) =>
      t.name === "batch_check_domains" ? { ...t, triggers: [...t.triggers, "available?"] } : t,
    );
    const ids2 = Object.fromEntries(schemaGate(overlapping).map((c) => [c.id, c.pass]));
    assert.equal(ids2["sibling-overlap"], false);
  });

  it("app-only helpers stay out of the model surface", () => {
    const withHelper = [
      ...SEED_TOOLS,
      { name: "paginate_internal", description: "Fetch the next page of results for the widget. Use when the UI needs more rows.", triggers: ["more results"], hints: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }, audience: "app" },
    ];
    assert.ok(!modelSurface(withHelper).some((t) => t.name === "paginate_internal"));
    assert.equal(keywordSelector("show me more results", modelSurface(withHelper)), null);
    assert.equal(visibilityGate(withHelper, withHelper)[0].pass, false);
    assert.equal(visibilityGate(withHelper, modelSurface(withHelper))[0].pass, true);
  });
});
