// Phase 11 evals — synthetic intent suite (sample shown, target 100).
// Each entry: utterance → expected tool + constraints.
// Optimizer framework (selector bench + hill-climb) lives in sibling modules.
export * from "./cases.ts";
export * from "./selector.ts";
export * from "./score.ts";
export * from "./hillclimb.ts";
export interface EvalIntent {
  utterance: string;
  expectTool: string;
  productType?: string;
  intent?: "CHEAPEST" | "BALANCED" | "BEST_QUALITY" | "FASTEST";
  deadline?: boolean;
}

export const EVAL_INTENTS: EvalIntent[] = [
  { utterance: "Put my dog's picture on a decent cream T-shirt.", expectTool: "find_printable_products", productType: "tshirt" },
  { utterance: "Cheapest mug delivered to Birmingham.", expectTool: "quote_personalized_product", productType: "mug", intent: "CHEAPEST" },
  { utterance: "High quality framed print for Mum, budget £35.", expectTool: "quote_personalized_product", productType: "framed_print", intent: "BEST_QUALITY" },
  { utterance: "I need this shirt before Friday.", expectTool: "quote_personalized_product", productType: "tshirt", deadline: true },
  { utterance: "Can this image work on a hoodie?", expectTool: "prepare_print_design", productType: "hoodie" },
  { utterance: "Make this a birthday card.", expectTool: "find_printable_products", productType: "greeting_card" },
  { utterance: "I don't care what supplier, just get the nicest option.", expectTool: "quote_personalized_product", intent: "BEST_QUALITY" },
  { utterance: "I want the cheapest thing that doesn't feel cheap.", expectTool: "quote_personalized_product", intent: "CHEAPEST" },
];

export function evalSummary(): { count: number; tools: Record<string, number> } {
  const tools: Record<string, number> = {};
  for (const e of EVAL_INTENTS) tools[e.expectTool] = (tools[e.expectTool] ?? 0) + 1;
  return { count: EVAL_INTENTS.length, tools };
}
