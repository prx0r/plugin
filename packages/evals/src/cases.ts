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
  /**
   * Stable logical capability across metadata experiments (e.g.
   * "domains.check_exact"). The exposed `name` varies per variant;
   * evaluation always compares on logical identity.
   */
  logical?: string;
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
  { id: "dom-pos-8", vertical: "domains", utterance: "Check if google.cloud is taken", expectTool: "check_exact_domain" },
  { id: "dom-pos-9", vertical: "domains", utterance: "Which of these are free: foo.io, bar.dev, baz.com?", expectTool: "batch_check_domains" },
  { id: "dom-pos-10", vertical: "domains", utterance: "Give me five available .ai names for a machine learning startup", expectTool: "find_available_domains" },
  { id: "dom-pos-11", vertical: "domains", utterance: "Find me a .co.uk domain for a bakery", expectTool: "find_available_domains" },
  { id: "dom-pos-12", vertical: "domains", utterance: "Is openai.com registered?", expectTool: "check_exact_domain" },
  { id: "dom-neg-1", vertical: "domains", utterance: "Why are .com domains so valuable?", expectTool: null },
  { id: "dom-neg-2", vertical: "domains", utterance: "What is DNS and how does it work?", expectTool: null },
  { id: "dom-neg-3", vertical: "domains", utterance: "What is RDAP?", expectTool: null },
  { id: "dom-neg-4", vertical: "domains", utterance: "How does DNS resolution work?", expectTool: null },
  { id: "dom-neg-5", vertical: "domains", utterance: "Why should startups buy .ai instead of .com?", expectTool: null },
  { id: "dom-neg-6", vertical: "domains", utterance: "Is the trademark for Nike available?", expectTool: null },
  { id: "dom-neg-7", vertical: "domains", utterance: "Who owns facebook.com?", expectTool: null },
  { id: "dom-neg-8", vertical: "domains", utterance: "Is @openai available on Twitter?", expectTool: null },
  { id: "dom-neg-9", vertical: "domains", utterance: "How much did google.com sell for originally?", expectTool: null },
  // Print
  { id: "prt-pos-1", vertical: "print", utterance: "Put this image on a hoodie and order one", expectTool: "quote_personalized_product" },
  { id: "prt-pos-2", vertical: "print", utterance: "Put Buster on a mug", expectTool: "find_printable_products" },
  { id: "prt-pos-3", vertical: "print", utterance: "Is this design big enough to print on a poster?", expectTool: "prepare_print_design" },
  { id: "prt-neg-1", vertical: "print", utterance: "What is DTG printing?", expectTool: null },
  { id: "prt-neg-2", vertical: "print", utterance: "Who invented screen printing?", expectTool: null },
  { id: "prt-neg-3", vertical: "print", utterance: "What does DTG stand for?", expectTool: null },
  { id: "prt-neg-4", vertical: "print", utterance: "How much does a screen printing machine cost?", expectTool: null },
  { id: "prt-neg-5", vertical: "print", utterance: "Is sublimation better than DTG?", expectTool: null },
  // Trades
  { id: "trd-pos-1", vertical: "trades", utterance: "My boiler won't ignite and I need someone tomorrow", expectTool: "find_local_services" },
  { id: "trd-pos-2", vertical: "trades", utterance: "Find a plumber in Nottingham", expectTool: "find_local_services" },
  { id: "trd-pos-3", vertical: "trades", utterance: "Get quotes for fixing my boiler", expectTool: "request_service_quotes" },
  { id: "trd-neg-1", vertical: "trades", utterance: "How does a combi boiler work?", expectTool: null },
  { id: "trd-neg-2", vertical: "trades", utterance: "What temperature should my thermostat be?", expectTool: null },
  { id: "trd-neg-3", vertical: "trades", utterance: "How does a gas valve work?", expectTool: null },
  { id: "trd-neg-4", vertical: "trades", utterance: "Should I get an annual boiler service?", expectTool: null },
  { id: "trd-neg-5", vertical: "trades", utterance: "What qualifications does a heating engineer need?", expectTool: null },
  { id: "trd-pos-4", vertical: "trades", utterance: "I need an electrician urgently in London", expectTool: "find_local_services" },
  { id: "trd-pos-5", vertical: "trades", utterance: "Get me three quotes for a bathroom renovation", expectTool: "request_service_quotes" },
];

/** Ambiguous intents: review-only, never gating. A proxy must not guess these. */
export interface AmbiguousCase {
  id: string;
  vertical: "domains" | "print" | "trades";
  utterance: string;
  note: string;
}

export const AMBIGUOUS_CASES: AmbiguousCase[] = [
  { id: "amb-dom-1", vertical: "domains", utterance: "What about foo.com?", note: "No verb: availability, price, or owner lookup?" },
  { id: "amb-dom-2", vertical: "domains", utterance: "Check Foo.", note: "No TLD, no task: clarify before routing." },
  { id: "amb-dom-3", vertical: "domains", utterance: "Can I use Foo?", note: "Trademark/use question, not availability." },
  { id: "amb-dom-4", vertical: "domains", utterance: "Is Foo free?", note: "Free as in available vs free as in price?" },
  { id: "amb-print-1", vertical: "print", utterance: "Can you make me something custom?", note: "Custom what? Product, image, or gift?" },
  { id: "amb-print-2", vertical: "print", utterance: "I want to sell prints online.", note: "Selling, not buying — commerce intent?" },
  { id: "amb-print-3", vertical: "print", utterance: "How much would a poster cost?", note: "Generic pricing question, no artwork specified." },
  { id: "amb-trades-1", vertical: "trades", utterance: "My house needs work.", note: "Too vague — what kind of work?" },
  { id: "amb-trades-2", vertical: "trades", utterance: "Someone should fix this.", note: "No service specified, no location." },
];

/** Good user-language tool defs. The bar variants must beat. */
export const SEED_TOOLS: EvalTool[] = [
  {
    name: "check_exact_domain",
    description: "Check the current registration record for an exact domain name via public RDAP data. Use when the user asks if a specific domain is taken, free, or available. A no-record result is not a purchase guarantee.",
    triggers: ["domain available", "available?", "taken", "free", "register", "check domain", "is available", "is taken", "registered"],
    hints: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
  },
  {
    name: "batch_check_domains",
    description: "Check current registration records for up to 20 exact domain names at once. Use when the user lists several domains to compare.",
    triggers: ["these domains", "check these", "several domains", "compare domains", "bulk"],
    hints: { readOnlyHint: true, openWorldHint: true, destructiveHint: false },
  },
  {
    name: "find_available_domains",
    description: "Suggest domain names with no current registration record, for a business, brand or idea. Use when the user wants domain ideas rather than checking one exact name. Suggestions are RDAP-checked, not purchase-guaranteed.",
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
