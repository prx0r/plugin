// Printful adapter — Phase 10. Same interface, slightly different fake
// economics so two-provider routing can be proven (one query Prodigi wins,
// another Printful wins).
import type {
  ArtworkRequirement,
  CanonicalProductSearch,
  PrintProvider,
  ProviderCandidate,
  ProviderOrder,
  ProviderOrderRequest,
  ProviderQuote,
  ProviderQuoteRequest,
} from "@agentcom/domain";
import { CANONICAL_CATALOG } from "@agentcom/domain";

const BASE_COST_USD: Record<string, number> = {
  tee_unisex_standard: 9.5,
  tee_unisex_heavyweight: 11.4,
  hoodie_unisex_standard: 19.8,
  mug_standard_11oz: 7.1,
  poster_a3: 6.4,
  framed_print_a3: 15.9,
  card_a6: 2.4,
  tote_standard: 5.2,
};

export class PrintfulProvider implements PrintProvider {
  readonly id = "printful";
  async searchProducts(req: CanonicalProductSearch): Promise<ProviderCandidate[]> {
    const pool = CANONICAL_CATALOG.filter((p) =>
      req.productType ? p.type === req.productType : true,
    );
    return pool.map((p) => ({
      providerId: this.id,
      providerProductRef: `PRINTFUL-${p.id.toUpperCase()}`,
      canonicalProductId: p.id,
      color: req.colorPreferences?.[0] ?? p.colors[0] ?? "white",
      size: req.size ?? p.sizes[0] ?? "one_size",
      unitCost: BASE_COST_USD[p.id] ?? 10,
      currency: "GBP",
      fulfillmentCountry: "US",
      qualityScore: p.qualityTier === "premium" ? 0.88 : 0.72,
      reliabilityScore: 0.9,
    }));
  }
  async getArtworkRequirements(): Promise<ArtworkRequirement[]> {
    return [];
  }
  async quote(req: ProviderQuoteRequest): Promise<ProviderQuote[]> {
    const dest = (req.destinationCountry ?? "GB").toUpperCase();
    const ship = dest === "US" ? { cost: 3.9, min: 2, max: 4, c: "US" } : { cost: 6.4, min: 4, max: 7, c: "US" };
    const candidates = req.candidate ? [req.candidate] : await this.searchProducts(req);
    return candidates.map((c) => ({
      providerId: this.id,
      canonicalProductId: c.canonicalProductId,
      variant: { canonicalProductId: c.canonicalProductId, color: c.color, size: c.size },
      productionCost: c.unitCost,
      shippingCost: ship.cost,
      currency: "GBP",
      shipping: { method: "standard", cost: ship.cost, currency: "GBP", etaMinDays: ship.min, etaMaxDays: ship.max, fulfillmentCountry: ship.c },
      fulfillmentCountry: ship.c,
      qualityScore: c.qualityScore ?? 0.75,
      qualityConfidence: 0.5,
      reliabilityScore: c.reliabilityScore ?? 0.9,
    }));
  }
  async createOrder(req: ProviderOrderRequest): Promise<ProviderOrder> {
    return { providerOrderId: `printful_sandbox_${req.idempotencyKey.slice(0, 8)}`, status: "created" };
  }
  async getOrder(providerOrderId: string): Promise<ProviderOrder> {
    return { providerOrderId, status: "in_production" };
  }
}
