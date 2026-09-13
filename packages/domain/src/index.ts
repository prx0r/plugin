// Canonical domain model — Phase 1 (northstar.md)
// Provider-specific IDs must never leak into user-facing semantics
// except as diagnostic metadata.

export type ProductCategory =
  | "apparel"
  | "drinkware"
  | "wall_art"
  | "paper"
  | "tote"
  | "gift";

export type ProductType =
  | "tshirt"
  | "hoodie"
  | "mug"
  | "poster"
  | "framed_print"
  | "greeting_card"
  | "tote_bag";

export type QualityTier = "economy" | "standard" | "premium";
export type Fit = "unisex" | "fitted" | "relaxed" | "kids" | "one_size";
export type PrintMethod = "dtg" | "screen" | "sublimation" | "giclee" | "digital" | "embroidery";

export interface PrintArea {
  id: string; // e.g. "front", "back", "full_wrap"
  widthMm: number;
  heightMm: number;
  /** Minimum effective DPI required, e.g. 150 */
  minDpi: number;
  /** Whether transparency is required (e.g. DTG on dark garment) */
  requiresTransparency?: boolean;
}

export interface CanonicalProduct {
  id: string; // e.g. "tee_unisex_heavyweight"
  category: ProductCategory;
  type: ProductType;
  name: string; // user-facing, e.g. "Premium heavyweight tee"
  fit: Fit;
  qualityTier: QualityTier;
  material: { primary: string; blend?: string };
  weightGsm?: number;
  colors: string[]; // canonical color families, e.g. ["cream","black","white"]
  sizes: string[];
  printAreas: PrintArea[];
  printMethods: PrintMethod[];
}

export interface ProductVariant {
  canonicalProductId: string;
  color: string;
  size: string;
}

export interface ShippingOption {
  method: string; // e.g. "standard", "express"
  cost: number;
  currency: string;
  etaMinDays: number;
  etaMaxDays: number;
  carrier?: string;
  fulfillmentCountry?: string;
}

export interface ProviderCandidate {
  providerId: string; // "prodigi" | "printful" | ...
  providerProductRef: string; // opaque supplier ref, never user-facing
  providerVariantRef?: string;
  canonicalProductId: string;
  color: string;
  size: string;
  // Adapter-supplied signals; router normalizes.
  unitCost: number;
  currency: string;
  fulfillmentCountry?: string;
  qualityScore?: number; // 0..1 if known
  reliabilityScore?: number; // 0..1 if known
}

export interface ProviderQuote {
  providerId: string;
  providerQuoteId?: string;
  canonicalProductId: string;
  variant: ProductVariant;
  productionCost: number;
  shippingCost: number;
  taxEstimate?: number;
  currency: string;
  shipping: ShippingOption;
  fulfillmentCountry?: string;
  qualityScore: number; // 0..1
  qualityConfidence: number; // 0..1
  reliabilityScore: number; // 0..1
}

export interface Quote {
  quoteId: string;
  providerId: string;
  providerQuoteId?: string;
  canonicalProductId: string;
  productName: string;
  variant: ProductVariant;
  production: number;
  shipping: number;
  serviceFee: number;
  taxEstimate?: number;
  total: { amount: number; currency: string };
  estimatedDelivery: { min: string; max: string };
  qualityScore: number;
  qualityConfidence: number;
  label?: "Value" | "Recommended" | "Fastest" | "Premium";
  reason?: string;
  expiresAt: string; // ISO
  createdAt: string; // ISO
}

export type IntentPreset = "CHEAPEST" | "BALANCED" | "BEST_QUALITY" | "FASTEST" | "LOCAL";

export interface QuoteRequest {
  productType: ProductType;
  destinationCountry: string; // ISO-2, e.g. "GB"
  quantity?: number; // default 1
  colorPreferences?: string[];
  size?: string;
  qualityPreference?: "economy" | "balanced" | "premium";
  budget?: number;
  budgetCurrency?: string;
  deliveryDeadline?: string; // ISO date
  printAreas?: string[];
  intent?: IntentPreset;
}

export interface CanonicalProductSearch {
  desiredProduct?: string;
  productType?: ProductType;
  destinationCountry?: string;
  quantity?: number;
  colorPreferences?: string[];
  size?: string;
  qualityPreference?: "economy" | "balanced" | "premium";
  budget?: number;
  deliveryDeadline?: string;
}

export interface ArtworkRequirement {
  printAreaId: string;
  minWidthPx: number;
  minHeightPx: number;
  minDpi: number;
  acceptedFileTypes: string[];
  requiresTransparency?: boolean;
  bleedMm?: number;
  safeAreaNote?: string;
}

export interface PreparedArtwork {
  assetId: string;
  widthPx: number;
  heightPx: number;
  fileType: string;
  hasTransparency: boolean;
  effectiveDpi: Record<string, number>;
  warnings: string[];
  productionUrl?: string;
}

export type ArtworkStatus =
  | { status: "ok"; prepared: PreparedArtwork }
  | { status: "needs_user_decision"; problem: string; allowedActions: string[]; details?: Record<string, unknown> }
  | { status: "rejected"; code: FailureCode; message: string };

export interface OrderDraft {
  quoteId: string;
  assetId?: string;
  recipient: { name: string; country: string; postal?: string };
}

export interface Order {
  orderId: string;
  quoteId: string;
  providerId: string;
  providerOrderId?: string;
  status: "created" | "in_production" | "shipped" | "delivered" | "failed" | "cancelled";
  total: { amount: number; currency: string };
  createdAt: string;
  idempotencyKey: string;
}

export interface TrackingEvent {
  orderId: string;
  at: string;
  status: string;
  message?: string;
  carrier?: string;
  trackingNumber?: string;
}

