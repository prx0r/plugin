// Studio CLI: npm run studio -- <eval|gates|packet|optimize|preflight>
// Prints JSON reports to stdout. Exit 0 pass/GO, 1 otherwise.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { keywordSelector, similaritySelector, runEvalSet, schemaGate, AMBIGUOUS_CASES, SEED_CASES, SEED_TOOLS } from "@agentcom/evals";
import { evaluateCapability } from "./evaluator.ts";
import { ALL_FALSE_FLAGS, preflight } from "./publisher.ts";
import { rankVariants } from "./optimizer.ts";

function fail(obj: unknown): never {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(1);
}

function ok(obj: unknown): never {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(0);
}

const cmd = process.argv[2];

if (cmd === "eval") {
  const r = runEvalSet(SEED_CASES, SEED_TOOLS, keywordSelector);
  if (r.f1 === 1) ok({ cmd, f1: r.f1, recall: r.recall, falsePositiveRate: r.falsePositiveRate });
  fail({ cmd, report: r });
}

if (cmd === "gates") {
  const checks = schemaGate(SEED_TOOLS);
  if (checks.every((c) => c.pass)) ok({ cmd, checks: checks.length, all: "pass" });
  fail({ cmd, checks });
}

if (cmd === "packet" || cmd === "preflight") {
  const packet = JSON.parse(readFileSync("submissions/domains/chatgpt-app-submission.json", "utf8"));
  const spec = JSON.parse(readFileSync("submissions/domains/plugin_spec.json", "utf8"));
  const like = {
    app: {
      name: packet.app_info?.display_name ?? spec.app?.name,
      subtitle: packet.app_info?.subtitle ?? spec.app?.subtitle,
      description: packet.app_info?.description ?? spec.app?.description,
      commerce: spec.app?.commerce ?? "none",
      capabilities: spec.app?.capabilities ?? [],
      starter_prompts: spec.app?.starter_prompts ?? [],
    },
    tests: { positive: packet.positive_test_cases ?? [], negative: packet.negative_test_cases ?? [] },
  };
  const result = preflight(like, ALL_FALSE_FLAGS);
  if (result.verdict === "GO") ok({ cmd, result });
  fail({ cmd, result });
}

if (cmd === "optimize") {
  const jargon = SEED_TOOLS.map((t) =>
    t.name === "find_local_services"
      ? { ...t, description: "Searches providers using canonical market abstraction.", triggers: ["abstraction"] }
      : t,
  );
  const ranked = rankVariants(
    SEED_CASES,
    [
      { label: "jargon", tools: jargon },
      { label: "user-language", tools: SEED_TOOLS },
    ],
    keywordSelector,
  );
  ok({ cmd, ranked });
}

if (cmd === "full") {
  const report = evaluateCapability(SEED_TOOLS, SEED_CASES, keywordSelector);
  if (report.pass) ok({ cmd, pass: true, f1: report.metrics.f1 });
  fail({ cmd, report });
}

if (cmd === "corpus") {
  // Single source: SEED_CASES + AMBIGUOUS_CASES generate the committed JSONL.
  const positives = SEED_CASES.filter((c) => c.expectTool != null).map((c) => ({
    id: c.id, prompt: c.utterance, expected_tool: c.expectTool, vertical: c.vertical,
  }));
  const negatives = SEED_CASES.filter((c) => c.expectTool == null).map((c) => ({
    id: c.id, prompt: c.utterance, expected_tool: null, vertical: c.vertical,
  }));
  const ambiguous = AMBIGUOUS_CASES.map((c) => ({ id: c.id, prompt: c.utterance, vertical: c.vertical, note: c.note, review_only: true }));
  const toolSelection = [...positives, ...negatives].map((c) => ({ ...c, kind: "tool_selection" }));
  mkdirSync("packages/evals/corpus", { recursive: true });
  const files = {
    "packages/evals/corpus/positives.jsonl": positives,
    "packages/evals/corpus/negatives.jsonl": negatives,
    "packages/evals/corpus/ambiguous.jsonl": ambiguous,
    "packages/evals/corpus/tool_selection.jsonl": toolSelection,
  };
  for (const [file, rows] of Object.entries(files)) {
    writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }
  ok({ cmd, files: Object.keys(files), positives: positives.length, negatives: negatives.length, ambiguous: ambiguous.length });
}

if (cmd === "experiment") {
  const wanted = process.argv[3];
  const registry = JSON.parse(readFileSync("registry/experiments.json", "utf8")) as {
    experiments: {
      id: string;
      capability: string;
      variants: { label: string; app: unknown; tools: { logical: string; name: string; title: string; description: string }[] }[];
    }[];
  };
  const exps = registry.experiments.filter((e) => !wanted || e.id === wanted);
  if (exps.length === 0) fail({ cmd, error: `unknown experiment (try ${registry.experiments.map((e: { id: string }) => e.id).join(", ")})` });
  const { createHash } = await import("node:crypto");
  const out = [];
  const LOGICAL_OF: Record<string, string> = {
    check_exact_domain: "domains.check_exact",
    batch_check_domains: "domains.check_batch",
    find_available_domains: "domains.check_suggest",
  };
  for (const exp of exps) {
    const baseByLogical = new Map(SEED_TOOLS.map((t) => [LOGICAL_OF[t.name] ?? t.name, t]));
    const cases = SEED_CASES.filter((c) => c.vertical === "domains").map((c) => ({
      ...c,
      expectTool: LOGICAL_OF[c.expectTool ?? ""] ?? c.expectTool,
    }));
    const datasetHash = createHash("sha256").update(JSON.stringify(cases)).digest("hex").slice(0, 16);
    const ranked = rankVariants(
      cases,
      exp.variants.map((v: { label: string; tools: { logical: string; name: string; title: string; description: string }[] }) => ({
        label: v.label,
        tools: v.tools.map((t) => {
          const base = baseByLogical.get(t.logical);
          if (!base) throw new Error(`unknown logical tool ${t.logical}`);
          return { ...base, name: t.name, description: t.description, logical: t.logical };
        }),
      })),
      similaritySelector,
      {
        resolve: (predicted) => {
          if (!predicted) return predicted;
          for (const v of exp.variants) {
            const hit = v.tools.find((t) => t.name === predicted);
            if (hit) return hit.logical;
          }
          return predicted;
        },
      },
    );
    const result = {
      experiment_id: exp.id,
      capability_version: "domains@v1",
      surface_version: "agentcom-mcp@0.2.0",
      model: "similarity-proxy",
      host: "local-ci",
      method: "similarity-proxy",
      methodology_status: "valid_for_description_claim_only",
      methodology_note: "Variants differ in app/tool names AND descriptions; keyword triggers held constant. Upgrade to Tier-1 model runs before submission decisions.",
      dataset_hash: datasetHash,
      started_at: new Date().toISOString(),
      metrics: ranked,
      limitations: ["lexical proxy, not model routing", "app display name not exercised by proxy", "10-case corpus is harness-scale"],
    };
    mkdirSync("registry/results", { recursive: true });
    // Unique per run: results are append-only, never overwritten.
    const stamp = result.started_at.replace(/[:.]/g, "-");
    const file = `registry/results/${exp.id}-${stamp}.json`;
    writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
    out.push({ id: exp.id, file, winner: ranked[0]?.label, f1: ranked[0]?.f1 });
  }
  ok({ cmd, runs: out });
}

console.error("usage: studio <eval|gates|packet|optimize|preflight|full|experiment [id]>");
process.exit(2);
