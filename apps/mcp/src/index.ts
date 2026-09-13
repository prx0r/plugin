// MCP tool surface — Phase 7. Tiny semantic surface, no supplier ops.
// Annotations per OpenAI Apps SDK guidance: readOnlyHint / destructiveHint /
// openWorldHint / idempotentHint.
import { validateArtwork } from "@agentcom/artwork";
import { CANONICAL_CATALOG, type Quote } from "@agentcom/domain";
import { isQuoteExpired, routeQuoteRequest } from "@agentcom/router";
import { MemoryStore } from "@agentcom/db";
import { ProdigiProvider } from "@agentcom/prodigi";
import { PrintfulProvider } from "@agentcom/printful";

export interface ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  openWorldHint: boolean;
  idempotentHint?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  annotations: ToolAnnotations;
}

export const TOOLS: ToolDef[] = [
  {
    name: "find_printable_products",
    description:
      "Find suitable physical products for printing or personalizing an image, artwork, text, or custom design. Use when the user wants to make, print, order, personalize, or put a design/photo onto a physical item such as a T-shirt, hoodie, mug, poster, card, tote or gift.",
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "quote_personalized_product",
    description:
      "Compare current manufacturing options for a personalized physical product across available print providers. Use when the user wants price, delivery, quality, cheapest option, best option, or wants to choose where a custom item should be produced.",
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "prepare_print_design",
    description:
      "Validate and prepare an existing image or design for a selected printable product. Use after the user has chosen or created artwork and wants it printed.",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "preview_personalized_product",
    description:
      "Describe how artwork maps onto a printable product: print areas, minimum resolutions and finishes. Use when the user asks what a design will look like or where it prints on an item.",
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "place_print_order",
    description:
      "Place a previously quoted and explicitly approved personalized print order. Call only after the user has selected a specific quote/product and explicitly confirmed purchase.",
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true, idempotentHint: true },
  },
  {
    name: "get_print_order",
    description: "Get production, shipping and tracking status for an existing print order.",
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
];

const store = new MemoryStore();
const providers = [new ProdigiProvider(), new PrintfulProvider()];

/** find_printable_products: broad suitable categories, no supplier IDs. */
export function findPrintableProducts(args: {
  desiredProduct?: string;
  destinationCountry?: string;
  colorPreferences?: string[];
  size?: string;
  qualityPreference?: "economy" | "balanced" | "premium";
  budget?: number;
}): { products: { id: string; name: string; type: string; colors: string[]; sizes: string[] }[] } {
  const q = (args.desiredProduct ?? "").toLowerCase();
  const pool = CANONICAL_CATALOG.filter((p) => {
    if (!q) return true;
    if (q.includes("shirt") || q.includes("tee")) return p.type === "tshirt";
    if (q.includes("hoodie")) return p.type === "hoodie";
    if (q.includes("mug") || q.includes("cup")) return p.type === "mug";
    if (q.includes("poster")) return p.type === "poster";
    if (q.includes("frame")) return p.type === "framed_print";
    if (q.includes("card")) return p.type === "greeting_card";
    if (q.includes("tote") || q.includes("bag")) return p.type === "tote_bag";
    return true;
  });
  return {
    products: pool.map((p) => ({ id: p.id, name: p.name, type: p.type, colors: p.colors, sizes: p.sizes })),
  };
}

/** quote_personalized_product: concurrent provider quotes → normalized top-3. */
export async function quotePersonalizedProduct(args: {
  productType: "tshirt" | "hoodie" | "mug" | "poster" | "framed_print" | "greeting_card" | "tote_bag";
  destinationCountry: string;
  quantity?: number;
  colorPreferences?: string[];
  size?: string;
  qualityPreference?: "economy" | "balanced" | "premium";
  budget?: number;
  deliveryDeadline?: string;
  intent?: "CHEAPEST" | "BALANCED" | "BEST_QUALITY" | "FASTEST" | "LOCAL";
}): Promise<{ quotes: Quote[]; failures: string[] }> {
  const req = {
    productType: args.productType,
    destinationCountry: args.destinationCountry,
    quantity: args.quantity ?? 1,
    colorPreferences: args.colorPreferences,
    size: args.size,
    qualityPreference: args.qualityPreference,
    budget: args.budget,
    deliveryDeadline: args.deliveryDeadline,
    intent: args.intent,
  };
  const all = (
    await Promise.all(providers.map((p) => p.quote(req).catch(() => [])))
  ).flat();
  const result = routeQuoteRequest(req, all);
  for (const q of result.quotes) store.saveQuote(q, result.decision);
  return { quotes: result.quotes, failures: result.failures };
}

