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
} from "@print/evals";

export interface CapabilityReport {
  metrics: EvalReport;
  gates: GateCheck[];
  pass: boolean;
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
