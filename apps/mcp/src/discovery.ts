// Machine-readable discovery surface (opti.md #5).
// MCP Apps are invisible to ordinary web discovery, so every capability ships
// crawler/agent-readable metadata: well-known manifest, llms.txt, JSON-LD.
// Cheap now, standard-shaped later.
export const MANIFEST_VERSION = "agentcom-manifest-v1";

export interface CapabilityEntry {
  id: string;
  title: string;
  subtitle: string;
  /** Public capability page (indexable SEO surface, per publish.md). */
  page: string;
  tools: string[];
  ui: boolean;
  auth: "none" | "oauth" | "api_key";
}

export const CAPABILITIES: CapabilityEntry[] = [
  {
    id: "domains.check",
    title: "Domain Availability",
    subtitle: "Check exact domain availability and find available names.",
    page: "/domain-availability",
    tools: ["check_exact_domain", "batch_check_domains", "find_available_domains"],
    ui: false,
    auth: "none",
  },
  {
    id: "print.quote",
    title: "Custom Print",
    subtitle: "Compare printing options and prices for personalized products.",
    page: "/tools/custom-print",
    tools: [
      "find_printable_products",
      "quote_personalized_product",
      "prepare_print_design",
      "preview_personalized_product",
      "place_print_order",
      "get_print_order",
    ],
    ui: true,
    auth: "none",
  },
];

export function buildManifest(host: string): Record<string, unknown> {
  const base = host.replace(/\/$/, "");
  return {
    manifest: MANIFEST_VERSION,
    name: "AgentCom",
    mcp: `${base}/mcp`,
    llms_txt: `${base}/llms.txt`,
    capabilities: CAPABILITIES.map((c) => ({ ...c, mcp: `${base}/mcp` })),
  };
}

export const LLMS_TXT = `# AgentCom — real-world markets callable by AI agents

MCP endpoint: /mcp (Streamable HTTP). Manifest: /.well-known/agentcom.json

## Capabilities
- Domain Checker (no auth): check_exact_domain, batch_check_domains,
  find_available_domains. Live RDAP availability + deterministic suggestions.
- Custom Print (no auth until ordering): find_printable_products,
  quote_personalized_product, prepare_print_design, preview_personalized_product,
  place_print_order (explicit confirmation + idempotency required),
  get_print_order. Neutral multi-supplier routing (Prodigi, Printful).

## Rules for agents
- Quote before preparing artwork or placing orders.
- Never place an order or booking without explicit user confirmation.
- Re-quote when a quote expires; never reuse prices across sessions.
`;

/** JSON-LD snippet for future website embedding (schema.org + proposed MCPApp). */
export function buildJsonLd(host: string): Record<string, unknown> {
  const base = host.replace(/\/$/, "");
  return {
    "@context": ["https://schema.org"],
    "@type": "SoftwareApplication",
    name: "AgentCom",
    applicationCategory: "DeveloperApplication",
    offers: { "@type": "Offer", price: "0" },
    additionalProperty: [
      { "@type": "PropertyValue", name: "MCPApp", value: `${base}/mcp` },
      { "@type": "PropertyValue", name: "mcpEndpoint", value: `${base}/mcp` },
      { "@type": "PropertyValue", name: "manifest", value: `${base}/.well-known/agentcom.json` },
    ],
  };
}
