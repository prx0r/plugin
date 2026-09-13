// Domains vertical — plan.md reference router #1.
// Tiny, read-only, deterministic, no login, no writes. The publication/
// discovery experiment: learn approval, invocation and telemetry here.
import type { MarketProvider, Offer, ProviderCapability } from "@print/core";
import { domainToASCII } from "node:url";

export type DomainCheck = {
  input: string;
  ascii: string | null; // punycode-normalized, null when invalid
  valid: boolean;
  invalidReason?: string;
  available: boolean | null; // null = unknown (lookup failed / not attempted)
  source?: string; // e.g. "rdap"
  checkedAt?: string;
}

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
 * RDAP availability provider. 200 + domain object = taken, 404 = available,
 * anything else = unknown (never invent an answer). Fetch is injectable so
 * tests never touch the network.
 */
export class RdapProvider implements MarketProvider {
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

  async check(domain: string): Promise<DomainCheck> {
    const norm = normalizeDomain(domain);
    if (!norm.valid || !norm.ascii) {
      return { input: domain, ascii: norm.ascii, valid: false, invalidReason: norm.invalidReason, available: null };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`https://rdap.org/domain/${encodeURIComponent(norm.ascii)}`, {
        signal: ctrl.signal,
      });
      if (res.status === 404) {
        return { input: domain, ascii: norm.ascii, valid: true, available: true, source: "rdap", checkedAt: new Date().toISOString() };
      }
      if (res.status >= 200 && res.status < 300) {
        const body = (await res.json().catch(() => null)) as { objectClassName?: string } | null;
        if (body && body.objectClassName === "domain") {
          return { input: domain, ascii: norm.ascii, valid: true, available: false, source: "rdap", checkedAt: new Date().toISOString() };
        }
        return { input: domain, ascii: norm.ascii, valid: true, available: null, source: "rdap", checkedAt: new Date().toISOString() };
      }
      return { input: domain, ascii: norm.ascii, valid: true, available: null, source: "rdap", checkedAt: new Date().toISOString() };
    } catch {
      return { input: domain, ascii: norm.ascii, valid: true, available: null, source: "rdap", checkedAt: new Date().toISOString() };
    } finally {
      clearTimeout(timer);
    }
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

/** find_available_domains: generate → batch-check → return available first. */
export async function findAvailable(
  provider: RdapProvider,
  keywords: string,
  maxResults = 5,
): Promise<DomainCheck[]> {
  const cands = suggestDomains(keywords);
  if (cands.length === 0) return [];
  const checked = await provider.batch(cands);
  const available = checked.filter((c) => c.available === true);
  const unknown = checked.filter((c) => c.available == null && c.valid);
  return [...available, ...unknown].slice(0, maxResults);
}
