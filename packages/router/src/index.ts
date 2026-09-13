// Deterministic routing engine — Phase 4. No LLM inside pricing/routing.
import {
  CANONICAL_CATALOG,
  type IntentPreset,
  type ProviderQuote,
  type Quote,
  type QuoteRequest,
  type RoutingDecision,
} from "@agentcom/domain";

export const RANKING_VERSION = "v1.0";
export const QUOTE_TTL_MS = 30 * 60 * 1000;

export const WEIGHT_PRESETS: Record<IntentPreset, Record<string, number>> = {
  CHEAPEST: { price: 0.7, quality: 0.1, delivery: 0.1, reliability: 0.1, locality: 0 },
  BALANCED: { price: 0.3, quality: 0.3, delivery: 0.15, reliability: 0.2, locality: 0.05 },
  BEST_QUALITY: { price: 0.1, quality: 0.55, delivery: 0.1, reliability: 0.2, locality: 0.05 },
  FASTEST: { price: 0.1, quality: 0.2, delivery: 0.55, reliability: 0.1, locality: 0.05 },
  LOCAL: { price: 0.2, quality: 0.25, delivery: 0.2, reliability: 0.15, locality: 0.2 },
};

export function intentFromRequest(req: QuoteRequest): IntentPreset {
  if (req.intent) return req.intent;
  const q = (req.qualityPreference ?? "balanced").toLowerCase();
  if (q === "economy") return "CHEAPEST";
  if (q === "premium") return "BEST_QUALITY";
  return "BALANCED";
}

function landed(q: ProviderQuote): number {
  return q.productionCost + q.shippingCost + (q.taxEstimate ?? 0);
}

function normalizeHigher(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 1);
  return values.map((v) => (v - min) / (max - min));
}

function normalizeLower(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 1);
  return values.map((v) => 1 - (v - min) / (max - min));
}

export interface ScoredQuote {
  quote: ProviderQuote;
  score: number;
  parts: Record<string, number>;
}

export function scoreQuotes(
  candidates: ProviderQuote[],
  intent: IntentPreset,
  destinationCountry: string,
): ScoredQuote[] {
  const w = WEIGHT_PRESETS[intent];
  if (candidates.length === 0) return [];
  const totals = candidates.map(landed);
  const price = normalizeLower(totals);
  const quality = normalizeHigher(candidates.map((c) => c.qualityScore));
  const delivery = normalizeLower(candidates.map((c) => c.shipping.etaMaxDays));
  const reliability = normalizeHigher(candidates.map((c) => c.reliabilityScore));
  const locality = candidates.map((c) =>
    c.fulfillmentCountry?.toUpperCase() === destinationCountry.toUpperCase() ? 1 : 0,
  );
  return candidates
    .map((quote, i) => {
      const parts = {
        price: price[i],
        quality: quality[i],
        delivery: delivery[i],
        reliability: reliability[i],
        locality: locality[i],
      };
      const score =
        w.price * parts.price +
        w.quality * parts.quality +
        w.delivery * parts.delivery +
        w.reliability * parts.reliability +
        w.locality * parts.locality;
      return { quote, score, parts };
    })
    .sort((a, b) => b.score - a.score);
}