export type FailureCode =
  | "NO_ELIGIBLE_PRODUCT"
  | "NO_PROVIDER_AVAILABLE"
  | "QUOTE_EXPIRED"
  | "ARTWORK_TOO_SMALL"
  | "INVALID_DESTINATION"
  | "DEADLINE_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PRICE_CHANGED"
  | "ADDRESS_INVALID"
  | "ORDER_FAILED";

export interface RoutingDecision {
  intent: IntentPreset;
  candidatesEvaluated: number;
  winner?: string;
  rankingVersion: string;
  weights: Record<string, number>;
  userSelectedRank?: number;
  at: string;
}

// Phase 2 — provider interface. No routing logic inside adapters.
export interface ProviderQuoteRequest extends QuoteRequest {
  candidate?: ProviderCandidate;
}

export interface ProviderOrderRequest {
  quote: ProviderQuote;
  assetUrl?: string;
  assetId?: string;
  shipping: {
    name: string;
    country: string;
    postal?: string;
    addressLine1?: string;
    city?: string;
    email?: string;
  };
  idempotencyKey: string;
}

export interface ProviderOrder {
  providerOrderId: string;
  status: string;
  trackingNumber?: string;
  carrier?: string;
}

export interface PrintProvider {
  readonly id: string;
  searchProducts(request: CanonicalProductSearch): Promise<ProviderCandidate[]>;
  getArtworkRequirements(candidate: ProviderCandidate): Promise<ArtworkRequirement[]>;
  quote(request: ProviderQuoteRequest): Promise<ProviderQuote[]>;
  createOrder(request: ProviderOrderRequest): Promise<ProviderOrder>;
  getOrder(providerOrderId: string): Promise<ProviderOrder>;
  cancelOrder?(providerOrderId: string): Promise<ProviderOrder>;
}

// V1 tiny catalog (Phase 3 scope): 8 canonical products.
export const CANONICAL_CATALOG: CanonicalProduct[] = [
  {
    id: "tee_unisex_standard",
    category: "apparel",
    type: "tshirt",
    name: "Standard tee",
    fit: "unisex",
    qualityTier: "standard",
    material: { primary: "cotton" },
    weightGsm: 150,
    colors: ["white", "black", "cream", "navy"],
    sizes: ["S", "M", "L", "XL"],
    printAreas: [{ id: "front", widthMm: 300, heightMm: 400, minDpi: 150 }],
    printMethods: ["dtg"],
  },
  {
    id: "tee_unisex_heavyweight",
    category: "apparel",
    type: "tshirt",
    name: "Premium heavyweight tee",
    fit: "unisex",
    qualityTier: "premium",
    material: { primary: "cotton" },
    weightGsm: 200,
    colors: ["cream", "black", "white", "faded_black"],
    sizes: ["S", "M", "L", "XL"],
    printAreas: [
      { id: "front", widthMm: 300, heightMm: 400, minDpi: 150 },
      { id: "back", widthMm: 300, heightMm: 400, minDpi: 150 },
    ],
    printMethods: ["dtg"],
  },
  {
    id: "hoodie_unisex_standard",
    category: "apparel",
    type: "hoodie",
    name: "Standard hoodie",
    fit: "unisex",
    qualityTier: "standard",
    material: { primary: "cotton", blend: "polyester" },
    colors: ["black", "grey", "cream"],
    sizes: ["S", "M", "L", "XL"],
    printAreas: [{ id: "front", widthMm: 300, heightMm: 350, minDpi: 150 }],
    printMethods: ["dtg"],
  },
  {
    id: "mug_standard_11oz",
    category: "drinkware",
    type: "mug",
    name: "Classic 11oz mug",
    fit: "one_size",
    qualityTier: "standard",
    material: { primary: "ceramic" },
    colors: ["white"],
    sizes: ["11oz"],
    printAreas: [{ id: "full_wrap", widthMm: 200, heightMm: 95, minDpi: 150 }],
    printMethods: ["sublimation"],
  },
  {
    id: "poster_a3",
    category: "wall_art",
    type: "poster",
    name: "A3 poster",
    fit: "one_size",
    qualityTier: "standard",
    material: { primary: "paper" },
    colors: ["white"],
    sizes: ["A3"],
    printAreas: [{ id: "full", widthMm: 297, heightMm: 420, minDpi: 150 }],
    printMethods: ["giclee", "digital"],
  },
  {
    id: "framed_print_a3",
    category: "wall_art",
    type: "framed_print",
    name: "Framed A3 print",
    fit: "one_size",
    qualityTier: "premium",
    material: { primary: "paper" },
    colors: ["white", "black_frame"],
    sizes: ["A3"],
    printAreas: [{ id: "full", widthMm: 297, heightMm: 420, minDpi: 200 }],
    printMethods: ["giclee"],
  },
  {
    id: "card_a6",
    category: "paper",
    type: "greeting_card",
    name: "A6 greeting card",
    fit: "one_size",
    qualityTier: "standard",
    material: { primary: "paper" },
    colors: ["white"],
    sizes: ["A6"],
    printAreas: [{ id: "front", widthMm: 105, heightMm: 148, minDpi: 200 }],
    printMethods: ["digital"],
  },
  {
    id: "tote_standard",
    category: "tote",
    type: "tote_bag",
    name: "Standard tote bag",
    fit: "one_size",
    qualityTier: "economy",
    material: { primary: "cotton" },
    colors: ["natural", "black"],
    sizes: ["one_size"],
    printAreas: [{ id: "front", widthMm: 280, heightMm: 280, minDpi: 150 }],
    printMethods: ["screen", "dtg"],
  },
];
