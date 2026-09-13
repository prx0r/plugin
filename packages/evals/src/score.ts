// Scoring: routing metrics + deterministic submission pre-checks.
// Metrics mirror MCPJam's vocabulary loosely: accuracy over expected calls,
// unexpected-call rate instead of raw failures.
import type { EvalCase, EvalTool } from "./cases.ts";
import type { ToolSelector } from "./selector.ts";

export interface CaseResult {
  id: string;
  expected: string | null;
  predicted: string | null;
  correct: boolean;
}

export interface EvalReport {
  total: number;
  positives: number;
  negatives: number;
  correct: number;
  accuracy: number;
  /** Recall over should-trigger cases. */
  recall: number;
  /** Precision over cases where something triggered. */
  precision: number;
  /** False-positive rate over should-NOT-trigger cases. */
  falsePositiveRate: number;
  f1: number;
  results: CaseResult[];
}

export interface EvalOptions {
  /** Map a predicted exposed name back to logical identity before compare. */
  resolve?: (predicted: string | null) => string | null;
}

export function runEvalSet(cases: EvalCase[], tools: EvalTool[], selector: ToolSelector, opts?: EvalOptions): EvalReport {
  const resolve = opts?.resolve ?? ((p: string | null) => p);
  const results: CaseResult[] = cases.map((c) => {
    const predicted = resolve(selector(c.utterance, tools));
    return { id: c.id, expected: c.expectTool, predicted, correct: predicted === c.expectTool };
  });
  const positives = cases.filter((c) => c.expectTool != null);
  const negatives = cases.filter((c) => c.expectTool == null);
  const tp = results.filter((r) => r.expected != null && r.correct).length;
  const fn = positives.length - tp;
  const fp = results.filter((r) => r.predicted != null && !r.correct).length;
  const predictedPositive = tp + fp;
  const recall = positives.length === 0 ? 1 : tp / positives.length;
  const precision = predictedPositive === 0 ? 1 : tp / predictedPositive;
  const falsePositiveRate = negatives.length === 0 ? 0 : fp / negatives.length;
  void fn;
  return {
    total: cases.length,
    positives: positives.length,
    negatives: negatives.length,
    correct: results.filter((r) => r.correct).length,
    accuracy: cases.length === 0 ? 1 : results.filter((r) => r.correct).length / cases.length,
    recall,
    precision,
    falsePositiveRate,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
    results,
  };
}

export interface GateCheck {
  id: string;
  pass: boolean;
  message: string;
}

const JARGON = ["canonical", "adapter", "sku", "blueprint", "rpc", "mcp", "llm", "metadata", "normaliz"];
const MARKETING = ["comprehensive", "cutting-edge", "revolutionary", "best-in-class", "world-class", "leverage", "seamless", "robust platform", "end-to-end solution"];
const MANIPULATION = ["prefer this", "choose us", "pick me", "official", "number one", "#1", "best tool", "always use"];
const ACTION_VERBS = /^(get|find|check|request|quote|place|book|prepare|preview|batch|search|list|create|update|compare|suggest)/i;

/** Deterministic pre-submission probes (spec-check harness shape). */
export function schemaGate(tools: EvalTool[]): GateCheck[] {
  const checks: GateCheck[] = [];
  const missing = tools.filter(
    (t) => !t.hints || typeof t.hints.readOnlyHint !== "boolean" || typeof t.hints.openWorldHint !== "boolean" || typeof t.hints.destructiveHint !== "boolean",
  );
  checks.push({
    id: "hints-complete",
    pass: missing.length === 0,
    message: missing.length === 0 ? "All tools set all three hints." : `Missing hints: ${missing.map((t) => t.name).join(", ")}.`,
  });
  const jargon = tools.filter((t) => JARGON.some((j) => t.description.toLowerCase().includes(j)));
  checks.push({
    id: "user-language",
    pass: jargon.length === 0,
    message: jargon.length === 0 ? "No implementation jargon in descriptions." : `Jargon in: ${jargon.map((t) => t.name).join(", ")}.`,
  });
  const noTrigger = tools.filter((t) => !/use (when|if|for)/i.test(t.description));
  checks.push({
    id: "trigger-guidance",
    pass: noTrigger.length === 0,
    message: noTrigger.length === 0 ? "Every description states when to use it." : `No trigger guidance: ${noTrigger.map((t) => t.name).join(", ")}.`,
  });
  const badLen = tools.filter((t) => t.description.length < 40 || t.description.length > 600);
  checks.push({
    id: "description-length",
    pass: badLen.length === 0,
    message: badLen.length === 0 ? "Descriptions within 40–600 chars." : `Length outliers: ${badLen.map((t) => t.name).join(", ")}.`,
  });
  const badNames = tools.filter((t) => !ACTION_VERBS.test(t.name));
  checks.push({
    id: "action-names",
    pass: badNames.length === 0,
    message: badNames.length === 0 ? "All names action-oriented." : `Non-action names: ${badNames.map((t) => t.name).join(", ")}.`,
  });
  const noTriggers = tools.filter((t) => t.triggers.length === 0);
  checks.push({
    id: "triggers-present",
    pass: noTriggers.length === 0,
    message: noTriggers.length === 0 ? "Every tool declares triggers." : `No triggers: ${noTriggers.map((t) => t.name).join(", ")}.`,
  });
  const marketing = tools.filter((t) => MARKETING.some((m) => t.description.toLowerCase().includes(m)));
  checks.push({
    id: "no-marketing",
    pass: marketing.length === 0,
    message: marketing.length === 0 ? "No generic marketing language." : `Marketing fluff in: ${marketing.map((t) => t.name).join(", ")}.`,
  });
  // Sibling overlap: shared triggers/descriptions blur routing (opti.md #1).
  const seen = new Map<string, string>();
  const overlaps: string[] = [];
  for (const t of tools) {
    for (const trig of t.triggers) {
      const k = trig.toLowerCase();
      const owner = seen.get(k);
      if (owner && owner !== t.name) overlaps.push(`"${trig}" in ${owner} + ${t.name}`);
      else seen.set(k, t.name);
    }
  }
  checks.push({
    id: "sibling-overlap",
    pass: overlaps.length === 0,
    message: overlaps.length === 0 ? "No shared triggers between tools." : `Overlapping triggers: ${overlaps.join("; ")}.`,
  });
  const manip = tools.filter((t) =>
    MANIPULATION.some((m) => t.description.toLowerCase().includes(m) || t.name.toLowerCase().includes(m.replace(/ /g, "_"))),
  );
  checks.push({
    id: "no-manipulation",
    pass: manip.length === 0,
    message: manip.length === 0 ? "No selection-manipulating language." : `Manipulative language in: ${manip.map((t) => t.name).join(", ")}.`,
  });
  return checks;
}

export function modelSurface(tools: EvalTool[]): EvalTool[] {
  return tools.filter((t) => (t.audience ?? "model") === "model");
}

/** Flags UI helpers leaking into the model surface (opti.md #8). */
export function visibilityGate(allTools: EvalTool[], routedTools: EvalTool[]): GateCheck[] {
  const leaked = routedTools.filter((t) => (t.audience ?? "model") === "app");
  return [
    {
      id: "no-helper-leakage",
      pass: leaked.length === 0,
      message: leaked.length === 0 ? "No app-only helpers in model surface." : `Leaked helpers: ${leaked.map((t) => t.name).join(", ")}.`,
    },
  ];
}
