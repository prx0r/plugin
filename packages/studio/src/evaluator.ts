// Studio evaluator: one report for routing quality + submission gates.
// Runs the model surface only (app-audience helpers excluded by construction).
import {
  modelSurface,
  runEvalSet,
  schemaGate,
  visibilityGate,
  type EvalCase,
  type EvalReport,
  type EvalTool,
  type GateCheck,
  type ToolSelector,
} from "@agentcom/evals";

export interface CapabilityReport {
  metrics: EvalReport;
  gates: GateCheck[];
  pass: boolean;
}

/** Eval tiers. Tier-0 is CI; Tier-1+ need models/hosts and never mix into Tier-0 metrics. */
export const TIERS = {
  tier0: "deterministic lint/proxy (keyword + similarity selectors, schema gates)",
  tier1: "actual model tool selection via tool interface (requires model access)",
  tier2: "host-integrated ChatGPT behavior (developer mode / published app)",
  tier3: "production use",
} as const;

export type ModelJudge = (
  prompt: string,
  tools: EvalTool[],
) => Promise<{ tool: string | null; args: Record<string, unknown> }>;

export interface Tier1Record {
  prompt: string;
  expected_tool: string | null;
  selected_tool: string | null;
  arguments: Record<string, unknown>;
  model: string;
  model_snapshot: string;
  timestamp: string;
  tool_variant: string;
}

export interface Tier1Summary {
  records: Tier1Record[];
  precision: number;
  recall: number;
  f1: number;
  abstentionAccuracy: number;
  argumentAccuracy: number;
}

/**
 * Tier-1 model runner. The judge is injected so tests use fakes and
 * production plugs real model calls (needs model credentials at call time,
 * never stored here). Output records are immutable benchmark rows.
 */
export async function runTier1(
  cases: EvalCase[],
  tools: EvalTool[],
  judge: ModelJudge,
  opts: { model: string; toolVariant?: string },
): Promise<Tier1Summary> {
  const records: Tier1Record[] = [];
  for (const c of cases) {
    const { tool, args } = await judge(c.utterance, tools);
    records.push({
      prompt: c.utterance,
      expected_tool: c.expectTool,
      selected_tool: tool,
      arguments: args,
      model: opts.model,
      model_snapshot: opts.model,
      timestamp: new Date().toISOString(),
      tool_variant: opts.toolVariant ?? "live",
    });
  }
  const positives = records.filter((r) => r.expected_tool != null);
  const negatives = records.filter((r) => r.expected_tool == null);
  const tp = records.filter((r) => r.expected_tool != null && r.selected_tool === r.expected_tool).length;
  const fp = records.filter((r) => r.selected_tool != null && r.selected_tool !== r.expected_tool).length;
  const abstentions = negatives.filter((r) => r.selected_tool == null).length;
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = positives.length === 0 ? 1 : tp / positives.length;
  return {
    records,
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
    abstentionAccuracy: negatives.length === 0 ? 1 : abstentions / negatives.length,
    argumentAccuracy: 1, // argument-level scoring plugs in per-case validators next
  };
}

export function evaluateCapability(
  tools: EvalTool[],
  cases: EvalCase[],
  selector: ToolSelector,
): CapabilityReport {
  const surface = modelSurface(tools);
  const metrics = runEvalSet(cases, surface, selector);
  const gates = [...schemaGate(surface), ...visibilityGate(tools, surface)];
  return { metrics, gates, pass: metrics.f1 === 1 && gates.every((g) => g.pass) };
}
