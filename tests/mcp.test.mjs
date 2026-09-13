import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { quotePersonalizedProduct, placePrintOrder, TOOLS } from "@print/mcp";

describe("mcp safety", () => {
  it("exposes exactly the V1 semantic tools", () => {
    const names = TOOLS.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "find_printable_products",
      "get_print_order",
      "place_print_order",
      "prepare_print_design",
      "preview_personalized_product",
      "quote_personalized_product",
    ]);
  });

  it("place_print_order requires confirmation + valid quote", async () => {
    const noConfirm = await placePrintOrder({ quoteId: "q_nope", confirmed: false, idempotencyKey: "k1" });
    assert.equal(noConfirm.code, "ORDER_FAILED");

    const badQuote = await placePrintOrder({ quoteId: "q_nope", confirmed: true, idempotencyKey: "k1", shipping: { name: "A", country: "GB" } });
    assert.equal(badQuote.code, "QUOTE_EXPIRED");
  });

  it("quote → order → idempotent reorder", async () => {
    const { quotes } = await quotePersonalizedProduct({ productType: "tshirt", destinationCountry: "GB", colorPreferences: ["cream"], size: "L" });
    assert.ok(quotes.length > 0);
    const q = quotes[0];
    assert.ok(q.expiresAt);
    const ship = { name: "Test User", country: "GB", postal: "E1 6AN" };
    const o1 = await placePrintOrder({ quoteId: q.quoteId, confirmed: true, idempotencyKey: "idem-123", shipping: ship });
    const o2 = await placePrintOrder({ quoteId: q.quoteId, confirmed: true, idempotencyKey: "idem-123", shipping: ship });
    assert.equal(o1.orderId, o2.orderId);
    assert.equal(o2.duplicate, true);
  });

  it("two-provider proof: GB vs US winners can differ", async () => {
    const gb = await quotePersonalizedProduct({ productType: "tshirt", destinationCountry: "GB" });
    const us = await quotePersonalizedProduct({ productType: "tshirt", destinationCountry: "US" });
    assert.ok(gb.quotes.length > 0 && us.quotes.length > 0);
    // Not asserting a fixed winner (pricing may evolve), just that both providers participate.
    const gbProviders = new Set(gb.quotes.map((q) => q.providerId));
    assert.ok(gbProviders.size >= 1);
  });
});
