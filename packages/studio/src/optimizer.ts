// Studio optimizer: rank N metadata variants + record selection events.
// Events feed the three proprietary datasets: prompt→tool-selected,
// definition-variant→selection-rate, host/version→compatibility-outcome.
import { compareVariants } from "@agentcom/evals";
import type { EvalCase, EvalTool, EvalOptions, ToolSelector } from "@agentcom/evals";

export interface VariantScore {
  label: string;
  f1: number;
  recall: number;
  falsePositiveRate: number;
}

/** Rank variants best-first. Index 0 ties go to the earlier variant. */
export function rankVariants(
  cases: EvalCase[],
  variants: { label: string; tools: EvalTool[] }[],
  selector: ToolSelector,
  opts?: EvalOptions,
): (VariantScore & { winner: boolean })[] {
  const base = variants[0];
  if (!base) return [];
  const scored = variants.map((v) => {
    const r = compareVariants(cases, base.tools, v.tools, selector, opts);
    const report = v.label === base.label ? r.base : r.variant;
    return { label: v.label, f1: report.f1, recall: report.recall, falsePositiveRate: report.falsePositiveRate };
  });
  scored.sort((a, b) => b.f1 - a.f1);
  return scored.map((s, i) => ({ ...s, winner: i === 0 }));
}

export interface SelectionEvent {
  type: "tool-selected";
  prompt: string;
  predicted: string | null;
  expected: string | null;
  toolVersion: string;
  host: string;
  at: string;
}

export function logSelectionEvent(args: {
  prompt: string;
  predicted: string | null;
  expected: string | null;
  toolVersion: string;
  host?: string;
  at?: string;
}): SelectionEvent {
  return {
    type: "tool-selected",
    prompt: args.prompt,
    predicted: args.predicted,
    expected: args.expected,
    toolVersion: args.toolVersion,
    host: args.host ?? "unknown",
    at: args.at ?? new Date().toISOString(),
  };
}

/**
 * surface_attempt: the unified observation family. Selection applies to
 * model surfaces; WebMCP/HTTP leave it absent; x402 adds payment. One
 * family feeds finalbuilds2 attribution.
 */
export interface SurfaceAttempt {
  event: "surface_attempt";
  capability: string;
  surface: string;
  surface_version: string;
  variant?: string;
  host: string;
  model?: string;
  intent_id?: string;
  selection?: { expected: string | null; actual: string | null };
  execution?: { success: boolean; duration_ms: number; truth_status?: string; failure_code?: string };
  completion?: { success: boolean };
  payment?: { attempted: boolean; success?: boolean; price?: number; receipt?: string };
  at: string;
}

export function logSurfaceAttempt(args: {
  capability: string;
  surface: string;
  surface_version: string;
  variant?: string;
  host?: string;
  model?: string;
  intent_id?: string;
  selection?: { expected: string | null; actual: string | null };
  execution?: { success: boolean; duration_ms: number; truth_status?: string; failure_code?: string };
  completion?: { success: boolean };
  payment?: { attempted: boolean; success?: boolean; price?: number; receipt?: string };
  at?: string;
}): SurfaceAttempt {
  return {
    event: "surface_attempt",
    capability: args.capability,
    surface: args.surface,
    surface_version: args.surface_version,
    variant: args.variant,
    host: args.host ?? "unknown",
    model: args.model,
    intent_id: args.intent_id,
    selection: args.selection,
    execution: args.execution,
    completion: args.completion,
    payment: args.payment,
    at: args.at ?? new Date().toISOString(),
  };
}
