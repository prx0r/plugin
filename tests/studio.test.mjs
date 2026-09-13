import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPluginSpec,
  buildSubmissionPacket,
  evaluateCapability,
  preflight,
  ALL_FALSE_FLAGS,
  rankVariants,
  runTier1,
  logSelectionEvent,
} from "@agentcom/studio";
import { SEED_CASES, SEED_TOOLS, AMBIGUOUS_CASES, keywordSelector } from "@agentcom/evals";

const TOOL = {
  name: "check_exact_domain",
  description: "Check whether an exact domain name is available to register. Use when the user asks if a specific domain is taken, free, or available.",
  triggers: ["available?"],
  hints: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
  inputs: [{ name: "domain", type: "string", required: true }],
  outputs: ["input", "available"],
  behavior: {
    mutates_state: false,
    accesses_public_or_open_ended_external_entities: true,
    irreversible_or_hard_to_reverse: false,
    sends_data_to_third_party: true,
  },
  justifications: {
    readOnlyHint: "Only reads public registration status and changes nothing.",
    openWorldHint: "Queries live public registration infrastructure.",
    destructiveHint: "Lookups cannot delete or irreversibly change anything.",
  },
};

const CAP = {
  name: "Domain Availability",
  subtitle: "Check domain availability",
  description: "Check whether an exact domain name is available to register using live public data.",
  category: "UTILITIES",
  commerce: "none",
  mcpUrl: "https://domains.agentcom.org/mcp",
  releaseNotes: "Initial submission.",
  tools: [TOOL],
  positives: [{ prompt: "Is pogtown.com available?", expectedTool: "check_exact_domain", expectedOutput: "Verdict for pogtown.com." }],
  negatives: [{ prompt: "What is RDAP?", expectedBehavior: "Explain the concept." }],
};

describe("studio", () => {
  it("creator builds kit-shaped spec and submission packet", () => {
    const spec = buildPluginSpec(CAP);
    assert.equal(spec.tools[0].name, "check_exact_domain");
    assert.equal(spec.tools[0].annotations.readOnlyHint, true);
    assert.equal(spec.mcp.url_type, "Universal");
    const packet = buildSubmissionPacket(CAP);
    assert.equal(packet.app_info.display_name, "Domain Availability");
    assert.equal(packet.positive_test_cases[0].expected_output, "Verdict for pogtown.com.");
    const todo = buildSubmissionPacket({ ...CAP, positives: [{ prompt: "x?", expectedTool: "check_exact_domain" }] });
    assert.ok(todo.positive_test_cases[0].expected_output.includes("TODO"));
  });

  it("creator refuses tools without explicit hints", () => {
    assert.throws(() => buildPluginSpec({ ...CAP, tools: [{ ...TOOL, hints: null }] }), /explicit hints/);
  });

  it("evaluator passes the seed set end to end (F1 >= 0.7)", () => {
    const r = evaluateCapability(SEED_TOOLS, SEED_CASES, keywordSelector);
    assert.ok(r.metrics.f1 >= 0.7, `F1 too low: ${r.metrics.f1}`);
    assert.ok(r.metrics.recall >= 0.6, `Recall too low: ${r.metrics.recall}`);
  });

  it("publisher blocks pre-launch flags, passes when all true", () => {
    const like = {
      app: { name: "Domain Availability", subtitle: "Check domain availability", description: "Live domain checks.", capabilities: [], starter_prompts: [] },
      tests: { positive: [1, 2, 3, 4, 5], negative: [1, 2, 3] },
    };
    const blocked = preflight(like, ALL_FALSE_FLAGS);
    assert.equal(blocked.verdict, "NO_GO");
    assert.ok(blocked.blockers.some((b) => b.includes("identity")));
    const go = preflight(like, {
      verifiedIdentity: true, publicProduction: true, domainVerified: true,
      scanCurrent: true, privacyComplete: true, demoUrlLive: true,
    });
    assert.equal(go.verdict, "GO");
    const badCounts = preflight({ app: like.app, tests: { positive: [1], negative: [] } }, ALL_FALSE_FLAGS);
    assert.ok(badCounts.blockers.some((b) => b.includes("5 positive")));
  });

  it("committed corpus matches seeds exactly (regen, never hand-edit)", async () => {
    const { readFile } = await import("node:fs/promises");
    const lines = async (f) => (await readFile(new URL(`../packages/evals/corpus/${f}`, import.meta.url), "utf8")).trim().split("\n").map(JSON.parse);
    const positives = await lines("positives.jsonl");
    const negatives = await lines("negatives.jsonl");
    const ambiguous = await lines("ambiguous.jsonl");
    assert.equal(positives.length + negatives.length, SEED_CASES.length);
    assert.deepEqual(new Set(positives.map((p) => p.id)), new Set(SEED_CASES.filter((c) => c.expectTool).map((c) => c.id)));
    assert.deepEqual(new Set(ambiguous.map((a) => a.id)), new Set(AMBIGUOUS_CASES.map((c) => c.id)));
    assert.ok(ambiguous.every((a) => a.review_only === true));
  });

  it("Tier-1 runner records immutable rows with a fake judge", async () => {
    const fake = async (prompt, tools) => ({
      tool: keywordSelector(prompt, tools),
      args: {},
    });
    const summary = await runTier1(SEED_CASES.slice(0, 4), SEED_TOOLS, fake, { model: "fake-judge-v1", toolVariant: "test" });
    assert.equal(summary.records.length, 4);
    assert.ok(summary.records.every((r) => r.model === "fake-judge-v1" && typeof r.timestamp === "string"));
    assert.ok(summary.precision >= 0 && summary.precision <= 1);
  });

  it("optimizer ranks user language first and logs selection events", () => {
    const jargon = SEED_TOOLS.map((t) =>
      t.name === "find_local_services" ? { ...t, triggers: ["abstraction"] } : t,
    );
    const ranked = rankVariants(SEED_CASES, [
      { label: "jargon", tools: jargon },
      { label: "user-language", tools: SEED_TOOLS },
    ], keywordSelector);
    assert.equal(ranked[0].label, "user-language");
    assert.equal(ranked[0].winner, true);
    const ev = logSelectionEvent({ prompt: "x", predicted: "y", expected: "y", toolVersion: "v1", host: "chatgpt" });
    assert.equal(ev.type, "tool-selected");
    assert.equal(ev.host, "chatgpt");
  });
});
