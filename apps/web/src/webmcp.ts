// WebMCP starter — apps/web. Feature-detected browser registration for the
// same capabilities our MCP server exposes. Experiment lane (origin trial,
// ~no agent traffic yet): keep thin, guarded, and metadata-compatible.
// See docs/webmcp.md.
export interface WebMcpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, boolean>;
}

type ModelContext = {
  registerTool?: (tool: Record<string, unknown>, opts?: Record<string, unknown>) => unknown;
};

/** Feature-detect both the current and draft attachment points. Never throws. */
export function detectModelContext(host?: unknown): ModelContext | null {
  try {
    const h = (host ?? (globalThis as Record<string, unknown>)["document"] ?? {}) as Record<string, unknown>;
    const doc = (h as { modelContext?: ModelContext }).modelContext;
    if (doc?.registerTool) return doc;
    const nav = (globalThis as Record<string, unknown>)["navigator"] as Record<string, unknown> | undefined;
    const legacy = nav?.["modelContext"] as ModelContext | undefined;
    if (legacy?.registerTool) return legacy;
    return null;
  } catch {
    return null;
  }
}

/** Domain availability tool def. Mirrors check_exact_domain triggers. */
export function domainCheckToolDef(): WebMcpToolDef {
  return {
    name: "check_domain_availability",
    description:
      "Check the current registration record for an exact domain name via public RDAP data. Use when the user asks if a specific domain is taken, free, or available. A no-record result is not a purchase guarantee.",
    inputSchema: {
      type: "object",
      properties: { domain: { type: "string", description: "Exact domain, e.g. example.com" } },
      required: ["domain"],
    },
    annotations: { readOnlyHint: true },
  };
}

/**
 * Recovery-guidance error formatter. Errors must guide the agent to the next
 * valid action, never dead-end (Chrome build-tools rule).
 */
export function recoveryError(reason: string, nextStep: string): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: `${reason} ${nextStep}`.trim() }] };
}

/**
 * Declarative form snippet: the same check as plain HTML so agents without
 * JS tooling can act on the capability page. Mirrors domainCheckToolDef.
 */
export function declarativeFormSnippet(action = "/v1/domains/check"): string {
  return [
    `<form action="${action}" method="post" toolname="check_domain_availability"`,
    `  tooldescription="Check whether an exact domain name is available to register.">`,
    `  <input type="text" name="domain" required placeholder="example.com" />`,
    `  <button type="submit">Check availability</button>`,
    `</form>`,
  ].join("\n");
}

/** No-op outside supporting browsers. Returns registered count. */export function registerAgentComTools(
  execute: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  host?: unknown,
): number {
  const mc = detectModelContext(host);
  if (!mc?.registerTool) return 0;
  const def = domainCheckToolDef();
  mc.registerTool(
    {
      name: def.name,
      description: def.description,
      inputSchema: def.inputSchema,
      annotations: def.annotations,
      execute: (args: unknown) => execute(def.name, (args ?? {}) as Record<string, unknown>),
    },
    {},
  );
  return 1;
}
