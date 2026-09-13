// HTTP API surface — same capability core as MCP/WebMCP, no duplicated logic.
// Thin translation: HTTP shapes ↔ domain package. All rules live in @print/domains.
import { findAvailable, normalizeDomain, RdapProvider } from "@print/domains";

export interface RestResult {
  status: number;
  body: unknown;
}

export async function checkDomainRest(provider: RdapProvider, domain: unknown): Promise<RestResult> {
  if (typeof domain !== "string" || domain.length === 0 || domain.length > 253) {
    return { status: 400, body: { error: "Provide an exact domain string up to 253 chars." } };
  }
  const norm = normalizeDomain(domain);
  if (!norm.valid) return { status: 422, body: { input: domain, valid: false, invalidReason: norm.invalidReason } };
  const { checkedAt: _dropped, ...result } = await provider.check(domain);
  void _dropped;
  return { status: 200, body: result };
}

export async function batchDomainsRest(provider: RdapProvider, domains: unknown): Promise<RestResult> {
  if (!Array.isArray(domains) || domains.length < 1 || domains.length > 20 || domains.some((d) => typeof d !== "string")) {
    return { status: 400, body: { error: "Provide 1–20 domain strings." } };
  }
  const results = (await provider.batch(domains as string[])).map(({ checkedAt: _dropped, ...r }) => r);
  return { status: 200, body: { results } };
}

export async function suggestDomainsRest(
  provider: RdapProvider,
  keywords: unknown,
  maxResults: unknown,
): Promise<RestResult> {
  if (typeof keywords !== "string" || keywords.length === 0 || keywords.length > 80) {
    return { status: 400, body: { error: "Provide keywords up to 80 chars." } };
  }
  const max = typeof maxResults === "number" && Number.isInteger(maxResults) ? Math.min(10, Math.max(1, maxResults)) : 5;
  const results = (await findAvailable(provider, keywords, max)).map(({ checkedAt: _dropped, ...r }) => r);
  return { status: 200, body: { results } };
}
