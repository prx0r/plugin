import { discoverFunctions } from "./discovery.js";
import { extractJSDoc, extractParameters } from "./parser.js";
import { generateSchema, normalizeInferredSchema } from "./schema-generator.js";
import { fetchAllSources } from "./source-fetcher.js";
import { inferWithAI } from "./ai-fallback.js";

const registrationsByContext = new WeakMap();
const lifecycleByTool = new WeakMap();

function contextRegistry(modelContext) {
  let registry = registrationsByContext.get(modelContext);
  if (!registry) {
    registry = new Map();
    registrationsByContext.set(modelContext, registry);
  }
  return registry;
}

function likelyMinified(fn, parameters) {
  let source = "";
  try {
    source = Function.prototype.toString.call(fn);
  } catch {
    return false;
  }
  const compact = !source.includes("\n") && source.length < 180;
  const terseNames = parameters.length > 0 &&
    parameters.every((parameter) => (parameter.name || "").length <= 2);
  return compact || terseNames;
}

function orderedArguments(parameters, input, toolName) {
  if (input == null) input = {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError(`Tool "${toolName}" expects an object argument`);
  }

  const values = [];
  for (const parameter of parameters) {
    const value = input[parameter.name];
    if (parameter.rest) {
      if (value === undefined) continue;
      if (!Array.isArray(value)) {
        throw new TypeError(
          `Rest parameter "${parameter.name}" for tool "${toolName}" must be an array`,
        );
      }
      values.push(...value);
    } else {
      values.push(value);
    }
  }
  return values;
}

function executionError(toolName, error) {
  const message = error instanceof Error ? error.message : String(error);
  const wrapped = new Error(`Tool "${toolName}" failed: ${message}`, {
    cause: error,
  });
  wrapped.name = "WebMCPToolExecutionError";
  return wrapped;
}

function attachCollectionLifecycle(tools) {
  Object.defineProperty(tools, "unregister", {
    configurable: false,
    enumerable: false,
    value: () => unregisterTools(tools),
  });
  return tools;
}

/** Abort registrations created by exposeToWebMCP. Returns the number removed. */
export function unregisterTools(tools) {
  const list = Array.isArray(tools) ? tools : [tools];
  let removed = 0;
  for (const tool of list) {
    const lifecycle = lifecycleByTool.get(tool);
    if (lifecycle && !lifecycle.controller.signal.aborted) {
      lifecycle.controller.abort();
      removed++;
    }
  }
  return removed;
}

export async function exposeToWebMCP(options = {}) {
  const root = options.root ?? globalThis.window ?? globalThis;
  const modelContext = options.modelContext ??
    globalThis.document?.modelContext;
  const logger = options.logger ?? console;

  if (!modelContext || typeof modelContext.registerTool !== "function") {
    logger?.warn?.(
      "webmcp-lib: document.modelContext.registerTool is not available.",
    );
    return attachCollectionLifecycle([]);
  }

  const discovered = discoverFunctions(root, {
    maxDepth: options.maxDepth ?? 0,
    namespaces: options.namespaces ?? [],
  });
  const sourceCode = options.sourceCode ?? await fetchAllSources();
  const inferFunction = options.inferFunction ?? inferWithAI;
  const registry = contextRegistry(modelContext);
  const registeredTools = [];

  for (const { name, toolName, path, fn, parent } of discovered) {
    if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(toolName)) continue;

    const parameters = extractParameters(fn);
    if (parameters.some((parameter) => !parameter.name)) {
      logger?.warn?.(
        `webmcp-lib: Skipping ${toolName}; destructured parameters are not safely mappable.`,
      );
      continue;
    }

    const existing = registry.get(toolName);
    if (existing) {
      if (
        existing.fn === fn && existing.parent === parent &&
        !existing.controller.signal.aborted
      ) {
        const existingTool = await existing.promise;
        if (existingTool) registeredTools.push(existingTool);
      } else {
        logger?.warn?.(
          `webmcp-lib: Tool name ${toolName} is already registered; duplicate skipped.`,
        );
      }
      continue;
    }

    // Reserve synchronously before inference or registerTool can yield. Concurrent
    // expose calls then share this promise rather than attempting registration.
    const controller = new AbortController();
    const reservation = { fn, parent, controller, promise: null, tool: null };
    registry.set(toolName, reservation);

    reservation.promise = (async () => {
      try {
        const jsdoc = extractJSDoc(path, sourceCode);
        let description = jsdoc?.description || `Call ${toolName}`;
        let inputSchema = generateSchema(parameters, jsdoc);

        if (
          !jsdoc && options.usePromptFallback !== false &&
          likelyMinified(fn, parameters)
        ) {
          const inferred = await inferFunction(
            name,
            Function.prototype.toString.call(fn),
            parameters.map(({ name }) => name),
            {
              promptAPI: options.promptAPI,
              logger,
            },
          );
          if (inferred) {
            description = inferred.description || description;
            inputSchema = normalizeInferredSchema(inferred.schema, parameters);
          }
        }

        const execute = async (input = {}) => {
          try {
            return await Reflect.apply(
              fn,
              parent,
              orderedArguments(parameters, input, toolName),
            );
          } catch (error) {
            throw executionError(toolName, error);
          }
        };
        const tool = { name: toolName, description, inputSchema, execute };
        reservation.tool = tool;

        controller.signal.addEventListener("abort", () => {
          if (registry.get(toolName) === reservation) registry.delete(toolName);
        }, { once: true });

        await modelContext.registerTool(tool, { signal: controller.signal });
        lifecycleByTool.set(tool, { controller, modelContext, toolName });
        return tool;
      } catch (error) {
        if (registry.get(toolName) === reservation) registry.delete(toolName);
        controller.abort();
        logger?.warn?.(
          `webmcp-lib: Failed to register tool ${toolName}`,
          error,
        );
        return null;
      }
    })();

    const tool = await reservation.promise;
    if (tool) registeredTools.push(tool);
  }

  return attachCollectionLifecycle(registeredTools);
}
