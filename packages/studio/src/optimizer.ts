// Studio optimizer: rank N metadata variants + record selection events.
// Events feed the three proprietary datasets: prompt→tool-selected,
// definition-variant→selection-rate, host/version→compatibility-outcome.
import { compareVariants } from "@print/evals";
import type { EvalCase, EvalTool, ToolSelector } from "@print/evals";

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
): (VariantScore & { winner: boolean })[] {
  const base = variants[0];
  if (!base) return [];
  const scored = variants.map((v) => {
    const r = compareVariants(cases, base.tools, v.tools, selector);
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
