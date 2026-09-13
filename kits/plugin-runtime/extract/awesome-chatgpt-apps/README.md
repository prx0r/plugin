# Awesome ChatGPT Apps

> A curated list of production-ready MCP server templates built with [mcp-use](https://github.com/mcp-use/mcp-use) for creating ChatGPT Apps with interactive widgets and powerful integrations.

[![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

A collection of ready-to-use templates for building Model Context Protocol (MCP) servers that work seamlessly with ChatGPT's Apps SDK. Each template includes interactive React widgets, type-safe tools, and production-ready configurations.

## Contents

- [Database](#database)
- [Payments](#payments)
- [Contributing](#contributing)
- [License](#license)

## Database

### Supabase

**Interactive database exploration and querying for Supabase**

A powerful MCP server that provides interactive tools and beautiful React widgets for exploring and querying your Supabase database.

**Features:**
- 🔍 Database Schema Explorer - Browse all tables with an interactive UI
- 📊 Table Viewer - Display and explore table data with a beautiful data table widget
- 🔎 SQL Query Executor - Run read-only SQL queries and view results
- 🎨 React Widgets - Rich, interactive UI components built with React and Tailwind CSS
- 🔐 Secure Authentication - Uses Supabase Personal Access Tokens

**Quick Start:**
```bash
cd templates/supabase
yarn install
# Set ACCESS_TOKEN in .env
yarn dev
```

**Template:** [templates/supabase](./templates/supabase) | [Documentation](./templates/supabase/README.md)

**Built with:** [mcp-use](https://github.com/mcp-use/mcp-use) | ![mcp-use canary](https://img.shields.io/badge/mcp--use-canary-blue)

---

## Payments

### Stripe

**Stripe integration for payments and product management**

A production-ready MCP server for Stripe integration that provides interactive tools and beautiful React widgets for listing products and processing payments through Stripe checkout.

**Features:**
- 💳 Stripe Integration - Full Stripe checkout session creation
- 🛍️ Product Listing - Display products from your Stripe account
- 🎨 Interactive Widgets - Beautiful React widgets for product selection
- 🔐 Secure Payments - Uses Stripe's secure checkout flow
- 🌙 Theme Support - Automatic dark/light mode detection
- 📦 Type Safety - Full TypeScript with Zod validation

**Quick Start:**
```bash
cd templates/stripe
yarn install
# Set STRIPE_SECRET_KEY in .env
yarn dev
```

**Template:** [templates/stripe](./templates/stripe) | [Documentation](./templates/stripe/README.md)

**Built with:** [mcp-use](https://github.com/mcp-use/mcp-use) | ![mcp-use canary](https://img.shields.io/badge/mcp--use-canary-blue)

---

## What is mcp-use?

[mcp-use](https://github.com/mcp-use/mcp-use) is a modern framework for building MCP servers with:

- **Type-safe server creation** - Build MCP servers with full TypeScript support
- **React widget support** - Create interactive UI components using the OpenAI Apps SDK
- **Simplified client connections** - Easily connect to other MCP servers
- **Built-in development tools** - Hot reload, build, and deploy commands
- **Zero boilerplate** - Focus on your tools, not infrastructure

Learn more at [docs.mcp-use.com](https://docs.mcp-use.com)

## Using These Templates

Each template in this repository is a complete, production-ready MCP server that you can:

1. **Clone or copy** the template directory
2. **Install dependencies** with `yarn install` or `npm install`
3. **Configure** environment variables (see each template's README)
4. **Run** with `yarn dev` for development
5. **Deploy** to your preferred hosting platform

### Connecting to ChatGPT

1. Deploy your MCP server and get the endpoint URL (e.g., `https://your-app.vercel.app/mcp`)
2. In ChatGPT, go to `Apps & Connectors` → `Advanced Settings` and enable developer mode
3. Create a new Connector with your MCP server URL
4. Start using your custom ChatGPT App!

## Contributing

Contributions are welcome! To add a new template:

1. Create a new directory in `templates/` with your template name
2. Follow the structure of existing templates
3. Include a comprehensive README.md
4. Update this main README.md with your template
5. Submit a pull request

### Template Requirements

- Must use [mcp-use](https://github.com/mcp-use/mcp-use)
- Include interactive widgets (React components)
- Have comprehensive documentation
- Include `.env.example` file
- Be production-ready

## License

All templates in this repository are licensed under the MIT License unless otherwise specified in individual template directories.

## Related Projects

- [mcp-use](https://github.com/mcp-use/mcp-use) - The framework powering these templates
- [Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers) - Community MCP servers
- [Model Context Protocol](https://modelcontextprotocol.io) - The MCP specification

---

**Maintained by the mcp-use community** | [Report an issue](https://github.com/mcp-use/mcp-use/issues) | [Join Discord](https://discord.gg/XkNkSkMz3V)
