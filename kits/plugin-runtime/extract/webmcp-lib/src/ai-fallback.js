const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
    schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["object"] },
        properties: { type: "object" },
        required: { type: "array", items: { type: "string" } },
      },
      required: ["type", "properties"],
      additionalProperties: false,
    },
  },
  required: ["description", "schema"],
  additionalProperties: false,
};

function resolvePromptAPI(injected) {
  if (injected) return injected.languageModel || injected;
  if (typeof globalThis.LanguageModel !== "undefined") {
    return globalThis.LanguageModel;
  }
  if (globalThis.window?.ai?.languageModel) {
    return globalThis.window.ai.languageModel;
  }
  if (globalThis.navigator?.ai?.languageModel) {
    return globalThis.navigator.ai.languageModel;
  }
  return null;
}

async function isAvailable(api) {
  if (typeof api.availability === "function") {
    return (await api.availability()) !== "unavailable";
  }
  if (typeof api.capabilities === "function") {
    return (await api.capabilities()).available !== "no";
  }
  return typeof api.create === "function";
}

function parseResponse(response) {
  if (typeof response !== "string") return null;
  const cleaned = response.replace(/^```(?:json)?\s*/i, "").replace(
    /\s*```$/,
    "",
  ).trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed.description !== "string" || !parsed.schema) {
    return null;
  }
  return parsed;
}

/**
 * Infer metadata with the Prompt API. `options.promptAPI` is an injectable seam
 * for deterministic tests and for browser API revisions.
 */
export async function inferWithAI(fnName, fnString, paramNames, options = {}) {
  const api = resolvePromptAPI(options.promptAPI);
  if (!api || typeof api.create !== "function") return null;

  let session;
  try {
    if (!await isAvailable(api)) return null;

    const systemPrompt =
      "Infer a concise JavaScript tool description and JSON Schema. Only describe the supplied parameters.";
    session = await api.create({
      systemPrompt,
      initialPrompts: [{ role: "system", content: systemPrompt }],
    });

    const prompt = `Function name: ${fnName}\nParameters: ${
      paramNames.join(", ")
    }\nSource: ${fnString}\nReturn the requested JSON metadata.`;
    const response = await session.prompt(prompt, {
      responseConstraint: RESPONSE_SCHEMA,
    });
    return parseResponse(response);
  } catch (error) {
    options.logger?.warn?.("webmcp-lib: Prompt API fallback failed", error);
    return null;
  } finally {
    session?.destroy?.();
  }
}