function addDays(base: Date, days: number): string {
  const d = new Date(base.getTime() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

let quoteCounter = 0;
export function mintQuoteId(): string {
  quoteCounter += 1;
  return `q_${Date.now().toString(36)}_${quoteCounter}`;
}

export interface RouteResult {
  quotes: Quote[];
  decision: RoutingDecision;
  failures: string[];
}

/** Hard-filter + score + label Value/Recommended/Fastest. Pure & deterministic. */
export function routeQuoteRequest(
  req: QuoteRequest,
  providerQuotes: ProviderQuote[],
  now = new Date(),
): RouteResult {
  const dest = (req.destinationCountry ?? "").toUpperCase();
  const failures: string[] = [];
  if (!dest || dest.length !== 2) {
    return {
      quotes: [],
      failures: ["INVALID_DESTINATION"],
      decision: {
        intent: intentFromRequest(req),
        candidatesEvaluated: providerQuotes.length,
        rankingVersion: RANKING_VERSION,
        weights: WEIGHT_PRESETS[intentFromRequest(req)],
        at: now.toISOString(),
      },
    };
  }
  // Hard filters: budget + deadline.
  let eligible = providerQuotes.filter((q) => q.currency);
  if (req.budget != null) {
    const before = eligible.length;
    eligible = eligible.filter((q) => landed(q) <= (req.budget as number));
    if (eligible.length === 0 && before > 0) failures.push("NO_ELIGIBLE_PRODUCT");
  }
  if (req.deliveryDeadline) {
    const deadline = req.deliveryDeadline.slice(0, 10);
    const before = eligible.length;
    eligible = eligible.filter((q) => addDays(now, q.shipping.etaMaxDays) <= deadline);
    if (eligible.length === 0 && before > 0) failures.push("DEADLINE_UNAVAILABLE");
  }
  if (eligible.length === 0) {
    return {
      quotes: [],
      failures: failures.length ? failures : ["NO_PROVIDER_AVAILABLE"],
      decision: {
        intent: intentFromRequest(req),
        candidatesEvaluated: providerQuotes.length,
        rankingVersion: RANKING_VERSION,
        weights: WEIGHT_PRESETS[intentFromRequest(req)],
        at: now.toISOString(),
      },
    };
  }
  const intent = intentFromRequest(req);
  const scored = scoreQuotes(eligible, intent, dest);
  const SERVICE_FEE = 1.5;
  const quotes: Quote[] = scored.map((s) => {
    const total = landed(s.quote) + SERVICE_FEE;
    const cur = s.quote.currency;
    return {
      quoteId: mintQuoteId(),
      providerId: s.quote.providerId,
      providerQuoteId: s.quote.providerQuoteId,
      canonicalProductId: s.quote.canonicalProductId,
      productName:
        CANONICAL_CATALOG.find((p) => p.id === s.quote.canonicalProductId)?.name ??
        s.quote.canonicalProductId,
      variant: s.quote.variant,
      production: s.quote.productionCost,
      shipping: s.quote.shippingCost,
      serviceFee: SERVICE_FEE,
      taxEstimate: s.quote.taxEstimate,
      total: { amount: Math.round(total * 100) / 100, currency: cur },
      estimatedDelivery: {
        min: addDays(now, s.quote.shipping.etaMinDays),
        max: addDays(now, s.quote.shipping.etaMaxDays),
      },
      qualityScore: s.quote.qualityScore,
      qualityConfidence: s.quote.qualityConfidence,
      expiresAt: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(),
      createdAt: now.toISOString(),
    };
  });

  // Diversity-aware top-3 labels.
  if (quotes.length >= 1) {
    const cheapestIdx = quotes.reduce((bi, q, i) => (q.total.amount < quotes[bi].total.amount ? i : bi), 0);
    const fastestIdx = quotes.reduce((bi, q, i) =>
      q.estimatedDelivery.max < quotes[bi].estimatedDelivery.max ? i : bi,
    0);
    // Recommended = top-ranked (index 0 after sort by score).
    quotes[0].label = "Recommended";
    quotes[0].reason = "Best balance of price, quality and delivery for your constraints.";
    if (quotes.length >= 2 && cheapestIdx !== 0) {
      quotes[cheapestIdx].label = "Value";
      quotes[cheapestIdx].reason = "Lowest landed price among eligible options.";
    } else if (quotes.length >= 2) {
      // cheapest IS recommended; pick next-cheapest as Value if meaningfully cheaper tier
      const rest = quotes.map((q, i) => ({ q, i })).filter(({ i }) => i !== 0)
        .sort((a, b) => a.q.total.amount - b.q.total.amount);
      if (rest.length) {
        rest[0].q.label = "Value";
        rest[0].q.reason = "Lowest landed price among eligible options.";
      }
    }
    if (quotes.length >= 3) {
      const unlabeled = quotes.map((q, i) => ({ q, i })).filter(({ q }) => !q.label)
        .sort((a, b) => (a.q.estimatedDelivery.max < b.q.estimatedDelivery.max ? -1 : 1));
      const fastPick = unlabeled.find(({ i }) => i === fastestIdx) ?? unlabeled[0];
      fastPick.q.label = "Fastest";
      fastPick.q.reason = "Quickest eligible delivery.";
    }
    // Any leftovers → Premium by quality.
    for (const q of quotes) {
      if (!q.label) {
        q.label = "Premium";
        q.reason = "High quality alternative.";
      }
    }
  }

  return {
    quotes: quotes.slice(0, 3),
    failures,
    decision: {
      intent,
      candidatesEvaluated: providerQuotes.length,
      winner: quotes[0] ? `${quotes[0].providerId}:${quotes[0].canonicalProductId}` : undefined,
      rankingVersion: RANKING_VERSION,
      weights: WEIGHT_PRESETS[intent],
      at: now.toISOString(),
    },
  };
}

export function isQuoteExpired(quote: Quote, now = new Date()): boolean {
  return new Date(quote.expiresAt).getTime() <= now.getTime();
}
