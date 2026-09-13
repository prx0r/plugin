// Domains vertical — operating runtime (actualguide.md).
// Factory-wide invariant: a studio may change presentation, but never upgrade
// the epistemic strength of the underlying fact. Unknown is not available.
import type { MarketProvider, Offer, ProviderCapability } from "@agentcom/core";
import { domainToASCII } from "node:url";

/** Explicit epistemic states. Collapsing these is a correctness bug. */
export type Availability = "available" | "registered" | "unknown" | "conflicting" | "unsupported";

export type AvailabilitySource = "rdap" | "registrar";

export interface SourceResult {
  type: AvailabilitySource;
  provider: string;
  status: Availability;
  at: string;
}

export interface DomainAvailabilityResult {
  domain: string;
  status: Availability;
  confidence: "high" | "medium" | "low";
  sources: SourceResult[];
}

export interface DomainAvailabilityProvider {
  readonly id: string;
  checkSource(ascii: string): Promise<SourceResult>;
}

export type DomainCheck = {
  input: string;
  ascii: string | null; // punycode-normalized, null when invalid
  valid: boolean;
  invalidReason?: string;
  status: Availability;
  confidence: "high" | "medium" | "low";
  sources: SourceResult[];
  /** Single freshness timestamp (meaningful as-of, not debug). */
  checked_at: string;
  message: string;
};

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;

