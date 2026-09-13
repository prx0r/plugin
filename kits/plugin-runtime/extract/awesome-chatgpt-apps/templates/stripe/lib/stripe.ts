import Stripe from "stripe";
import { getBaseUrl } from "./base-url";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia",
});

export type CheckoutItem = { priceId: string; quantity: number };

export async function getCheckoutSession(items: CheckoutItem[]) {
  // Merge duplicate priceIds so Stripe receives a single line item per price.
  const quantityByPriceId = items.reduce<Record<string, number>>(
    (acc, { priceId, quantity }) => {
      const safeQuantity = Math.max(1, Math.floor(quantity));
      acc[priceId] = (acc[priceId] ?? 0) + safeQuantity;
      return acc;
    },
    {}
  );

  const url = getBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: Object.entries(quantityByPriceId).map(
      ([priceId, quantity]) => ({
        price: priceId,
        quantity,
      })
    ),
    success_url: `${url}/success`,
    cancel_url: `${url}/cancel`,
  });

  return session;
}

export type FormattedProduct = {
  id: string;
  priceId: string;
  image: string | null;
  name: string;
  description: string | null;
  price: number;
};

export async function getProducts(): Promise<FormattedProduct[]> {
  const { data: products } = await stripe.products.list({
    active: true,
  });
  
  const { data: prices } = await stripe.prices.list({
    active: true,
  });

  // Map products to their default prices
  const priceMap = new Map(prices.map((price) => [price.id, price]));

  return products
    .map((product) => {
      const defaultPriceId =
        typeof product.default_price === "string"
          ? product.default_price
          : product.default_price?.id;

      if (!defaultPriceId) {
        return null;
      }

      const price = priceMap.get(defaultPriceId);
      const amount = price?.unit_amount || 0;

      return {
        id: product.id,
        priceId: defaultPriceId,
        image: product.images?.[0] || null,
        name: product.name,
        description: product.description,
        price: amount / 100, // Convert from cents to dollars
      };
    })
    .filter((product): product is FormattedProduct => product !== null);
}
