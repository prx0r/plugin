// Studio CLI: npm run studio -- <eval|gates|packet|optimize|preflight>
// Prints JSON reports to stdout. Exit 0 pass/GO, 1 otherwise.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { keywordSelector, similaritySelector, runEvalSet, schemaGate, SEED_CASES, SEED_TOOLS } from "@print/evals";
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

if (cmd === "experiment") {
  const wanted = process.argv[3];
  const registry = JSON.parse(readFileSync("registry/experiments.json", "utf8")) as {
    experiments: { id: string; variants: { label: string; tools: Record<string, string> }[] }[];
  };
  const exps = registry.experiments.filter((e) => !wanted || e.id === wanted);
  if (exps.length === 0) fail({ cmd, error: `unknown experiment (try ${registry.experiments.map((e: { id: string }) => e.id).join(", ")})` });
  const out = [];
  for (const exp of exps) {
    const domainTools = SEED_TOOLS.filter((t) => exp.variants[0]!.tools[t.name]);
    const cases = SEED_CASES.filter((c) => c.vertical === "domains");
    const ranked = rankVariants(
      cases,
      exp.variants.map((v: { label: string; tools: Record<string, string> }) => ({
        label: v.label,
        tools: domainTools.map((t) => ({ ...t, description: v.tools[t.name] ?? t.description })),
      })),
      similaritySelector,
    );
    const result = {
      experiment: exp.id,
      method: "similarity-proxy",
      note: "Deterministic stand-in. Re-run with model judge before submission decisions.",
      at: new Date().toISOString(),
      corpus: { cases: cases.length },
      ranked,
    };
    mkdirSync("registry/results", { recursive: true });
    const file = `registry/results/${exp.id}-${result.at.slice(0, 10)}.json`;
    writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
    out.push({ id: exp.id, file, winner: ranked[0]?.label, f1: ranked[0]?.f1 });
  }
  ok({ cmd, runs: out });
}

console.error("usage: studio <eval|gates|packet|optimize|preflight|full|experiment [id]>");
process.exit(2);
