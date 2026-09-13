// Studio publisher: preflight verdict from packet statics + deployment flags.
// Mirrors the kit linter's static subset in TS for fast CI; the Python lint
// remains the canonical gate (npm run preflight:domains).
//
// SurfaceRules parameterizes the rulebook per surface (ChatGPT today; WebMCP,
// x402, Website tomorrow) instead of forking publisher code.

export interface SurfaceRules {
  surface: string;
  nameMax: number;
  subtitleMax: number;
  descriptionMax: number;
  capabilitiesMax: number;
  capabilityMax: number;
  startersMax: number;
  starterMax: number;
  positivesRequired: number;
  negativesRequired: number;
  digitalCommerceBanned: boolean;
}

export const CHATGPT_RULES: SurfaceRules = {
  surface: "chatgpt",
  nameMax: 30,
  subtitleMax: 30,
  descriptionMax: 4000,
  capabilitiesMax: 20,
  capabilityMax: 120,
  startersMax: 3,
  starterMax: 128,
  positivesRequired: 5,
  negativesRequired: 3,
  digitalCommerceBanned: true,
};
export interface PacketLike {
  app: {
    name: string;
    subtitle: string;
    description: string;
    commerce?: string;
    capabilities?: string[];
    starter_prompts?: string[];
  };
  tests: { positive: unknown[]; negative: unknown[] };
}

export interface SubmissionFlags {
  verifiedIdentity: boolean;
  publicProduction: boolean;
  domainVerified: boolean;
  scanCurrent: boolean;
  privacyComplete: boolean;
  demoUrlLive: boolean;
}

export interface PreflightResult {
  verdict: "GO" | "NO_GO";
  blockers: string[];
  warnings: string[];
}

export function preflight(packet: PacketLike, flags: SubmissionFlags, rules: SurfaceRules = CHATGPT_RULES): PreflightResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const app = packet.app;
  if (!app.name || app.name.length > rules.nameMax) blockers.push(`Display name missing or over ${rules.nameMax} chars.`);
  if (!app.subtitle || app.subtitle.length > rules.subtitleMax) blockers.push(`Subtitle missing or over ${rules.subtitleMax} chars.`);
  if (!app.description || app.description.length > rules.descriptionMax) blockers.push(`Description missing or over ${rules.descriptionMax} chars.`);
  if ((app.capabilities ?? []).length > rules.capabilitiesMax) blockers.push(`More than ${rules.capabilitiesMax} capabilities.`);
  if ((app.capabilities ?? []).some((c) => c.length > rules.capabilityMax)) blockers.push(`Capability over ${rules.capabilityMax} chars.`);
  const starters = app.starter_prompts ?? [];
  if (starters.length > rules.startersMax) blockers.push(`More than ${rules.startersMax} starter prompts.`);
  if (starters.some((s) => s.length > rules.starterMax || s.includes("@"))) blockers.push(`Starter prompt over ${rules.starterMax} chars or contains @mention.`);
  if (packet.tests.positive.length !== rules.positivesRequired) blockers.push(`Need exactly ${rules.positivesRequired} positive tests (have ${packet.tests.positive.length}).`);
  if (packet.tests.negative.length !== rules.negativesRequired) blockers.push(`Need exactly ${rules.negativesRequired} negative tests (have ${packet.tests.negative.length}).`);
  if (rules.digitalCommerceBanned && app.commerce === "digital_goods_or_services") blockers.push("Digital-goods commerce is banned in plugins.");
  if (!flags.verifiedIdentity) blockers.push("Publisher identity not verified.");
  if (!flags.publicProduction) blockers.push("MCP not on a public production endpoint.");
  if (!flags.domainVerified) blockers.push("Domain verification incomplete.");
  if (!flags.scanCurrent) blockers.push("MCP tool scan not current.");
  if (!flags.privacyComplete) blockers.push("Privacy policy coverage incomplete.");
  if (!flags.demoUrlLive) warnings.push("Demo recording URL not confirmed live.");
  return { verdict: blockers.length === 0 ? "GO" : "NO_GO", blockers, warnings };
}

export const ALL_FALSE_FLAGS: SubmissionFlags = {
  verifiedIdentity: false,
  publicProduction: false,
  domainVerified: false,
  scanCurrent: false,
  privacyComplete: false,
  demoUrlLive: false,
};

export interface ProbeCheck {
  id: string;
  pass: boolean;
  detail: string;
}

export interface DeploymentProbe {
  baseUrl: string;
  latencyMs: number | null;
  checks: ProbeCheck[];
}

async function timedFetch(url: string, opts: Record<string, unknown>, timeoutMs: number): Promise<{ status: number; text: string; ms: number }> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await (globalThis.fetch as typeof fetch)(url, { ...(opts as object), signal: ctrl.signal } as never);
    return { status: res.status, text: await res.text(), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Machine-checkable deployment probes. Never throws: unreachable hosts yield
 * failing checks. Portal/human state (identity, scan, review) stays in flags.
 */
export async function probeDeployment(
  baseUrl: string,
  opts?: { frozenToolNames?: string[]; timeoutMs?: number },
): Promise<DeploymentProbe> {
  const base = baseUrl.replace(/\/$/, "");
  const timeoutMs = opts?.timeoutMs ?? 8000;
  const checks: ProbeCheck[] = [];
  let latencyMs: number | null = null;
  try {
    const root = await timedFetch(`${base}/`, {}, timeoutMs);
    checks.push({ id: "endpoint-reachable", pass: root.status === 200, detail: `GET / → ${root.status}` });
  } catch {
    checks.push({ id: "endpoint-reachable", pass: false, detail: "unreachable" });
    return { baseUrl: base, latencyMs, checks };
  }
  try {
    const init = await timedFetch(`${base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "probe", version: "0" } } }),
    }, timeoutMs);
    latencyMs = init.ms;
    const okInit = init.status === 200 && init.text.includes("serverInfo");
    checks.push({ id: "mcp-handshake", pass: okInit, detail: `POST /mcp initialize → ${init.status}` });
  } catch {
    checks.push({ id: "mcp-handshake", pass: false, detail: "handshake failed" });
  }
  if (opts?.frozenToolNames) {
    try {
      const list = await timedFetch(`${base}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      }, timeoutMs);
      const names = [...list.text.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
      const missing = opts.frozenToolNames.filter((n) => !names.includes(n));
      checks.push({ id: "tools-match-frozen", pass: missing.length === 0, detail: missing.length === 0 ? `${names.length} tools listed` : `missing: ${missing.join(",")}` });
    } catch {
      checks.push({ id: "tools-match-frozen", pass: false, detail: "tools/list failed" });
    }
  }
  try {
    const chal = await timedFetch(`${base}/.well-known/openai-apps-challenge`, {}, timeoutMs);
    checks.push({ id: "challenge-route", pass: chal.status === 200 || chal.status === 404, detail: `challenge → ${chal.status}` });
  } catch {
    checks.push({ id: "challenge-route", pass: false, detail: "challenge route failed" });
  }
  return { baseUrl: base, latencyMs, checks };
}
