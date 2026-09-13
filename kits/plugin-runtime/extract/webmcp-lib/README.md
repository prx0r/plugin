# webmcp-lib

A small, dependency-free JavaScript library that discovers developer-defined page functions and exposes them as [WebMCP](https://github.com/GoogleChromeLabs/webmcp-tools) tool calls.

## What it does

- Enumerates own page functions without invoking getters or walking browser/DOM prototypes.
- Optionally traverses explicitly named, plain-object namespaces.
- Extracts positional parameters, rest parameters, serializable defaults, and JSDoc descriptions/types.
- Generates closed JSON Schemas (`additionalProperties: false`).
- Preserves the receiver for object methods and awaits synchronous or asynchronous results.
- Registers tools with `document.modelContext.registerTool()` and an `AbortSignal` lifecycle.
- Deduplicates repeated registration and exposes an unregister helper.
- Optionally asks Chrome's Prompt API for metadata when an undocumented function looks minified.

## Usage

```html
<script src="./webmcp-polyfill.js"></script>
<script type="module">
  import { exposeToWebMCP } from './src/index.js';

  window.shop = {
    taxRate: 0.2,

    /**
     * Calculate a price including tax.
     * @param {number} price Price before tax
     * @param {integer} [quantity=1] Number of items
     * @returns {number} Total price
     */
    total(price, quantity = 1) {
      return price * quantity * (1 + this.taxRate);
    }
  };

  const tools = await exposeToWebMCP({
    root: window,
    namespaces: ['shop']
  });

  // Later: WebMCP unregisters each tool when its registration signal aborts.
  tools.unregister();
</script>
```

`document.modelContext` is experimental and should be feature-detected. `exposeToWebMCP()` returns an empty array when `registerTool` is unavailable. Native WebMCP requires a secure context.

## Options

```js
await exposeToWebMCP({
  root: window,                 // Defaults to window (or globalThis outside a browser).
  namespaces: ['shop'],        // Optional paths to plain-object namespaces.
  maxDepth: 0,                 // Additional plain-object depth; default is no implicit traversal.
  modelContext: document.modelContext,
  usePromptFallback: true,     // Disable to avoid Prompt API inference.
  promptAPI: LanguageModel,    // Injectable Prompt API-compatible implementation.
  inferFunction: customInfer,  // Lower-level deterministic inference seam.
  sourceCode: knownSource      // Optional source override, useful in tests.
});
```

A namespace can also be supplied directly when it is not reachable by name:

```js
namespaces: [{ name: 'shop', root: shopObject }]
```

Functions with destructured top-level parameters are skipped because an object tool input cannot be mapped to them safely. Function failures reject with a `WebMCPToolExecutionError` whose message identifies the tool; the original failure is available as `cause`.

## Prompt API fallback

For undocumented, minified-looking functions, the library feature-detects the current `LanguageModel` Prompt API and the older `window.ai.languageModel` shape. It requests structured JSON output, closes the inferred schema, discards invented parameter names, and destroys the session after use. If the API is absent, unavailable, or errors, deterministic source-derived metadata is used instead.

Tests can inject a fake without browser AI hardware:

```js
const fakePromptAPI = {
  availability: async () => 'available',
  create: async () => ({
    prompt: async () => JSON.stringify({
      description: 'Double a number',
      schema: {
        type: 'object',
        properties: { a: { type: 'number' } },
        required: ['a']
      }
    }),
    destroy() {}
  })
};
```

## Demos and tests

- [Live discovery and registration](./examples/discovery.html) visibly calls registered tools and updates state.
- [Calculator](./examples/calculator.html)
- [Todo list](./examples/todo.html)
- [Namespaced API](./examples/namespaced.html)
- [Browser test harness](./test/harness.html)

Run unit tests with Deno and functional tests in an installed Chrome/Chromium browser:

```sh
deno test
node test/run-browser-tests.mjs
```

The functional test drives headless Chrome over CDP, loads the bundled `document.modelContext` polyfill, discovers real page functions, invokes them through the registered model-context callback, validates schemas/results/mutation/error behavior, proves unregister removes the tools, and asserts that browser builtins are absent. Set `CHROME_BIN` to override executable discovery.

That same CDP run also pauses at the verified pre-registration state and captures a deterministic 1280×900 viewport before continuing through registration, invocation, and unregister. It overwrites these committed visual acceptance artifacts on every run:

- [`evidence/browser-before.png`](./evidence/browser-before.png) — zero registered tools and no callbacks run.
- [`evidence/browser-after.png`](./evidence/browser-after.png) — registered tool names, callback return/state values, and the final unregister result.
