// AgentCom Core kernel — plan.md.
// One boring market protocol: intent → normalized query → providers →
// offers → ranked options → action. Verticals are adapters, never new semantics.

export type Vertical = "domains" | "print" | "home_services" | string;

export type IntentPriority = "cheapest" | "balanced" | "best" | "fastest" | "local";

/** Canonical market request. Every vertical reduces to this. */
export interface MarketIntent {
  vertical: Vertical;
  task: string; // e.g. "domain_check", "boiler_repair", "tshirt_print"
  location?: string;
  constraints?: Record<string, unknown>;
  budget?: { amount: number; currency: string };
  deadline?: string; // ISO
  priority?: IntentPriority;
  preferences?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/** Normalized offer. Providers emit these; the router ranks them. */
export interface Offer {
  provider: string; // display name, e.g. "Geoff — Plumbsoft"
  providerId: string; // adapter id, e.g. "checkatrade", "prodigi"
  providerType: "marketplace" | "supplier" | "independent" | "registry";
  price?: number; // comparable headline figure, same currency per ranking
  currency?: string;
  priceConfidence?: number; // 0..1
  etaDaysMin?: number;
  etaDaysMax?: number;
  qualityScore?: number; // 0..1
  reviewScore?: number; // e.g. 4.8 out of 5
  distanceMiles?: number;
  verification?: string[]; // e.g. ["gas_safe"]
  terms?: string;
  nextAction?: string;
}

/** Capability declaration — not every vertical supports every operation. */
export interface ProviderCapability {
  discovery: boolean;
  quote: boolean;
  realtimeAvailability: boolean;
  messaging: boolean;
  booking: boolean;
}

/** Adapter contract. No routing logic inside adapters. */
export interface MarketProvider {
  readonly id: string;
  readonly vertical: Vertical;
  readonly capabilities: ProviderCapability;
  search(intent: MarketIntent): Promise<Offer[]>;
  quote?(intent: MarketIntent): Promise<Offer[]>;
  availability?(intent: MarketIntent): Promise<Offer[]>;
  contact?(intent: MarketIntent, message: string): Promise<{ ok: boolean; reference?: string }>;
  book?(intent: MarketIntent, offer: Offer, idempotencyKey: string): Promise<{ ok: boolean; reference?: string }>;
  status?(reference: string): Promise<{ status: string; detail?: string }>;
}

export type WeightPreset = Record<"price" | "quality" | "delivery" | "reliability" | "locality", number>;

export const CORE_WEIGHTS: Record<IntentPriority, WeightPreset> = {
  cheapest: { price: 0.7, quality: 0.1, delivery: 0.1, reliability: 0.1, locality: 0 },
  balanced: { price: 0.3, quality: 0.3, delivery: 0.15, reliability: 0.2, locality: 0.05 },
  best: { price: 0.1, quality: 0.55, delivery: 0.1, reliability: 0.2, locality: 0.05 },
  fastest: { price: 0.1, quality: 0.2, delivery: 0.55, reliability: 0.1, locality: 0.05 },
  local: { price: 0.2, quality: 0.25, delivery: 0.2, reliability: 0.15, locality: 0.2 },
};

export const RANKING_VERSION = "core-v1.0";

function qualityOf(o: Offer): number {
  if (o.qualityScore != null) return o.qualityScore;
  if (o.reviewScore != null) return Math.min(1, Math.max(0, o.reviewScore / 5));
  return 0;
}

export interface ScoredOffer<T extends Offer = Offer> {
  offer: T;
  score: number;
}

function normLower(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 1);
  return values.map((v) => 1 - (v - min) / (max - min));
}

function normHigher(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 1);
  return values.map((v) => (v - min) / (max - min));
}

/**
 * Deterministic ranking. No LLM inside. Pure function of offers + priority.
 * Missing signals score 0 (unknown reduces standing, never invents data).
 */
