import { inferWithAI } from "../src/ai-fallback.js";

Deno.test("Prompt API fallback supports a deterministic injectable fake", async () => {
  let promptOptions;
  let destroyed = false;
  const fakePromptAPI = {
    availability: () => Promise.resolve("available"),
    create: () =>
      Promise.resolve({
        prompt: (_text, options) => {
          promptOptions = options;
          return Promise.resolve(
            '{"description":"Multiply values","schema":{"type":"object","properties":{"a":{"type":"number"},"b":{"type":"number"}},"required":["a","b"]}}',
          );
        },
        destroy: () => {
          destroyed = true;
        },
      }),
  };

  const result = await inferWithAI("m", "(a,b)=>a*b", ["a", "b"], {
    promptAPI: fakePromptAPI,
  });
  if (result.description !== "Multiply values") {
    throw new Error("Bad inferred description");
  }
  if (result.schema.properties.a.type !== "number") {
    throw new Error("Bad inferred schema");
  }
  if (!promptOptions.responseConstraint) {
    throw new Error("Structured output constraint was not used");
  }
  if (!destroyed) throw new Error("Prompt session was not destroyed");
});

Deno.test("Prompt API fallback degrades deterministically when unavailable", async () => {
  let created = false;
  const result = await inferWithAI("m", "a=>a", ["a"], {
    promptAPI: {
      availability: () => Promise.resolve("unavailable"),
      create: () => {
        created = true;
        return Promise.resolve();
      },
    },
  });

  if (result !== null || created) {
    throw new Error("Unavailable Prompt API was invoked");
  }
});
