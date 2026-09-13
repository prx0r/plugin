# Stripe MCP Server

[← Back to Awesome ChatGPT Apps](../README.md)

![Stripe MCP Server](https://img.shields.io/badge/mcp-use-canary-blue)

A production-ready Model Context Protocol (MCP) server for Stripe integration and payments, **built with [mcp-use](https://github.com/mcp-use/mcp-use)**. This server provides interactive tools and beautiful React widgets for listing products and processing payments through Stripe checkout.

## 🚀 Built with mcp-use

This MCP server is powered by **[mcp-use](https://github.com/mcp-use/mcp-use)**, a modern framework for building MCP servers with:

- **Type-safe server creation** - Build MCP servers with full TypeScript support
- **React widget support** - Create interactive UI components using the OpenAI Apps SDK
- **Simplified client connections** - Easily connect to other MCP servers
- **Built-in development tools** - Hot reload, build, and deploy commands
- **Zero boilerplate** - Focus on your tools, not infrastructure

## Features

- 💳 **Stripe Integration** - Full Stripe checkout session creation
- 🛍️ **Product Listing** - Display products from your Stripe account
- 🎨 **Interactive Widgets** - Beautiful React widgets for product selection
- 🔐 **Secure Payments** - Uses Stripe's secure checkout flow
- 🌙 **Theme Support** - Automatic dark/light mode detection
- 📦 **Type Safety** - Full TypeScript with Zod validation

## Prerequisites

- Node.js 18+ and yarn (or npm)
- A Stripe account ([sign up here](https://stripe.com))
- Stripe API keys ([get them here](https://dashboard.stripe.com/apikeys))

## Installation

```bash
# Install dependencies
yarn install
# or
npm install
```

## Configuration

1. Copy the environment example file:
```bash
cp .env.example .env
```

2. Set the following required environment variables:

```bash
# Required: Your Stripe Secret Key
# Get from: https://dashboard.stripe.com/apikeys
# Use test keys (sk_test_...) for development
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here

# Required for production: MCP Server Base URL
# Used for widget URLs and CSP configuration
MCP_URL=https://your-domain.com

# Optional: Content Security Policy URLs
# For static deployments where widgets are served from different domains
CSP_URLS=https://your-domain.com,https://cdn.example.com
```

### Setting up Stripe

1. **Create a Stripe account** at [stripe.com](https://stripe.com)
2. **Get your API keys** from the [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
3. **Create products** in your Stripe dashboard:
   - Go to Products → Add Product
   - Set name, description, and price
   - Save the product (it will have a default price)
4. **Use test mode** for development:
   - Test keys start with `sk_test_`
   - Use test card numbers: `4242 4242 4242 4242`

## Development

[mcp-use](https://github.com/mcp-use/mcp-use) provides convenient development commands:

```bash
# Start development server with hot reload
yarn dev
# or
npm run dev

# Build for production
yarn build
# or
npm run build

# Start production server
yarn start
# or
npm start

# Deploy the server
yarn deploy
# or
npm run deploy
```

The development server starts:
- MCP server on port 3000
- Widget serving at `/mcp-use/widgets/*`
- Inspector UI at `/inspector`

## Available Tools

### `list-products`

List all active products from your Stripe account. Opens an interactive product display widget.

**Parameters:** None

**Widget:** `products-display` - Interactive product browser with quantity selection

**Example:**
```typescript
await client.callTool('list-products', {});
```

### `buy-products`

Create a Stripe checkout session for the selected products. Returns a checkout URL that opens in Stripe's secure checkout page.

**Parameters:**
- `items` (required): Array of checkout items
  - `priceId` (string): The Stripe price ID to purchase
  - `quantity` (number): How many units to purchase (minimum 1)

**Example:**
```typescript
await client.callTool('buy-products', {
  items: [
    { priceId: 'price_1234567890', quantity: 2 },
    { priceId: 'price_0987654321', quantity: 1 }
  ]
});
```

**Returns:**
- `checkoutSessionUrl`: URL to Stripe checkout page
- `checkoutSessionId`: Stripe session ID for tracking

## UI Widgets

This server includes a custom React widget built with [mcp-use](https://github.com/mcp-use/mcp-use):

### Products Display (`products-display`)

An interactive widget for browsing and purchasing products:

- **Product Listing** - Displays all products from Stripe
- **Quantity Selection** - Set quantities for each product
- **Checkout Integration** - Creates Stripe checkout sessions
- **External Link Opening** - Opens Stripe checkout in new window
- **Theme Support** - Automatically adapts to dark/light mode
- **Error Handling** - User-friendly error messages

The widget is built with:
- React 19
- Tailwind CSS
- Zod validation
- OpenAI Apps SDK hooks

## Architecture

This server demonstrates the power of [mcp-use](https://github.com/mcp-use/mcp-use):

- **Server-side**: Uses [`mcp-use/server`](https://github.com/mcp-use/mcp-use) to create tools and widgets
- **Client-side**: Uses [`mcp-use/react`](https://github.com/mcp-use/mcp-use) for widget hooks
- **Type-safe**: Full TypeScript support with Zod schemas
- **Stripe Integration**: Direct Stripe API calls for products and checkout

### Data Flow

```
User → ChatGPT → MCP Server → list-products tool
                              ↓
                         Stripe API
                              ↓
                         Widget Display
                              ↓
                    User selects products
                              ↓
                    buy-products tool
                              ↓
                    Stripe Checkout Session
                              ↓
                    External Checkout URL
```

## Project Structure

```
stripe/
├── index.ts                 # Main server file with tools
├── lib/
│   ├── stripe.ts           # Stripe integration utilities
│   └── base-url.ts         # Base URL helper
├── resources/
│   ├── products-display.tsx # Products widget component
│   └── styles.css          # Global widget styles
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript configuration
├── .env.example            # Environment variables template
└── README.md               # This file
```

## Deployment

### Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Other Platforms

The server can be deployed to any Node.js hosting platform:
- Railway
- Render
- Fly.io
- AWS Lambda (with adapter)
- Google Cloud Run

Make sure to set the `MCP_URL` environment variable to your production URL.

## Usage in ChatGPT

1. Deploy your application and get the MCP endpoint URL (e.g., `https://your-app.vercel.app/mcp`)
2. In ChatGPT, go to `Apps & Connectors` → `Advanced Settings` and enable developer mode
3. Create Connector:
   - Go to `Apps & Connectors` and click `Create`
   - Enter a name for your connector
   - Enter your MCP server URL
   - Select `No Authentication` (or configure auth if needed)
   - Accept the terms and conditions
   - Click `Create`
4. Create a new chat and use the `/` command to access the connector
5. Try: "List products" or "Show me what's available for purchase"

## Error Handling

The server includes comprehensive error handling:

- **Stripe API Errors**: Gracefully handled with user-friendly messages
- **Missing Configuration**: Clear error messages for missing environment variables
- **Invalid Input**: Zod validation ensures type safety
- **Network Errors**: Retry logic and fallback messages

## Security Best Practices

- ✅ Never commit `.env` files
- ✅ Use test keys for development
- ✅ Rotate API keys regularly
- ✅ Use environment variables for all secrets
- ✅ Enable Stripe webhooks for production (optional)
- ✅ Validate all user input with Zod

## Troubleshooting

### Products not loading

- Check your `STRIPE_SECRET_KEY` is set correctly
- Verify products exist in your Stripe dashboard
- Ensure products are marked as "Active"
- Check browser console for errors

### Checkout not working

- Verify Stripe keys are correct (test vs live)
- Check that price IDs are valid
- Ensure `MCP_URL` is set correctly for production
- Check Stripe dashboard for API errors

### Widget not displaying

- Verify server is running (`yarn dev`)
- Check that widget is in `resources/` folder
- Ensure `widgetMetadata` is exported
- Check browser console for errors

## License

MIT

## Learn More

- [mcp-use Documentation](https://docs.mcp-use.com)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [OpenAI Apps SDK](https://platform.openai.com/docs/apps)
- [MCP Protocol](https://modelcontextprotocol.io)
