# WebMCP capability reference — domains.check

Short note to follow actualguide.md. Capability `domains.check` can be exposed as remote MCP, HTTP, web page, and WebMCP. The WebMCP surface is the website-side equivalent of remote MCP for agents already interacting with the page.

## Shared semantics

The canonical tool is `domains.check`. Any surface should expose the same logical tool and similar input/output semantics:
- input: `domain?`, `domains?`, `keywords?`, `maxResults?`
- output: `{ results: [{ domain, available, confidence, checkedAt, reason }], meta: { generatedAt } }`

The tool description should be:
`Check whether one or more domains are available to register and discover available name suggestions.`

That matches the ChatGPT-facing copy.

## WebMCP registration snippet

Use the JS snippet at `apps/web/public/domains.check.webmcp.js` on the capability landing page. It registers `domains.check` when the browser agent API is present, and falls back to `fetch('/v1/domains.check', ...)` for clients without the API.

## Remote MCP

Use `packages/mcp/` to expose the same `domains.check` tool over MCP. The canonical interface points are:
- Streamable HTTP endpoint: `POST /mcp`
- tool name: `domains.check`
- description + schemas: `packages/evals/capabilities/domains.check.json`

## REST skeleton

Capability-specific REST endpoints should live under:
- `POST /v1/domains.check` — capability call
- `GET /healthz` — liveness probe

OpenAPI skeleton: `docs/domains/openapi.json`.

## Production considerations

- Use `PUBLIC_BASE_URL` to form canonical metadata and discovery URLs; never trust `Host` headers behind proxies.
- Capability landing page should include a `capabilities.json` manifest and optionally `llms.txt` for agent-readable discovery.
- Confirm the tool's availability semantics: `available: true` means registrar-grade confirmation is preferred; RDAP-only results should use medium confidence or explicitly state the limitation.
