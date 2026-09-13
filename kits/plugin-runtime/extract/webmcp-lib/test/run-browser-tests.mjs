import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findChrome } from "./chrome-executable.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
};

class CdpClient {
  #nextId = 1;
  #pending = new Map();

  constructor(socket) {
    this.socket = socket;
    socket.addEventListener("message", async (event) => {
      const text = typeof event.data === "string"
        ? event.data
        : await event.data.text();
      const message = JSON.parse(text);
      if (!message.id) return;
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  return new CdpClient(socket);
}

async function waitForDevTools(child) {
  let stderr = "";
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Timed out waiting for Chrome DevTools: ${stderr.slice(-1000)}`,
        ),
      );
    }, 10_000);

    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve({ browserWebSocketUrl: match[1], stderr });
      }
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Chrome exited ${code}: ${stderr.slice(-1000)}`));
    });
  });
}

async function evaluateValue(client, expression) {
  const evaluation = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (evaluation.exceptionDetails) {
    throw new Error(
      evaluation.exceptionDetails.text || "Browser evaluation failed",
    );
  }
  return evaluation.result?.value;
}

async function waitFor(client, expression, description) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const value = await evaluateValue(client, expression);
      if (value) return value;
    } catch {
      // Navigation may replace the execution context between polling attempts.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function browserResult(client) {
  return await waitFor(
    client,
    `(() => {
      const element = document.querySelector('#result');
      return element && ['passed', 'failed'].includes(element.dataset.status)
        ? { status: element.dataset.status, text: element.textContent }
        : null;
    })()`,
    "browser assertions",
  );
}

async function captureScreenshot(client, outputPath) {
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(outputPath, Buffer.from(screenshot.data, "base64"));
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    const file = path.resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
      throw new Error("Invalid path");
    }
    const body = await readFile(file);
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(file)] ||
        "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

let child;
let profile;
let client;
try {
  const chrome = await findChrome();
  profile = await mkdtemp(path.join(tmpdir(), "webmcp-chrome-"));
  child = spawn(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  const { browserWebSocketUrl } = await waitForDevTools(child);
  const endpoint = new URL(browserWebSocketUrl);
  const targets = await fetch(
    `http://${endpoint.host}/json/list`,
  ).then((response) => response.json());
  const page = targets.find((target) => target.type === "page");
  if (!page?.webSocketDebuggerUrl) {
    throw new Error("Chrome page target not found");
  }

  client = await connectCdp(page.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const evidenceDir = path.join(root, "evidence");
  const beforeScreenshot = path.join(evidenceDir, "browser-before.png");
  const afterScreenshot = path.join(evidenceDir, "browser-after.png");
  await mkdir(evidenceDir, { recursive: true });

  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/test/browser.html?evidence=1`;
  await client.send("Page.navigate", { url });
  await waitFor(
    client,
    "document.body?.dataset.evidencePhase === 'before'",
    "the before-registration evidence state",
  );
  await captureScreenshot(client, beforeScreenshot);

  await evaluateValue(client, "window.__continueWebMcpTest?.()");
  const result = await browserResult(client);
  await waitFor(
    client,
    "document.body?.dataset.evidencePhase === 'after' || document.body?.dataset.evidencePhase === 'failed'",
    "the after-registration evidence state",
  );
  await captureScreenshot(client, afterScreenshot);

  if (result.status !== "passed") {
    throw new Error(`Browser assertions failed: ${result.text}`);
  }
  console.log(`real-CDP functional test passed: ${result.text}`);
  console.log(
    `visual evidence written: ${path.relative(root, beforeScreenshot)}, ${
      path.relative(root, afterScreenshot)
    }`,
  );
} finally {
  client?.socket.close();
  if (child && child.exitCode === null) child.kill("SIGTERM");
  if (child && child.exitCode === null) {
    await new Promise((resolve) => child.once("close", resolve));
  }
  if (profile) await rm(profile, { recursive: true, force: true });
  await new Promise((resolve) => server.close(resolve));
}