export function rankOffers<T extends Offer>(
  offers: T[],
  priority: IntentPriority = "balanced",
  homeMiles?: number,
): ScoredOffer<T>[] {
  const w = CORE_WEIGHTS[priority];
  if (offers.length === 0) return [];
  const priceNorm = normLower(offers.map((o) => o.price ?? Number.POSITIVE_INFINITY));
  const price = offers.map((o, i) => (o.price == null ? 0 : priceNorm[i]!));
  const quality = normHigher(offers.map(qualityOf));
  const deliveryNorm = normLower(offers.map((o) => o.etaDaysMax ?? Number.POSITIVE_INFINITY));
  const delivery = offers.map((o, i) => (o.etaDaysMax == null ? 0 : deliveryNorm[i]!));
  const reliability = normHigher(offers.map((o) => o.priceConfidence ?? 0.5));
  const locality = offers.map((o) =>
    o.distanceMiles == null ? 0 : homeMiles != null && o.distanceMiles <= homeMiles ? 1 : Math.max(0, 1 - o.distanceMiles / 50),
  );
  return offers
    .map((offer, i) => ({
      offer,
      score:
        w.price * price[i]! +
        w.quality * quality[i]! +
        w.delivery * delivery[i]! +
        w.reliability * reliability[i]! +
        w.locality * locality[i]!,
    }))
    .sort((a, b) => b.score - a.score);
}

export type OfferLabel = "Recommended" | "Lowest price" | "Fastest";

/** Diversity-aware top-3 labels. Deterministic. */
export function labelTopThree<T extends Offer>(ranked: ScoredOffer<T>[]): { offer: T; label: OfferLabel; score: number }[] {
  const top = ranked.slice(0, 3);
  if (top.length === 0) return [];
  const out = top.map((s) => ({ offer: s.offer, label: "Recommended" as OfferLabel, score: s.score }));
  out[0]!.label = "Recommended";
  if (top.length >= 2) {
    let cheapest = 0;
    for (let i = 1; i < top.length; i++) {
      const a = top[i]!.offer.price ?? Number.POSITIVE_INFINITY;
      const b = top[cheapest]!.offer.price ?? Number.POSITIVE_INFINITY;
      if (a < b) cheapest = i;
    }
    if (cheapest !== 0) out[cheapest]!.label = "Lowest price";
    else if (top.length >= 2) {
      let second = 1;
      for (let i = 2; i < top.length; i++) {
        const a = top[i]!.offer.price ?? Number.POSITIVE_INFINITY;
        const b = top[second]!.offer.price ?? Number.POSITIVE_INFINITY;
        if (a < b) second = i;
      }
      out[second]!.label = "Lowest price";
    }
  }
  if (top.length >= 3) {
    const unlabeled = out.map((o, i) => ({ ...o, i })).filter((o) => o.label === "Recommended" && o.i !== 0);
    const pool = unlabeled.length > 0 ? unlabeled : out.map((o, i) => ({ ...o, i })).filter((o) => o.i !== 0);
    pool.sort((a, b) => (a.offer.etaDaysMax ?? 999) - (b.offer.etaDaysMax ?? 999));
    if (pool[0]) out[pool[0].i]!.label = "Fastest";
  }
  return out;
}

export interface RoutingRecord {
  vertical: Vertical;
  priority: IntentPriority;
  candidatesEvaluated: number;
  winner?: string;
  rankingVersion: string;
  weights: WeightPreset;
  at: string;
}

/** Fan-out helper: query providers concurrently, tolerate single failures. */
export async function collectOffers(
  providers: MarketProvider[],
  intent: MarketIntent,
): Promise<{ offers: Offer[]; errors: string[] }> {
  const settled = await Promise.all(
    providers.map((p) => p.search(intent).then(
      (offers) => ({ ok: true as const, offers }),
      () => ({ ok: false as const, offers: [] as Offer[] }),
    )),
  );
  return {
    offers: settled.flatMap((r) => (r.ok ? r.offers : [])),
    errors: settled.flatMap((r, i) => (r.ok ? [] : [providers[i]!.id])),
  };
}
