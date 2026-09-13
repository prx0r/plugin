// A stand-in for `document.modelContext` so the demo runs without the WebMCP
// extension or Chrome flag. It mirrors the surface the extension exposes to
// the page: `registerTool(tool, { signal })` for registration, and
// `getTools()` / `executeTool(tool, argsJson)` so an in-page "agent" can
// discover and call tools the same way a real one would.
//
// It is never installed automatically over a real API: `installModelContextShim`
// is a no-op when `document.modelContext` already exists.
export function installModelContextShim() {
  if (typeof document === "undefined" || document.modelContext) return false;

  const tools = new Map();
  const notify = () => window.dispatchEvent(new CustomEvent("modelcontext:change"));

  const modelContext = {
    __isShim: true,

    registerTool(tool, options = {}) {
      if (!tool || typeof tool.name !== "string" || typeof tool.execute !== "function") {
        throw new TypeError("registerTool: a tool needs a string `name` and an `execute` function");
      }
      const { signal } = options;
      if (signal?.aborted) return;
      tools.set(tool.name, tool);
      // Aborting the signal is how WebMCP unregisters a tool.
      signal?.addEventListener(
        "abort",
        () => {
          if (tools.get(tool.name) === tool) {
            tools.delete(tool.name);
            notify();
          }
        },
        { once: true }
      );
      notify();
    },

    unregisterTool(name) {
      if (tools.delete(name)) notify();
    },

    async getTools() {
      return [...tools.values()].map(({ name, description, inputSchema, annotations }) => ({
        name,
        description,
        inputSchema,
        annotations,
      }));
    },

    // Matches the extension: takes the tool object (or its name) and the
    // arguments as a JSON string, resolves with the MCP result as a JSON string.
    async executeTool(toolOrName, args) {
      const name = typeof toolOrName === "string" ? toolOrName : toolOrName?.name;
      const tool = tools.get(name);
      if (!tool) throw new Error(`No registered tool named "${name}"`);
      const parsed =
        typeof args === "string" ? (args.trim() ? JSON.parse(args) : {}) : (args ?? {});
      const result = await tool.execute(parsed);
      return JSON.stringify(result);
    },
  };

  Object.defineProperty(document, "modelContext", {
    value: modelContext,
    configurable: true,
    enumerable: true,
  });
  notify();
  return true;
}