function toAscii(raw: string): string | null {
  try {
    const out = domainToASCII(raw.trim().toLowerCase());
    return out && out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Normalize + validate a user-supplied domain string. Never throws. */
export function normalizeDomain(input: string): { ascii: string | null; valid: boolean; invalidReason?: string } {
  const t = (input ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!t) return { ascii: null, valid: false, invalidReason: "Empty domain." };
  if (/\s/.test(t)) return { ascii: null, valid: false, invalidReason: "Domains cannot contain spaces." };
  if (!t.includes(".")) return { ascii: null, valid: false, invalidReason: "Include a TLD, e.g. example.com." };
  if (t.length > 253) return { ascii: null, valid: false, invalidReason: "Domain too long (max 253 chars)." };
  const ascii = toAscii(t);
  if (!ascii || !ascii.includes(".")) return { ascii: null, valid: false, invalidReason: "Could not parse domain." };
  const labels = ascii.split(".");
  if (labels.some((l) => l.length === 0 || l.length > 63 || !LABEL.test(l))) {
    return { ascii, valid: false, invalidReason: "Invalid characters or label shape." };
  }
  return { ascii, valid: true };
}

export type FetchImpl = (url: string, opts?: { signal?: AbortSignal }) => Promise<{
  status: number;
  json(): Promise<unknown>;
}>;

const defaultFetch: FetchImpl = (url, opts) =>
  (globalThis.fetch as typeof fetch)(url, {
    signal: opts?.signal,
    headers: {
      accept: "application/rdap+json, application/json",
      // rdap.org sits behind bot protection that rejects default client UAs.
      "user-agent": "AgentCom-domains/0.1 (+https://agentcom.org) Node/fetch",
    },
  }) as unknown as Promise<{ status: number; json(): Promise<unknown> }>;

/**
 * Deterministic corroboration policy. Decisive sources win; disagreement
 * degrades to conflicting (never the conversion-favorable answer).
 */
export function mergeSources(results: SourceResult[]): { status: Availability; confidence: "high" | "medium" | "low" } {
  const decisive = results.filter((r) => r.status === "available" || r.status === "registered");
  const kinds = new Set(decisive.map((r) => r.status));
  if (kinds.size > 1) return { status: "conflicting", confidence: "low" };
  if (kinds.has("registered")) return { status: "registered", confidence: "high" };
  if (kinds.has("available")) {
    const registrar = decisive.some((r) => r.type === "registrar");
    return registrar
      ? { status: "available", confidence: "high" }
      : { status: "available", confidence: "medium" };
  }
  if (results.some((r) => r.status === "unsupported")) return { status: "unsupported", confidence: "low" };
  return { status: "unknown", confidence: "low" };
}

function messageFor(status: Availability, ascii: string): string {
  switch (status) {
    case "available":
      return `${ascii} — no current registration record found (RDAP). Registrar confirmation required before purchase.`;
    case "registered":
      return `${ascii} is registered.`;
    case "conflicting":
      return `Sources disagree on ${ascii}; treating as unverified.`;
    case "unsupported":
      return `${ascii} cannot be checked.`;
    default:
      return `Could not confirm registration status for ${ascii} right now.`;
  }
}

/**
 * RDAP availability provider implementing DomainAvailabilityProvider.
 * 404 = no record (available/medium, never registrar-grade); 200 domain
 * object = registered; anything else = unknown. Fetch is injectable so
 * tests never touch the network.
 */
export class RdapProvider implements MarketProvider, DomainAvailabilityProvider {
  readonly id = "rdap";
  readonly vertical = "domains";
  readonly capabilities: ProviderCapability = {
    discovery: true,
    quote: false,
    realtimeAvailability: true,
    messaging: false,
    booking: false,
  };
  private fetchImpl: FetchImpl;
  private timeoutMs: number;

  constructor(opts?: { fetchImpl?: FetchImpl; timeoutMs?: number }) {
    this.fetchImpl = opts?.fetchImpl ?? defaultFetch;
    this.timeoutMs = opts?.timeoutMs ?? 8000;
  }

  async search(): Promise<Offer[]> {
    return [];
  }

  async checkSource(ascii: string): Promise<SourceResult> {
    const at = () => new Date().toISOString();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`https://rdap.org/domain/${encodeURIComponent(ascii)}`, {
        signal: ctrl.signal,
      });
      if (res.status === 404) {
        return { type: "rdap", provider: this.id, status: "available", at: at() };
      }
      if (res.status >= 200 && res.status < 300) {
        const body = (await res.json().catch(() => null)) as { objectClassName?: string } | null;
        if (body && body.objectClassName === "domain") {
          return { type: "rdap", provider: this.id, status: "registered", at: at() };
        }
      }
      return { type: "rdap", provider: this.id, status: "unknown", at: at() };
    } catch {
      return { type: "rdap", provider: this.id, status: "unknown", at: at() };
    } finally {
      clearTimeout(timer);
    }
  }

  async check(domain: string): Promise<DomainCheck> {
    const norm = normalizeDomain(domain);
    const checked_at = new Date().toISOString();
    if (!norm.valid || !norm.ascii) {
      return {
        input: domain, ascii: norm.ascii, valid: false, invalidReason: norm.invalidReason,
        status: "unsupported", confidence: "low", sources: [], checked_at,
        message: norm.invalidReason ?? "Invalid domain.",
      };
    }
    const source = await this.checkSource(norm.ascii);
    const merged = mergeSources([source]);
    return {
      input: domain, ascii: norm.ascii, valid: true,
      status: merged.status, confidence: merged.confidence, sources: [source], checked_at,
      message: messageFor(merged.status, norm.ascii),
    };
  }

  /** Bounded-concurrency batch. Order of results matches input order. */
  async batch(domains: string[], concurrency = 5): Promise<DomainCheck[]> {
    const out: DomainCheck[] = new Array(domains.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, domains.length) }, async () => {
      while (cursor < domains.length) {
        const i = cursor++;
        out[i] = await this.check(domains[i]!);
      }
    });
    await Promise.all(workers);
    return out;
  }
}

const ALT_TLDS = ["com", "io", "co", "ai", "dev", "app", "net", "org"];
const PREFIXES = ["get", "try", "use", "hey", "join"];
const SUFFIXES = ["hq", "app", "ly", "hub", "labs"];

/** Deterministic suggestion generator: same keywords → same candidates. */
export function suggestDomains(keywords: string, maxCandidates = 24): string[] {
  const base = keywords
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .join("");
  if (!base) return [];
  const bare = base.slice(0, 30);
  const cands = new Set<string>();
  for (const tld of ALT_TLDS) cands.add(`${bare}.${tld}`);
  for (const p of PREFIXES) cands.add(`${p}${bare}.com`);
  for (const s of SUFFIXES) cands.add(`${bare}${s}.com`);
  return [...cands].slice(0, maxCandidates);
}

/**
 * find_available_domains: generate → batch-check → return ONLY confirmed
 * available. Unknowns are excluded in v1 (never masquerade as available).
 */
export async function findAvailable(
  provider: RdapProvider,
  keywords: string,
  maxResults = 5,
): Promise<DomainCheck[]> {
  const cands = suggestDomains(keywords);
  if (cands.length === 0) return [];
  const checked = await provider.batch(cands);
  return checked.filter((c) => c.valid && c.status === "available").slice(0, maxResults);
}
