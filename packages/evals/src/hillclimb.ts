// Hill-climb: compare two metadata variants on the same cases + selector.
// Ship the winner only on positive F1 delta. Deterministic.
import type { EvalCase, EvalTool } from "./cases.ts";
import { runEvalSet, type EvalReport } from "./score.ts";
import type { ToolSelector } from "./selector.ts";

export interface ClimbResult {
  baseF1: number;
  variantF1: number;
  delta: number;
  winner: "base" | "variant" | "tie";
  base: EvalReport;
  variant: EvalReport;
}

export function compareVariants(
  cases: EvalCase[],
  base: EvalTool[],
  variant: EvalTool[],
  selector: ToolSelector,
): ClimbResult {
  const b = runEvalSet(cases, base, selector);
  const v = runEvalSet(cases, variant, selector);
  const delta = v.f1 - b.f1;
  return {
    baseF1: b.f1,
    variantF1: v.f1,
    delta,
    winner: delta > 0 ? "variant" : delta < 0 ? "base" : "tie",
    base: b,
    variant: v,
  };
}
