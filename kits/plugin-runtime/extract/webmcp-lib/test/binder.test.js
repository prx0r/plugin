import { exposeToWebMCP } from "../src/webmcp-binder.js";

const SOURCE = `
/**
 * Add two values.
 * @param {number} a First value
 * @param {number} b Second value
 */
function add(a, b = 1) {}
const app = {
  /**
   * Multiply by the application factor.
   * @param {number} value Value to multiply
   */
  async multiply(value) {},
  /** Throw an application error. @param {string} message Error message */
  explode(message = 'boom') {}
};`;

Deno.test("registers bound async tools, dedupes, and unregisters with abort signals", async () => {
  const registrations = [];
  const modelContext = {
    registerTool: (tool, options) =>
      registrations.push({ tool, signal: options.signal }),
  };
  const root = {
    add(a, b = 1) {
      return a + b;
    },
    parseInt,
    app: {
      factor: 4,
      async multiply(value) {
        await Promise.resolve();
        this.last = value * this.factor;
        return this.last;
      },
      explode(message = "boom") {
        throw new Error(message);
      },
    },
  };

  const options = {
    root,
    namespaces: ["app"],
    modelContext,
    sourceCode: SOURCE,
    usePromptFallback: false,
  };
  const tools = await exposeToWebMCP(options);
  const names = tools.map(({ name }) => name).sort();

  if (names.join(",") !== "add,app_explode,app_multiply") {
    throw new Error(`Unexpected tools: ${names}`);
  }
  if (names.includes("parseInt")) {
    throw new Error("Native builtin was registered");
  }

  const add = tools.find(({ name }) => name === "add");
  const multiply = tools.find(({ name }) => name === "app_multiply");
  if (add.inputSchema.additionalProperties !== false) {
    throw new Error("Schema is not closed");
  }
  if (add.inputSchema.properties.a.type !== "number") {
    throw new Error("JSDoc type missing");
  }
  if (
    add.inputSchema.properties.b.default !== 1 ||
    add.inputSchema.required.join(",") !== "a"
  ) {
    throw new Error("Default parameter schema is wrong");
  }
  if (await add.execute({ a: 5 }) !== 6) {
    throw new Error("Default argument execution failed");
  }
  if (await multiply.execute({ value: 3 }) !== 12 || root.app.last !== 12) {
    throw new Error("Async method binding failed");
  }

  const explode = tools.find(({ name }) => name === "app_explode");
  let error;
  try {
    await explode.execute({ message: "expected" });
  } catch (caught) {
    error = caught;
  }
  if (
    error?.name !== "WebMCPToolExecutionError" ||
    !error.message.includes("expected")
  ) {
    throw new Error("Tool error was not safely contextualized");
  }

  const duplicateTools = await exposeToWebMCP(options);
  if (registrations.length !== 3) {
    throw new Error("Duplicate tools were registered twice");
  }
  if (duplicateTools.find(({ name }) => name === "add") !== add) {
    throw new Error("Deduped tool identity changed");
  }

  if (tools.unregister() !== 3) throw new Error("Wrong unregister count");
  if (registrations.some(({ signal }) => !signal.aborted)) {
    throw new Error("Registration signal was not aborted");
  }

  await exposeToWebMCP(options);
  if (registrations.length !== 6) {
    throw new Error("Tools could not be registered after unregister");
  }
});

Deno.test("uses full namespace identity for same-named method JSDoc", async () => {
  const root = {
    alpha: {
      run(value) {
        return value;
      },
    },
    beta: {
      run(value) {
        return value;
      },
    },
  };
  const sourceCode = `
    const alpha = {
      /**
       * Alpha runner.
       * @param {number} value Alpha value
       */
      run(value) {}
    };
    const beta = {
      /**
       * Beta runner.
       * @param {string} value Beta value
       */
      run(value) {}
    };
  `;
  const tools = await exposeToWebMCP({
    root,
    namespaces: ["alpha", "beta"],
    modelContext: { registerTool() {} },
    sourceCode,
    usePromptFallback: false,
  });
  const alpha = tools.find(({ name }) => name === "alpha_run");
  const beta = tools.find(({ name }) => name === "beta_run");

  if (
    alpha.description !== "Alpha runner." ||
    alpha.inputSchema.properties.value.type !== "number" ||
    beta.description !== "Beta runner." ||
    beta.inputSchema.properties.value.type !== "string"
  ) {
    throw new Error("Namespace JSDoc was not independently selected");
  }
  tools.unregister();
});

Deno.test("dedupes concurrent registration atomically and retries after failure", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  const modelContext = {
    async registerTool() {
      attempts++;
      await gate;
    },
  };
  const root = {
    ping(value) {
      return value;
    },
  };
  const options = {
    root,
    modelContext,
    sourceCode: "",
    usePromptFallback: false,
    logger: { warn() {} },
  };

  const first = exposeToWebMCP(options);
  const concurrent = exposeToWebMCP(options);
  await Promise.resolve();
  if (attempts !== 1) {
    throw new Error(`Concurrent calls made ${attempts} registration attempts`);
  }
  release();
  const [firstTools, concurrentTools] = await Promise.all([first, concurrent]);
  if (
    firstTools[0] !== concurrentTools[0] ||
    firstTools[0]?.name !== "ping"
  ) {
    throw new Error("Concurrent callers did not share the reserved tool");
  }
  firstTools.unregister();

  let retryAttempts = 0;
  const retryContext = {
    registerTool() {
      retryAttempts++;
      if (retryAttempts === 1) throw new Error("temporary failure");
    },
  };
  const retryOptions = { ...options, modelContext: retryContext };
  const failed = await exposeToWebMCP(retryOptions);
  const retried = await exposeToWebMCP(retryOptions);
  if (failed.length !== 0 || retried.length !== 1 || retryAttempts !== 2) {
    throw new Error("Failed registration reservation was not rolled back");
  }
  retried.unregister();
});

Deno.test("uses injected inference and closes its schema for minified functions", async () => {
  const registered = [];
  const modelContext = { registerTool: (tool) => registered.push(tool) };
  let inferenceCalls = 0;
  const root = { m: (a) => a * 2 };
  const tools = await exposeToWebMCP({
    root,
    modelContext,
    sourceCode: "",
    inferFunction: () => {
      inferenceCalls++;
      return {
        description: "Double a number",
        schema: {
          type: "object",
          properties: { a: { type: "number" }, invented: { type: "string" } },
          required: ["a", "invented"],
        },
      };
    },
  });

  if (inferenceCalls !== 1 || tools[0].description !== "Double a number") {
    throw new Error("Inference seam not used");
  }
  if (tools[0].inputSchema.properties.invented) {
    throw new Error("Inferred argument widened the signature");
  }
  if (tools[0].inputSchema.additionalProperties !== false) {
    throw new Error("Inferred schema is not closed");
  }
  if (await tools[0].execute({ a: 4 }) !== 8) {
    throw new Error("Inferred tool did not execute");
  }
  tools.unregister();
});
