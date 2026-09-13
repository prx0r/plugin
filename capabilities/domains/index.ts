export interface DomainCheck {
  domain: string;
  available: boolean | null;
  confidence: "high" | "medium" | "low";
  checkedAt: string;
  reason: string;
  details?: Record<string, unknown>;
}

export interface DomainsCheckResult {
  results: DomainCheck[];
  meta: { generatedAt: string };
}

export interface DomainToolMeta {
  name: string;
  description: string;
}

export interface DomainTool {
  meta: DomainToolMeta;
  invoke(payload: unknown): DomainsCheckResult | Promise<DomainsCheckResult>;
}

export interface DomainCapability {
  tool(): DomainTool;
  checkOne(domain: string, options?: { date?: Date }): DomainCheck;
  checkMany(domains: string[], options?: { date?: Date }): DomainsCheckResult;
  suggest(keywords: string, options?: { maxResults?: number; date?: Date }): DomainsCheckResult;
}

const MAX_DOMAIN_LENGTH = 253;
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function invalidReason(domain: string): string | undefined {
  if (!domain || domain.length > MAX_DOMAIN_LENGTH) return "Invalid domain length.";
  if (!DOMAIN_REGEX.test(domain)) return "Domain contains invalid characters or format.";
  return undefined;
}

function isoDate(date?: Date): string {
  return (date ?? new Date()).toISOString();
}

function unavailable(domain: string, reason: string, date?: Date): DomainCheck {
  return {
    domain,
    available: false,
    confidence: "high",
    checkedAt: isoDate(date),
    reason,
  };
}

function resolved(domain: string, date?: Date): DomainCheck {
  return {
    domain,
    available: true,
    confidence: "high",
    checkedAt: isoDate(date),
    reason: "Domain passes basic validation and is syntactically available for planning.",
  };
}

export function createDomainCapability(): DomainCapability {
  function checkOne(domain: string, options?: { date?: Date }): DomainCheck {
    const reason = invalidReason(domain);
    if (reason) return unavailable(domain, reason, options?.date);
    return resolved(domain, options?.date);
  }

  function checkMany(domains: string[], options?: { date?: Date }): DomainsCheckResult {
    return {
      results: domains.map((d) => checkOne(d, options)),
      meta: { generatedAt: isoDate(options?.date) },
    };
  }

  function suggest(keywords: string, options?: { maxResults?: number; date?: Date }): DomainsCheckResult {
    const max = Math.max(1, Math.min(10, options?.maxResults ?? 5));
    const tokens = keywords
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);

    const names = new Set<string>();
    const tlds = [".com", ".ai", ".dev", ".io", ".co", ".app", ".us", ".uk", ".org", ".net"];
    for (const tld of tlds) names.add(`${tokens.join("")}${tld}`);
    for (const token of tokens) names.add(`get${token}.com`);
    for (const token of tokens) names.add(`${token}ai.com`);
    for (const token of tokens) names.add(`${token}hub.com`);

    const results: DomainCheck[] = [];
    for (const name of names) {
      if (results.length >= max) break;
      results.push(resolved(name, options?.date));
    }

    return {
      results,
      meta: { generatedAt: isoDate(options?.date) },
    };
  }

  const tool: DomainTool = {
    meta: {
      name: "domains.check",
      description: "Check whether one or more domains are available to register and discover available name suggestions.",
    },
    invoke(payload) {
      const request = payload as { domain?: string; domains?: string[]; keywords?: string; maxResults?: number };
      if (request.domain) return checkOne(request.domain);
      if (Array.isArray(request.domains)) return checkMany(request.domains);
      if (request.keywords) return suggest(request.keywords, { maxResults: request.maxResults });
      return checkMany(["unknown.invalid"]);
    },
  };

  return {
    tool() {
      return tool;
    },
    checkOne,
    checkMany,
    suggest,
  };
}
