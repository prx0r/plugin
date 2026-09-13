import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPluginSpec,
  buildSubmissionPacket,
  evaluateCapability,
  preflight,
  ALL_FALSE_FLAGS,
  rankVariants,
  logSelectionEvent,
} from "@print/studio";
import { SEED_CASES, SEED_TOOLS, keywordSelector } from "@print/evals";

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

  it("evaluator passes the seed set end to end", () => {
    const r = evaluateCapability(SEED_TOOLS, SEED_CASES, keywordSelector);
    assert.equal(r.pass, true);
    assert.equal(r.metrics.f1, 1);
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
