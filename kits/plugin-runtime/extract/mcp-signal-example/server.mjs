// Zero-dependency demo server for mcp-signal.
//
// It plays three roles at once so you can watch events flow end-to-end in a plain browser:
//   1. Static host      — serves the demo widget (index.html) and the built IIFE bundle.
//   2. Webhook receiver  — POST /webhook           (the DIRECT transport lands here).
//   3. MCP tool + server — POST /tool/record_signal (the BRIDGE transport lands here;
//                          it runs the SAME destination adapters via createSignalReceiver,
//                          exactly like a real MCP server's app-only tool handler would).
//
// Run with:  npm run example   (builds the package first, then starts this server)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { consoleAdapter, createSignalReceiver, signalToolDefinition } from '../dist/server.js';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);

// In-memory store the demo page polls via GET /events.
/** @type {Array<{via: string, event: string, timestamp: string, sessionId: string, properties: unknown}>} */
const store = [];
function record(via, event) {
  store.unshift({
    via,
    event: event.event,
    timestamp: event.timestamp,
    sessionId: event.context?.sessionId,
    properties: event.properties,
  });
  store.length = Math.min(store.length, 200);
  console.log(
    `  [${via}] ${event.event}`,
    event.properties && Object.keys(event.properties).length ? event.properties : '',
  );
}

// The bridge path forwards into a real receiver running the same adapter contract server-side.
const memoryAdapter = {
  name: 'memory',
  send(batch) {
    for (const event of batch) record('bridge', event);
  },
};
const receiver = createSignalReceiver({
  adapters: [consoleAdapter({ label: '[server]' }), memoryAdapter],
});

// This is the descriptor a real MCP server would register (app-only, model-invisible).
const tool = signalToolDefinition();
console.log(
  `\nRegistered app-only tool "${tool.name}" (visibility: ${JSON.stringify(tool._meta.ui.visibility)})`,
);

function send(res, status, body, contentType = 'application/json') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

async function serveFile(res, relativePath, contentType) {
  try {
    const content = await readFile(join(here, relativePath));
    send(res, 200, content, contentType);
  } catch {
    send(res, 404, 'Not found', 'text/plain');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === 'GET' && path === '/') {
    return serveFile(res, 'index.html', 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && path === '/mcp-signal.global.js') {
    return serveFile(res, '../dist/mcp-signal.global.js', 'text/javascript; charset=utf-8');
  }
  if (req.method === 'GET' && path === '/events') {
    return send(res, 200, JSON.stringify(store));
  }
  if (req.method === 'POST' && path === '/reset') {
    store.length = 0;
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  // DIRECT transport: the webhook adapter POSTs { sdk, sentAt, batch } as text/plain.
  if (req.method === 'POST' && path === '/webhook') {
    const raw = await readBody(req);
    try {
      const payload = JSON.parse(raw);
      for (const event of payload.batch ?? []) record('direct-webhook', event);
      return send(res, 200, JSON.stringify({ ok: true }));
    } catch {
      return send(res, 400, JSON.stringify({ error: 'invalid JSON' }));
    }
  }

  // BRIDGE transport: the demo's callTool POSTs the { events, sdk, sentAt } envelope here,
  // simulating host -> your MCP server's app-only tool -> createSignalReceiver.
  if (req.method === 'POST' && path === `/tool/${tool.name}`) {
    const raw = await readBody(req);
    try {
      const args = JSON.parse(raw);
      const result = await receiver.handleToolCall(args);
      return send(res, 200, JSON.stringify(result));
    } catch (err) {
      return send(res, 400, JSON.stringify({ error: String(err) }));
    }
  }

  send(res, 404, 'Not found', 'text/plain');
});

server.listen(PORT, () => {
  console.log(`\nmcp-signal demo running at  http://localhost:${PORT}`);
  console.log(
    'Open it, click around, and watch events arrive below (and in your browser console).\n',
  );
});
