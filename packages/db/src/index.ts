// Persistence row types — Phase 9. Implementation can start in-memory / sqlite.
import type { Order, Quote, RoutingDecision } from "@print/domain";

export interface QuoteRow {
  quote: Quote;
  decision: RoutingDecision;
}

export interface OrderRow {
  order: Order;
  quoteId: string;
  idempotencyKey: string;
  events: { at: string; status: string; message?: string }[];
}

export interface ProviderHealthRow {
  providerId: string;
  latencyMsP50?: number;
  errorRate?: number;
  quoteFailureRate?: number;
  orderFailureRate?: number;
  degradedUntil?: string;
}

/** Minimal in-memory store for V1 / tests. Swap for sqlite/postgres later. */
export class MemoryStore {
  quotes = new Map<string, QuoteRow>();
  orders = new Map<string, OrderRow>();
  idempotency = new Map<string, string>(); // key -> orderId
  health = new Map<string, ProviderHealthRow>();

  saveQuote(quote: Quote, decision: RoutingDecision): void {
    this.quotes.set(quote.quoteId, { quote, decision });
  }
  getQuote(id: string): QuoteRow | undefined {
    return this.quotes.get(id);
  }
}