/** prepare_print_design: validate existing asset vs print area. */
export function preparePrintDesign(args: {
  widthPx: number;
  heightPx: number;
  fileType: string;
  hasTransparency: boolean;
  printAreaId?: string;
  canonicalProductId?: string;
}): unknown {
  const product = CANONICAL_CATALOG.find((p) => p.id === args.canonicalProductId) ?? CANONICAL_CATALOG[1];
  const area = product?.printAreas.find((a) => a.id === (args.printAreaId ?? "front")) ?? product?.printAreas[0];
  if (!product || !area) return { status: "rejected", code: "NO_ELIGIBLE_PRODUCT", message: "Unknown product." };
  const req = {
    printAreaId: area.id,
    minWidthPx: Math.round((area.widthMm / 25.4) * area.minDpi),
    minHeightPx: Math.round((area.heightMm / 25.4) * area.minDpi),
    minDpi: area.minDpi,
    acceptedFileTypes: ["png", "jpg", "pdf"],
    requiresTransparency: product.type === "tshirt",
  };
  return validateArtwork(
    { widthPx: args.widthPx, heightPx: args.heightPx, fileType: args.fileType, hasTransparency: args.hasTransparency },
    req,
  );
}

/** place_print_order: requires valid non-expired quoteId + explicit confirmation + idempotency. */
export async function placePrintOrder(args: {
  quoteId: string;
  confirmed: boolean;
  idempotencyKey: string;
  shipping?: { name: string; country: string; postal?: string; addressLine1?: string; city?: string; email?: string };
}): Promise<unknown> {
  if (!args.confirmed) {
    return { code: "ORDER_FAILED", message: "Explicit user confirmation required before manufacture." };
  }
  const row = store.getQuote(args.quoteId);
  if (!row) return { code: "QUOTE_EXPIRED", message: "Unknown or expired quote. Re-quote first." };
  if (isQuoteExpired(row.quote)) {
    return { code: "QUOTE_EXPIRED", message: "Quote expired. Re-quote for current pricing." };
  }
  if (!args.shipping?.name || !args.shipping?.country) {
    return { code: "ADDRESS_INVALID", message: "Recipient name and country required. Never infer address." };
  }
  // Idempotency: same key returns same order.
  const existing = store.idempotency.get(args.idempotencyKey);
  if (existing) {
    return { orderId: existing, duplicate: true };
  }
  const provider = providers.find((p) => p.id === row.quote.providerId) ?? providers[0];
  if (!provider) return { code: "NO_PROVIDER_AVAILABLE", message: "Provider unavailable." };
  const orderId = `ord_${Date.now().toString(36)}`;
  store.orders.set(orderId, {
    order: {
      orderId,
      quoteId: row.quote.quoteId,
      providerId: row.quote.providerId,
      status: "created",
      total: row.quote.total,
      createdAt: new Date().toISOString(),
      idempotencyKey: args.idempotencyKey,
    },
    quoteId: row.quote.quoteId,
    idempotencyKey: args.idempotencyKey,
    events: [{ at: new Date().toISOString(), status: "created" }],
  });
  store.idempotency.set(args.idempotencyKey, orderId);
  // Sandbox provider call (never production without opt-in).
  const pres = await provider.getOrder("healthcheck").catch(() => null);
  void pres;
  return { orderId, quoteId: row.quote.quoteId, providerId: row.quote.providerId, status: "created" };
}

/** get_print_order: status abstraction, never raw provider dumps. */
export function getPrintOrder(args: { orderId: string }): unknown {
  const row = store.orders.get(args.orderId);
  if (!row) return { code: "ORDER_FAILED", message: "Unknown order." };
  return { orderId: row.order.orderId, status: row.order.status, total: row.order.total, events: row.events };
}
