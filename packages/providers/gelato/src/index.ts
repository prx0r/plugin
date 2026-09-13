// Gelato adapter — stub (Phase 10+). Interface-compatible, no quotes yet.
import type { ArtworkRequirement, CanonicalProductSearch, PrintProvider, ProviderCandidate, ProviderOrder, ProviderOrderRequest, ProviderQuote, ProviderQuoteRequest } from "@agentcom/domain";
export class GelatoProvider implements PrintProvider {
  readonly id = "gelato";
  async searchProducts(_req: CanonicalProductSearch): Promise<ProviderCandidate[]> { return []; }
  async getArtworkRequirements(_c: ProviderCandidate): Promise<ArtworkRequirement[]> { return []; }
  async quote(_req: ProviderQuoteRequest): Promise<ProviderQuote[]> { return []; }
  async createOrder(_req: ProviderOrderRequest): Promise<ProviderOrder> { throw new Error("Gelato not wired yet"); }
  async getOrder(id: string): Promise<ProviderOrder> { return { providerOrderId: id, status: "unknown" }; }
}
