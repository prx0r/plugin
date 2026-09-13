// Optimizer framework — cases. Hill-climb loop needs should/shouldn't pairs
// per vertical (strat.md). Format mirrors MCPJam's contract loosely:
// expected tool call + null for must-not-trigger. Selector-agnostic.
export interface EvalTool {
  name: string;
  description: string;
  /** User-language trigger phrases. The SEO surface. */
  triggers: string[];
  hints: { readOnlyHint: boolean; openWorldHint: boolean; destructiveHint: boolean } | null;
  /**
   * Routing audience. 'model' tools are semantic business operations the
   * model may call; 'app' tools are UI helpers that must stay hidden from
   * model context wherever the host allows (opti.md #8).
   */
  audience?: "model" | "app";
}

export interface EvalCase {
  id: string;
  vertical: "domains" | "print" | "trades";
  utterance: string;
  /** Expected tool, or null when nothing must trigger. */
  expectTool: string | null;
}

export const SEED_CASES: EvalCase[] = [
  // Domains
  { id: "dom-pos-1", vertical: "domains", utterance: "Is pogtown.com available?", expectTool: "check_exact_domain" },
  { id: "dom-pos-2", vertical: "domains", utterance: "Check these three domains: acme.com, acme.io, acme.dev", expectTool: "batch_check_domains" },
  { id: "dom-pos-3", vertical: "domains", utterance: "Suggest a domain name for my plumbing business", expectTool: "find_available_domains" },
  { id: "dom-pos-4", vertical: "domains", utterance: "I like Pogtown. Give me ten strong available .com alternatives", expectTool: "find_available_domains" },
  { id: "dom-pos-5", vertical: "domains", utterance: "Find me a .com available for an AI accounting startup", expectTool: "find_available_domains" },
  { id: "dom-pos-6", vertical: "domains", utterance: "Check whether agentcom.org is registered", expectTool: "check_exact_domain" },
  { id: "dom-pos-7", vertical: "domains", utterance: "Give me ten available names under 12 characters", expectTool: "find_available_domains" },
  { id: "dom-neg-1", vertical: "domains", utterance: "Why are .com domains so valuable?", expectTool: null },
  { id: "dom-neg-2", vertical: "domains", utterance: "What is DNS and how does it work?", expectTool: null },
  { id: "dom-neg-3", vertical: "domains", utterance: "What is RDAP?", expectTool: null },
  // Print
  { id: "prt-pos-1", vertical: "print", utterance: "Put this image on a hoodie and order one", expectTool: "quote_personalized_product" },
  { id: "prt-pos-2", vertical: "print", utterance: "Put Buster on a mug", expectTool: "find_printable_products" },
  { id: "prt-pos-3", vertical: "print", utterance: "Is this design big enough to print on a poster?", expectTool: "prepare_print_design" },
  { id: "prt-neg-1", vertical: "print", utterance: "What is DTG printing?", expectTool: null },
  { id: "prt-neg-2", vertical: "print", utterance: "Who invented screen printing?", expectTool: null },
  // Trades
  { id: "trd-pos-1", vertical: "trades", utterance: "My boiler won't ignite and I need someone tomorrow", expectTool: "find_local_services" },
  { id: "trd-pos-2", vertical: "trades", utterance: "Find a plumber in Nottingham", expectTool: "find_local_services" },
  { id: "trd-pos-3", vertical: "trades", utterance: "Get quotes for fixing my boiler", expectTool: "request_service_quotes" },
  { id: "trd-neg-1", vertical: "trades", utterance: "How does a combi boiler work?", expectTool: null },
  { id: "trd-neg-2", vertical: "trades", utterance: "What temperature should my thermostat be?", expectTool: null },
];

/** Good user-language tool defs. The bar variants must beat. */
export const SEED_TOOLS: EvalTool[] = [
  {
    name: "check_exact_domain",
    description: "Check whether an exact domain name is available to register. Use when the user asks if a specific domain is taken, free, or available.",
    triggers: ["domain available", "available?", "taken", "free", "register", "check domain", "is available", "is taken", "registered"],
    hints: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
  },
  {
    name: "batch_check_domains",
    description: "Check availability for several exact domain names at once. Use when the user lists multiple domains to compare.",
    triggers: ["these domains", "check these", "several domains", "compare domains", "bulk"],
    hints: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
  },
  {
    name: "find_available_domains",
    description: "Suggest available domain names for a business, brand or idea. Use when the user wants domain ideas rather than checking one exact name.",
    triggers: ["suggest a domain", "domain ideas", "domain name for", "find a domain", "brand domain", "available"],
    hints: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
  },
  {
    name: "find_printable_products",
    description: "Find suitable physical products for printing a design or photo. Use when the user wants to put artwork onto a shirt, mug, poster or gift.",
    triggers: ["put", "on a mug", "on a shirt", "printed", "personalize", "custom"],
    hints: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
  },
  {
    name: "quote_personalized_product",
    description: "Compare manufacturing prices across print providers. Use when the user wants the price, cheapest option, or where a custom item should be produced.",
    triggers: ["order one", "how much", "cheapest", "price", "cost", "hoodie"],
    hints: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
  },
  {
    name: "prepare_print_design",
    description: "Validate artwork size and quality for a print area. Use when the user asks whether a design is big or sharp enough to print.",
    triggers: ["big enough", "sharp enough", "resolution", "print quality", "artwork", "design"],
    hints: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  },
  {
    name: "find_local_services",
    description: "Find local plumbers, electricians, heating engineers and other tradespeople. Use when the user needs someone to repair, install, inspect or service something at their home.",
    triggers: ["plumber", "heating engineer", "electrician", "tradesperson", "need someone", "won't ignite"],
    hints: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
  },
  {
    name: "request_service_quotes",
    description: "Request comparable quotes from tradespeople for a defined job. Use when the user wants prices or availability from several providers.",
    triggers: ["quotes", "get quotes", "compare quotes", "how much would", "availability"],
    hints: { readOnlyHint: false, openWorldHint: true, destructiveHint: false },
  },
];
