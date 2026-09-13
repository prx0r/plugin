// Prodigi adapter — Phase 3. Sandbox-first.
// Real HTTP calls go here once PRODIGI_API_KEY is set; until then,
// deterministic stub quotes over the V1 8-product universe so the
// router + MCP can be proven end-to-end without network.
import {
  CANONICAL_CATALOG,
  type ArtworkRequirement,
  type CanonicalProductSearch,
  type PrintProvider,
  type ProviderCandidate,
  type ProviderOrder,
  type ProviderOrderRequest,
  type ProviderQuote,
  type ProviderQuoteRequest,
} from "@print/domain";

const SKU_PREFIX: Record<string, string> = {
  tee_unisex_standard: "PRODIGI-TEE-STD",
  tee_unisex_heavyweight: "PRODIGI-TEE-HVY",
  hoodie_unisex_standard: "PRODIGI-HOOD-STD",
  mug_standard_11oz: "PRODIGI-MUG-11",
  poster_a3: "PRODIGI-POST-A3",
  framed_print_a3: "PRODIGI-FRAME-A3",
  card_a6: "PRODIGI-CARD-A6",
  tote_standard: "PRODIGI-TOTE-STD",
};

const BASE_COST_GBP: Record<string, number> = {
  tee_unisex_standard: 8.4,
  tee_unisex_heavyweight: 12.1,
  hoodie_unisex_standard: 18.5,
  mug_standard_11oz: 6.2,
  poster_a3: 5.1,
  framed_print_a3: 14.3,
  card_a6: 1.8,
  tote_standard: 4.6,
};

function shippingFor(dest: string): { cost: number; min: number; max: number; country: string } {
  const d = dest.toUpperCase();
  if (d === "GB") return { cost: 4.61, min: 3, max: 5, country: "GB" };
  if (["US", "CA"].includes(d)) return { cost: 6.9, min: 4, max: 7, country: "US" };
  return { cost: 7.9, min: 5, max: 9, country: "LV" };
}

export class ProdigiProvider implements PrintProvider {
  readonly id = "prodigi";
  private apiKey?: string;

  constructor(opts?: { apiKey?: string }) {
    const envKey = (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.["PRODIGI_API_KEY"];
    this.apiKey = opts?.apiKey ?? envKey;
  }

  get mode(): "sandbox_stub" | "live" {
    return this.apiKey ? "live" : "sandbox_stub";
  }

  async searchProducts(req: CanonicalProductSearch): Promise<ProviderCandidate[]> {
    const pool = CANONICAL_CATALOG.filter((p) =>
      req.productType ? p.type === req.productType : true,
    );
    return pool.map((p) => ({
      providerId: this.id,
      providerProductRef: SKU_PREFIX[p.id] ?? `PRODIGI-${p.id.toUpperCase()}`,
      canonicalProductId: p.id,
      color: req.colorPreferences?.[0] ?? p.colors[0] ?? "white",
      size: req.size ?? p.sizes[0] ?? "one_size",
      unitCost: BASE_COST_GBP[p.id] ?? 9.0,
      currency: "GBP",
      fulfillmentCountry: "GB",
      qualityScore: p.qualityTier === "premium" ? 0.9 : p.qualityTier === "standard" ? 0.75 : 0.6,
      reliabilityScore: 0.88,
    }));
  }

  async getArtworkRequirements(candidate: ProviderCandidate): Promise<ArtworkRequirement[]> {
    const product = CANONICAL_CATALOG.find((p) => p.id === candidate.canonicalProductId);
    if (!product) return [];
    return product.printAreas.map((a) => ({
      printAreaId: a.id,
      minWidthPx: Math.round((a.widthMm / 25.4) * a.minDpi),
      minHeightPx: Math.round((a.heightMm / 25.4) * a.minDpi),
      minDpi: a.minDpi,
      acceptedFileTypes: ["png", "jpg", "pdf"],
      requiresTransparency: product.type === "tshirt",
    }));
  }

  async quote(req: ProviderQuoteRequest): Promise<ProviderQuote[]> {
    if (this.apiKey) {
      throw new Error("PRODIGI live quoting not wired yet — set sandbox stub (no key) for V1 tests.");
    }
    const dest = (req.destinationCountry ?? "GB").toUpperCase();
    const ship = shippingFor(dest);
    const candidates = req.candidate
      ? [req.candidate]
      : await this.searchProducts(req);
    return candidates.map((c) => ({
      providerId: this.id,
      canonicalProductId: c.canonicalProductId,
      variant: { canonicalProductId: c.canonicalProductId, color: c.color, size: c.size },
      productionCost: c.unitCost,
      shippingCost: ship.cost,
      currency: "GBP",
      shipping: {
        method: "standard",
        cost: ship.cost,
        currency: "GBP",
        etaMinDays: ship.min,
        etaMaxDays: ship.max,
        fulfillmentCountry: ship.country,
      },
      fulfillmentCountry: ship.country,
      qualityScore: c.qualityScore ?? 0.75,
      qualityConfidence: 0.51,
      reliabilityScore: c.reliabilityScore ?? 0.88,
    }));
  }

  async createOrder(req: ProviderOrderRequest): Promise<ProviderOrder> {
    if (!req.idempotencyKey) throw new Error("idempotencyKey required");
    // Sandbox stub: never hits network.
    return {
      providerOrderId: `prodigi_sandbox_${Math.abs(hash(req.idempotencyKey))}`,
      status: "created",
    };
  }

  async getOrder(providerOrderId: string): Promise<ProviderOrder> {
    return { providerOrderId, status: "in_production" };
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
