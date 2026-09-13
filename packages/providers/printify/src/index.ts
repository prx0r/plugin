// Printify adapter — stub (Phase 10+). Interface-compatible, no quotes yet.
import type { ArtworkRequirement, CanonicalProductSearch, PrintProvider, ProviderCandidate, ProviderOrder, ProviderOrderRequest, ProviderQuote, ProviderQuoteRequest } from "@agentcom/domain";
export class PrintifyProvider implements PrintProvider {
  readonly id = "printify";
  async searchProducts(_req: CanonicalProductSearch): Promise<ProviderCandidate[]> { return []; }
  async getArtworkRequirements(_c: ProviderCandidate): Promise<ArtworkRequirement[]> { return []; }
  async quote(_req: ProviderQuoteRequest): Promise<ProviderQuote[]> { return []; }
  async createOrder(_req: ProviderOrderRequest): Promise<ProviderOrder> { throw new Error("Printify not wired yet"); }
  async getOrder(id: string): Promise<ProviderOrder> { return { providerOrderId: id, status: "unknown" }; }
}
