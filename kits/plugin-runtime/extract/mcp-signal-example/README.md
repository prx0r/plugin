# mcp-signal — runnable demo

A tiny, dependency-free demo that shows events flowing out of an instrumented "widget" through
**both** transports the SDK ships with.

## Run it

From the repository root:

```bash
npm install
npm run example
```

Then open **http://localhost:8787**.

`npm run example` builds the package first, then starts `example/server.mjs`.

## What you'll see

Click the buttons in the page. Each event is captured and sent through three adapters at once:

- **`consoleAdapter`** — logged to your **browser console** (open dev tools).
- **`webhookAdapter`** — the **direct** transport: POSTs straight to `/webhook`.
- **`bridgeAdapter`** — the **bridge** transport: hands the batch to a `callTool` that forwards to
  `/tool/record_signal`, which runs `createSignalReceiver` server-side — exactly what a real
  MCP server's app-only tool handler does.

The page polls the server and shows what each transport delivered, side by side. The **terminal**
running the server also logs every event it receives (that's the console adapter running
server-side, plus the demo's own logging).

You'll also see events you never wrote code for: `mcp_signal_loaded` and `mcp_signal_visible` fire on
load, and the "Throw an error" button produces an `mcp_signal_error`.

## How the bridge is wired here

A real widget gets its `callTool` from the host (`window.openai.callTool` on ChatGPT, or a
`tools/call` postMessage on MCP Apps). This page can't run inside a real host, so it injects a
`callTool` that `fetch`es the demo server — faithfully simulating **widget → host → your MCP
server → destination**. See `example/index.html` and `example/server.mjs`.

To point the bridge at a real analytics tool, swap the server's `memoryAdapter` for
`posthogAdapter({ apiKey, host })` in `example/server.mjs` — the widget code doesn't change.
