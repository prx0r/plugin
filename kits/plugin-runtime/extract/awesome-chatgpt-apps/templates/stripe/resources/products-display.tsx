"use client";

import React, { useState, useMemo, FormEvent, useEffect } from "react";
import { z } from "zod";
import { useWidget, type WidgetMetadata } from "mcp-use/react";

const productSchema = z.object({
  id: z.string(),
  priceId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  image: z.string().nullable(),
});

const propsSchema = z.object({
  products: z.array(productSchema),
});

export const widgetMetadata: WidgetMetadata = {
  description: "Display products available for purchase",
  inputs: propsSchema,
};

type Product = z.infer<typeof productSchema>;
type ProductsProps = z.infer<typeof propsSchema>;

type CheckoutItem = { priceId: string; quantity: number };

export default function ProductsDisplay() {
  const { props, callTool, openExternal, output, theme } =
    useWidget<ProductsProps>();
  const products = props.products || [];

  const [status, setStatus] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Access checkout URL from tool output (structuredContent)
  const checkoutData = useMemo(() => {
    if (output && typeof output === "object") {
      return output as {
        checkoutSessionUrl?: string;
        checkoutSessionId?: string;
      };
    }
    return null;
  }, [output]);

  const canCheckout = useMemo(
    () => products.some((product) => (quantities[product.priceId] ?? 0) > 0),
    [products, quantities]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const items: CheckoutItem[] = Object.entries(quantities)
      .map(([priceId, quantity]) => ({ priceId, quantity }))
      .filter((item) => item.quantity > 0);

    if (!items.length) {
      setStatus("Set a quantity for at least one product to continue.");
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const result = await callTool("buy-products", {
        items,
      });

      // Extract checkout URL from structured content
      const checkoutUrl = (result as any)?.structuredContent
        ?.checkoutSessionUrl;

      if (checkoutUrl) {
        setCheckoutUrl(checkoutUrl);
        setStatus("Checkout ready. Click the button below to continue.");
      } else {
        setStatus("No checkout URL returned. Please try again.");
      }
    } catch (error) {
      console.error("Failed to start checkout", error);
      setStatus("Failed to start checkout. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCheckout = () => {
    const url = checkoutUrl || checkoutData?.checkoutSessionUrl;
    if (url) {
      openExternal(url);
    } else {
      setStatus("Checkout URL not available yet. Please try again.");
    }
  };

  // Update checkoutUrl when output changes
  useEffect(() => {
    if (checkoutData?.checkoutSessionUrl && !checkoutUrl) {
      setCheckoutUrl(checkoutData.checkoutSessionUrl);
      setStatus("Checkout ready. Click the button below to continue.");
    }
  }, [checkoutData, checkoutUrl]);

  const isDark = theme === "dark";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Select products to purchase</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose the products you'd like to purchase and set quantities
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        {products.length ? (
          <div className="grid gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                className={`rounded-lg border p-4 ${
                  isDark
                    ? "border-gray-700 bg-gray-800"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    {product.description && (
                      <p
                        className={`mt-1 text-sm ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        {product.description}
                      </p>
                    )}
                    <p className="mt-2 text-lg font-medium">
                      ${product.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`quantity-${product.priceId}`}
                      className="sr-only"
                    >
                      Quantity for {product.name}
                    </label>
                    <input
                      id={`quantity-${product.priceId}`}
                      type="number"
                      min="0"
                      value={quantities[product.priceId] || 0}
                      onChange={(e) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [product.priceId]: parseInt(e.target.value) || 0,
                        }))
                      }
                      className={`w-20 rounded border px-2 py-1 ${
                        isDark
                          ? "border-gray-600 bg-gray-700 text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p
            className={`text-sm ${
              isDark ? "text-gray-400" : "text-gray-500"
            }`}
          >
            No products available
          </p>
        )}

        <button
          type={checkoutUrl ? "button" : "submit"}
          disabled={
            isSubmitting || (!checkoutUrl && (!products.length || !canCheckout))
          }
          onClick={checkoutUrl ? handleOpenCheckout : undefined}
          className="inline-flex w-full items-center justify-center rounded bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-black/90 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          {isSubmitting
            ? "Processing…"
            : checkoutUrl
            ? "Open checkout"
            : "Proceed to checkout"}
        </button>

        {status && (
          <p
            className={`text-sm ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}
            role="status"
          >
            {status}
          </p>
        )}
      </form>
    </main>
  );
}
