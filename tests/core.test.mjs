import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rankOffers, labelTopThree, collectOffers, CORE_WEIGHTS } from "@agentcom/core";

function offer(over = {}) {
  return {
    provider: "P",
    providerId: "p",
    providerType: "independent",
    price: 100,
    currency: "GBP",
    etaDaysMax: 3,
    qualityScore: 0.8,
    priceConfidence: 0.9,
    distanceMiles: 3,
    ...over,
  };
}

describe("core kernel", () => {
  it("deterministic: same offers → same order", () => {
    const offers = [offer({ providerId: "a", price: 95 }), offer({ providerId: "b", price: 140 }), offer({ providerId: "c", price: 120 })];
    const r1 = rankOffers(offers, "balanced").map((s) => s.offer.providerId);
    const r2 = rankOffers(offers, "balanced").map((s) => s.offer.providerId);
    assert.deepEqual(r1, r2);
  });

  it("cheapest priority favors lowest price", () => {
    const offers = [
      offer({ providerId: "cheap", price: 80, qualityScore: 0.5 }),
      offer({ providerId: "best", price: 150, qualityScore: 0.95 }),
    ];
    const ranked = rankOffers(offers, "cheapest");
    assert.equal(ranked[0].offer.providerId, "cheap");
  });

  it("best priority can beat a cheaper option", () => {
    const offers = [
      offer({ providerId: "cheap", price: 80, qualityScore: 0.4 }),
      offer({ providerId: "best", price: 100, qualityScore: 0.95 }),
    ];
    const ranked = rankOffers(offers, "best");
    assert.equal(ranked[0].offer.providerId, "best");
  });

  it("missing signals score 0 instead of inventing data", () => {
    const ranked = rankOffers([offer({ price: undefined, etaDaysMax: undefined, qualityScore: undefined })], "balanced");
    assert.ok(Number.isFinite(ranked[0].score));
  });

  it("labels top three Recommended / Lowest price / Fastest", () => {
    const offers = [
      offer({ providerId: "a", price: 100, etaDaysMax: 3, qualityScore: 0.9 }),
      offer({ providerId: "b", price: 70, etaDaysMax: 5, qualityScore: 0.5 }),
      offer({ providerId: "c", price: 120, etaDaysMax: 1, qualityScore: 0.6 }),
    ];
    const labels = labelTopThree(rankOffers(offers, "balanced")).map((l) => l.label).sort();
    assert.deepEqual(labels, ["Fastest", "Lowest price", "Recommended"]);
  });

  it("collectOffers tolerates a failing provider", async () => {
    const good = { id: "good", vertical: "x", capabilities: {}, search: async () => [offer()] };
    const bad = { id: "bad", vertical: "x", capabilities: {}, search: async () => { throw new Error("down"); } };
    const { offers, errors } = await collectOffers([good, bad], { vertical: "x", task: "t" });
    assert.equal(offers.length, 1);
    assert.deepEqual(errors, ["bad"]);
  });

  it("weight presets match the plan economics", () => {
    assert.ok(CORE_WEIGHTS.cheapest.price > CORE_WEIGHTS.cheapest.quality);
    assert.ok(CORE_WEIGHTS.best.quality > CORE_WEIGHTS.best.price);
    assert.ok(CORE_WEIGHTS.fastest.delivery > CORE_WEIGHTS.fastest.price);
  });
});
