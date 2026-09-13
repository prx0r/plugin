import {
  extractJSDoc,
  extractParameters,
  extractParamNames,
} from "../src/parser.js";
import { generateSchema } from "../src/schema-generator.js";

Deno.test("extracts parameter names, rest parameters, and literal defaults", () => {
  const api = {
    method(required, count = 2, label = "items", enabled = true, ...tags) {
      return [required, count, label, enabled, tags];
    },
  };
  const parameters = extractParameters(api.method);

  if (
    extractParamNames(api.method).join(",") !==
      "required,count,label,enabled,tags"
  ) {
    throw new Error("Parameter names were not preserved");
  }
  if (
    parameters[1].defaultValue !== 2 || parameters[2].defaultValue !== "items"
  ) {
    throw new Error("Literal defaults were not extracted");
  }
  if (parameters[3].defaultValue !== true || !parameters[4].rest) {
    throw new Error("Boolean default or rest metadata missing");
  }
});

Deno.test("extracts function and object-method JSDoc metadata", () => {
  const code = `
    /**
     * Calculates a total.
     * @param {number} amount Amount to add
     * @param {integer} [count=2] Number of additions
     * @returns {number} The total
     */
    async function total(amount, count = 2) { return amount * count; }

    const app = {
      /**
       * Changes the selected mode.
       * @param {string|number} mode New mode
       */
      setMode(mode) {}
    };
  `;

  const total = extractJSDoc("total", code);
  const method = extractJSDoc("setMode", code);
  if (total.description !== "Calculates a total.") {
    throw new Error("Description missing");
  }
  if (!total.params.count.optional || total.params.count.defaultValue !== 2) {
    throw new Error("Optional default missing");
  }
  if (method.params.mode.type !== "string|number") {
    throw new Error("Method JSDoc missing");
  }
});

Deno.test("keeps JSDoc scoped to same-named namespace methods", () => {
  const code = `
    const alpha = {
      /**
       * Run the alpha operation.
       * @param {number} value Alpha value
       */
      run(value) {}
    };
    const beta = {
      /**
       * Run the beta operation.
       * @param {string} value Beta value
       */
      run(value) {}
    };
  `;

  const alpha = extractJSDoc(["alpha", "run"], code);
  const beta = extractJSDoc(["beta", "run"], code);
  if (
    alpha?.description !== "Run the alpha operation." ||
    alpha.params.value.type !== "number"
  ) {
    throw new Error("Alpha method received the wrong JSDoc");
  }
  if (
    beta?.description !== "Run the beta operation." ||
    beta.params.value.type !== "string"
  ) {
    throw new Error("Beta method received the wrong JSDoc");
  }
});

Deno.test("generates typed array items for rest parameters", () => {
  function collect(...values) {
    return values;
  }
  const jsdoc = extractJSDoc(
    "collect",
    `
    /**
     * Collect numeric values.
     * @param {number} ...values Values to collect
     */
    function collect(...values) {}
  `,
  );
  const schema = generateSchema(extractParameters(collect), jsdoc);

  if (
    schema.properties.values.type !== "array" ||
    schema.properties.values.items.type !== "number"
  ) {
    throw new Error("Rest parameter item type was discarded");
  }
  if (schema.required.includes("values")) {
    throw new Error("Rest parameter was incorrectly required");
  }
});

Deno.test("generates closed typed schemas with source defaults", () => {
  function configure(name, count = 3, options = {}) {
    return { name, count, options };
  }
  const parameters = extractParameters(configure);
  const jsdoc = {
    params: {
      name: { type: "string", description: "Display name" },
      count: { type: "integer", description: "Repeat count" },
      options: { type: "object", description: "Configuration" },
    },
  };
  const schema = generateSchema(parameters, jsdoc);

  if (schema.additionalProperties !== false) {
    throw new Error("Root schema is not closed");
  }
  if (
    schema.properties.count.type !== "integer" ||
    schema.properties.count.default !== 3
  ) {
    throw new Error("Type/default schema metadata missing");
  }
  if (schema.properties.options.additionalProperties !== false) {
    throw new Error("Nested object schema is not closed");
  }
  if (schema.required.join(",") !== "name") {
    throw new Error(`Wrong required parameters: ${schema.required}`);
  }
});
