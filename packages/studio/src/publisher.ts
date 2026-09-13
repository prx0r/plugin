// Studio publisher: preflight verdict from packet statics + deployment flags.
// Mirrors the kit linter's static subset in TS for fast CI; the Python lint
// remains the canonical gate (npm run preflight:domains).
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

export function preflight(packet: PacketLike, flags: SubmissionFlags): PreflightResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const app = packet.app;
  if (!app.name || app.name.length > 30) blockers.push("Display name missing or over 30 chars.");
  if (!app.subtitle || app.subtitle.length > 30) blockers.push("Subtitle missing or over 30 chars.");
  if (!app.description || app.description.length > 4000) blockers.push("Description missing or over 4000 chars.");
  if ((app.capabilities ?? []).length > 20) blockers.push("More than 20 capabilities.");
  if ((app.capabilities ?? []).some((c) => c.length > 120)) blockers.push("Capability over 120 chars.");
  const starters = app.starter_prompts ?? [];
  if (starters.length > 3) blockers.push("More than 3 starter prompts.");
  if (starters.some((s) => s.length > 128 || s.includes("@"))) blockers.push("Starter prompt over 128 chars or contains @mention.");
  if (packet.tests.positive.length !== 5) blockers.push(`Need exactly 5 positive tests (have ${packet.tests.positive.length}).`);
  if (packet.tests.negative.length !== 3) blockers.push(`Need exactly 3 negative tests (have ${packet.tests.negative.length}).`);
  if (app.commerce === "digital_goods_or_services") blockers.push("Digital-goods commerce is banned in plugins.");
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
