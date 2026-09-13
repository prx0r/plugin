function schemaForType(type = "string") {
  const normalized = String(type).trim();
  const lower = normalized.toLowerCase();
  const union = normalized.split("|").map((part) => part.trim()).filter(
    Boolean,
  );

  if (union.length > 1) {
    return { anyOf: union.map(schemaForType) };
  }

  const arrayMatch = normalized.match(
    /^(?:Array\.<(.+)>|Array<(.+)>|(.+)\[\])$/i,
  );
  if (arrayMatch) {
    return {
      type: "array",
      items: schemaForType(arrayMatch[1] || arrayMatch[2] || arrayMatch[3]),
    };
  }

  if (lower === "number") return { type: "number" };
  if (lower === "integer" || lower === "int") return { type: "integer" };
  if (lower === "boolean" || lower === "bool") return { type: "boolean" };
  if (lower === "null") return { type: "null" };
  if (lower === "array") return { type: "array", items: {} };
  if (lower === "object" || lower === "record") {
    return { type: "object", properties: {}, additionalProperties: false };
  }
  if (lower === "any" || lower === "*" || lower === "unknown") return {};
  return { type: "string" };
}

function closeSchema(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return {};
  const closed = { ...schema };
  if (closed.type === "object") {
    const properties =
      closed.properties && typeof closed.properties === "object"
        ? closed.properties
        : {};
    closed.properties = Object.fromEntries(
      Object.entries(properties).map((
        [name, property],
      ) => [name, closeSchema(property)]),
    );
    closed.additionalProperties = false;
  }
  if (closed.type === "array" && closed.items) {
    closed.items = closeSchema(closed.items);
  }
  if (Array.isArray(closed.anyOf)) closed.anyOf = closed.anyOf.map(closeSchema);
  return closed;
}

function normalizeParameter(parameter) {
  if (typeof parameter === "string") {
    return {
      name: parameter,
      hasDefault: false,
      defaultSerializable: false,
      rest: false,
    };
  }
  return parameter;
}

/** Generate a closed JSON Schema from parsed function and JSDoc metadata. */
export function generateSchema(parameters, jsdoc) {
  const schema = {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  };

  for (const rawParameter of parameters || []) {
    const parameter = normalizeParameter(rawParameter);
    if (!parameter.name) continue;

    const jsdocParam = jsdoc?.params?.[parameter.name];
    let property;
    if (parameter.rest) {
      const documentedType = String(jsdocParam?.type || "any").replace(
        /^\.\.\./,
        "",
      );
      const documentedSchema = schemaForType(documentedType);
      property = documentedSchema.type === "array"
        ? documentedSchema
        : { type: "array", items: documentedSchema };
    } else {
      property = schemaForType(jsdocParam?.type);
    }
    property.description = jsdocParam?.description ||
      `Parameter ${parameter.name}`;

    const hasJSDocDefault = jsdocParam &&
      Object.hasOwn(jsdocParam, "defaultValue");
    if (parameter.defaultSerializable) {
      property.default = parameter.defaultValue;
    } else if (hasJSDocDefault) property.default = jsdocParam.defaultValue;

    schema.properties[parameter.name] = property;
    if (!parameter.rest && !parameter.hasDefault && !jsdocParam?.optional) {
      schema.required.push(parameter.name);
    }
  }

  return schema;
}

/**
 * Limit AI-produced schemas to the actual function signature and close the root
 * object so inferred output cannot silently invent executable arguments.
 */
export function normalizeInferredSchema(inferredSchema, parameters) {
  const baseline = generateSchema(parameters, null);
  if (
    !inferredSchema || inferredSchema.type !== "object" ||
    typeof inferredSchema.properties !== "object"
  ) {
    return baseline;
  }

  const required = new Set(
    Array.isArray(inferredSchema.required) ? inferredSchema.required : [],
  );
  for (const parameter of parameters) {
    if (!parameter.name) continue;
    const inferred = inferredSchema.properties[parameter.name];
    if (inferred && typeof inferred === "object" && !Array.isArray(inferred)) {
      baseline.properties[parameter.name] = {
        ...baseline.properties[parameter.name],
        ...closeSchema(inferred),
      };
      // Defaults come from source, which is deterministic, rather than inference.
      if (parameter.defaultSerializable) {
        baseline.properties[parameter.name].default = parameter.defaultValue;
      }
    }
  }

  baseline.required = parameters
    .filter((parameter) =>
      parameter.name && !parameter.rest && !parameter.hasDefault &&
      required.has(parameter.name)
    )
    .map((parameter) => parameter.name);
  baseline.additionalProperties = false;
  return baseline;
}
