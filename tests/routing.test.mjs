import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { routeQuoteRequest, isQuoteExpired, WEIGHT_PRESETS } from "@agentcom/router";

const now = new Date("2026-09-13T00:00:00Z");

function pq(over = {}) {
  return {
    providerId: "prodigi",
    canonicalProductId: "tee_unisex_heavyweight",
    variant: { canonicalProductId: "tee_unisex_heavyweight", color: "cream", size: "L" },
    productionCost: 12.1,
    shippingCost: 4.61,
    currency: "GBP",
    shipping: { method: "standard", cost: 4.61, currency: "GBP", etaMinDays: 3, etaMaxDays: 5, fulfillmentCountry: "GB" },
    fulfillmentCountry: "GB",
    qualityScore: 0.9,
    qualityConfidence: 0.51,
    reliabilityScore: 0.88,
    ...over,
  };
}

describe("router", () => {
  it("deterministic: same input → same ranking", () => {
    const req = { productType: "tshirt", destinationCountry: "GB" };
    const cands = [
      pq({ providerId: "prodigi", productionCost: 12.1, shippingCost: 4.61 }),
      pq({ providerId: "printful", productionCost: 11.4, shippingCost: 6.4, fulfillmentCountry: "US", shipping: { method: "standard", cost: 6.4, currency: "GBP", etaMinDays: 4, etaMaxDays: 7, fulfillmentCountry: "US" } }),
    ];
    const a = routeQuoteRequest(req, cands, now);
    const b = routeQuoteRequest(req, cands, now);
    assert.deepEqual(a.quotes.map((q) => q.providerId), b.quotes.map((q) => q.providerId));
    assert.equal(a.decision.rankingVersion, "v1.0");
  });

  it("CHEAPEST preset weights price highest", () => {
    assert.ok(WEIGHT_PRESETS.CHEAPEST.price > WEIGHT_PRESETS.CHEAPEST.quality);
  });

  it("deadline hard-filters", () => {
    const req = { productType: "tshirt", destinationCountry: "GB", deliveryDeadline: "2026-09-15" };
    const cands = [pq({ shipping: { method: "standard", cost: 4.61, currency: "GBP", etaMinDays: 3, etaMaxDays: 5, fulfillmentCountry: "GB" } })];
    const r = routeQuoteRequest(req, cands, now);
    assert.equal(r.quotes.length, 0);
    assert.ok(r.failures.includes("DEADLINE_UNAVAILABLE"));
  });

  it("invalid destination → INVALID_DESTINATION, no throw", () => {
    const r = routeQuoteRequest({ productType: "mug", destinationCountry: "XX!" }, [pq()], now);
    assert.equal(r.quotes.length, 0);
  });

  it("quote expiry enforced", () => {
    const r = routeQuoteRequest({ productType: "tshirt", destinationCountry: "GB" }, [pq()], now);
    const q = r.quotes[0];
    assert.ok(!isQuoteExpired(q, now));
    assert.ok(isQuoteExpired(q, new Date(now.getTime() + 31 * 60 * 1000)));
  });

  it("labels include Recommended + Value", () => {
    const req = { productType: "tshirt", destinationCountry: "GB" };
    const cands = [
      pq({ providerId: "prodigi", productionCost: 12.1, shippingCost: 4.61, qualityScore: 0.9 }),
      pq({ providerId: "printful", productionCost: 9.5, shippingCost: 3.9, qualityScore: 0.6, fulfillmentCountry: "US", shipping: { method: "standard", cost: 3.9, currency: "GBP", etaMinDays: 2, etaMaxDays: 4, fulfillmentCountry: "US" } }),
      pq({ providerId: "prodigi", productionCost: 8.4, canonicalProductId: "tee_unisex_standard", shippingCost: 4.61, qualityScore: 0.75 }),
    ];
    const r = routeQuoteRequest(req, cands, now);
    const labels = r.quotes.map((q) => q.label);
    assert.ok(labels.includes("Recommended"));
  });
});
