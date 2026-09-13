import { createMCPServer } from "mcp-use/server";
import { z } from "zod";
import { widget, text } from "mcp-use/server";
import { getProducts, getCheckoutSession, type CheckoutItem } from "./lib/stripe";

const server = createMCPServer("stripe", {
  version: "1.0.0",
  description: "MCP server for Stripe integration and payments",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
});

/**
 * AUTOMATIC UI WIDGET REGISTRATION
 * All React components in the `resources/` folder are automatically registered as MCP tools and resources.
 * Just export widgetMetadata with description and Zod schema, and mcp-use handles the rest!
 *
 * See docs: https://docs.mcp-use.com/typescript/server/ui-widgets
 */

/**
 * Tool: List products
 * Returns a widget displaying all available products from Stripe
 */
server.tool(
  {
    name: "list-products",
    description: "List the products available for purchase from Stripe",
    widget: {
      name: "products-display",
      invoking: "Loading products...",
      invoked: "Products loaded",
    },
  },
  async () => {
    try {
      const products = await getProducts();

      return widget({
        props: {
          products,
        },
        output: text(
          `Found ${products.length} product${products.length !== 1 ? "s" : ""} available for purchase`
        ),
      });
    } catch (error) {
      console.error("Failed to fetch products", error);
      return widget({
        props: {
          products: [],
        },
        output: text(
          "Unable to load products right now. Please check your Stripe configuration."
        ),
      });
    }
  }
);

/**
 * Tool: Buy products
 * Creates a Stripe checkout session for the selected products
 */
const buyProductsSchema = z.object({
  items: z
    .array(
      z.object({
        priceId: z.string().describe("The Stripe price ID to purchase"),
        quantity: z
          .number()
          .int()
          .min(1)
          .describe("How many units of this price to purchase"),
      })
    )
    .nonempty()
    .describe("The line items to include in checkout"),
});

server.tool(
  {
    name: "buy-products",
    description:
      "Create a checkout page link for purchasing the selected products",
    schema: buyProductsSchema,
  },
  async ({ items }) => {
    try {
      const session = await getCheckoutSession(items as CheckoutItem[]);

      return {
        content: [
          {
            type: "text",
            text: `Checkout session created. [Complete your purchase here](${session.url})`,
          },
        ],
        structuredContent: {
          checkoutSessionId: session.id,
          checkoutSessionUrl: session.url,
        },
      };
    } catch (error) {
      console.error("Failed to create checkout session", error);
      return {
        content: [
          {
            type: "text",
            text: "Unable to start checkout right now. Please try again.",
          },
        ],
        structuredContent: {},
      };
    }
  }
);

server.listen().then(() => {
  console.log(`Stripe MCP server running`);
});
