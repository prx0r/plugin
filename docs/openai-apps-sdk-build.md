# Building with the Apps SDK — working reference (distilled 2026-09-13)

Sources: quickstart + build-mcp-server + submission + review docs (see openai-docs-index.md).
Installed here: `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps` + `zod` in apps/mcp.

## Mental model

Plugins = skills + MCP server + optional UI, published once to the universal
Plugin directory shared by ChatGPT and Codex. The MCP server is the backbone:
tools the model calls, structured results the model reasons over, optional UI
resources rendered in ChatGPT. Old 2023 plugins (ai-plugin.json) are
deprecated; custom GPTs retire Dec 2026 — this is the only lane that matters.

## Server mechanics

- One MCP server, streamable HTTP transport, stable public HTTPS URL ending in
  `/mcp`. Stateless mode is fine to start (`sessionIdGenerator: undefined`,
  `enableJsonResponse: true`).
- Server identity: `new McpServer({ name, version })` + cross-tool
  `instructions` (keep the critical part in the first 512 chars; e.g. required
  tool sequences, rate limits). Never personality.
- Tools via `registerAppTool` (ext-apps) or `registerTool` (SDK): name, title,
  description (user-intent language), zod inputSchema, zod outputSchema,
  annotations, handler returning `{ structuredContent, content }`.
- UI resources via `registerAppResource` with `ui://widget/*.html` URIs; link
  tools with `_meta.ui.resourceUri`. ChatGPT implements the open MCP Apps
  standard (JSON-RPC over postMessage: `ui/initialize`, `tools/call`,
  `ui/notifications/tool-result`). Use the standard bridge first; `window.openai`
  only for ChatGPT-only extensions (checkout, file picking, modals, fullscreen).
- GET `/` health check + CORS preflight on `/mcp` keep iteration clean.
- Test loop: MCP Inspector (`npx @modelcontextprotocol/inspector`, Streamable
  HTTP) → developer-mode connector in ChatGPT (Settings → Security → Developer
  mode → Plugins → + → https URL + /mcp) → refresh connection after every
  metadata change → run direct/indirect/edge/out-of-scope prompts from the
  use-case inventory.

## Annotations (must match actual behavior — reviewed)

- `readOnlyHint: true` only if the tool cannot change state. Our find/quote/
  preview/get tools: true. prepare (creates asset record): false. place_order: false.
- `openWorldHint: true` when touching public internet or open-ended entities —
  our provider quoting/emailing qualifies even though read-side. Bounded private
  workspace alone would be false.
- `destructiveHint: true` for irreversible sends/transactions. place_print_order
  sends a manufacturing order → arguably true; currently marked false in our
  stub — REVISIT before submission (argue: idempotent + explicit confirmation,
  but money/goods move, so true is the honest mark).
- Never rely on the model for auth decisions; enforce server-side every request.
  Treat all tool inputs as untrusted; validate, authorize, rate-limit expensive
  actions; keep secrets/PII/debug payloads out of results (`_meta` is hidden
  from the model but NOT a security boundary).
- Write actions need explicit confirmation in-server (we already require
  `confirmed: true` + valid non-expired quoteId + idempotency key — matches).

## Company-knowledge lane

Read-only tools with `readOnlyHint: true` plus standard `search`/`fetch`
schemas can make a plugin eligible as a company-knowledge source. Return
absolute user-openable URLs for citable sources. (Future: our catalog search
could qualify.)

## Submission checklist (portal: platform.openai.com/plugins)

Needs: org role with **Apps Management: Write**; verified developer/business
identity; listing (name, descriptions, logo, category, website/support/privacy/
terms URLs); Universal MCP URL (Template URLs only for approved trusted devs);
domain verification token at `/.well-known/openai-apps-challenge` on the MCP
host; CSP for UI fetch domains; Scan Tools → fix → rescan; starter prompts;
**5 positive + 3 negative test cases** (reviewer-runnable, demo creds with no
MFA); country availability; release notes + policy attestations.
Our Phase 11 eval suite maps directly onto the testing tab — keep building it.

## What this means for our two routers

- Pog Prints: conversational tools now; product-checkout conversion spec is the
  gated checkout lane to read next (mirrors local-services Get Quote pattern).
- Service router: conversational RFQ tools now (open lane); Get Quote button +
  business feed later via merchants-form approval, with our supplier graph as
  the feed. Booking stays in our `book_*` tool until the spec covers it.
