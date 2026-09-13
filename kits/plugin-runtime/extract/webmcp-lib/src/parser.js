function functionSource(fn) {
  try {
    return Function.prototype.toString.call(fn);
  } catch {
    return "";
  }
}

function findMatchingParen(source, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = start; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if (character === "(") {
      depth++;
    } else if (character === ")" && --depth === 0) {
      return index;
    }
  }

  return -1;
}

function splitTopLevel(source, separator = ",") {
  const parts = [];
  let start = 0;
  let quote = null;
  let escaped = false;
  const stack = [];
  const pairs = { "(": ")", "[": "]", "{": "}" };

  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if (pairs[character]) {
      stack.push(pairs[character]);
    } else if (stack.at(-1) === character) {
      stack.pop();
    } else if (character === separator && stack.length === 0) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(source.slice(start));
  return parts;
}

function topLevelEquals(source) {
  const pieces = splitTopLevel(source, "=");
  if (pieces.length < 2) return -1;
  return pieces[0].length;
}

function parseLiteral(source) {
  const value = source.trim();
  if (!value) return { serializable: false };
  if (value === "true") return { serializable: true, value: true };
  if (value === "false") return { serializable: true, value: false };
  if (value === "null") return { serializable: true, value: null };
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    return { serializable: true, value: Number(value) };
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return {
      serializable: true,
      value: value.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\"),
    };
  }

  try {
    const parsed = JSON.parse(value);
    return { serializable: true, value: parsed };
  } catch {
    return { serializable: false };
  }
}

function parameterSource(fn) {
  const source = functionSource(fn).trim();
  const arrowIndex = source.indexOf("=>");
  const firstParen = source.indexOf("(");

  if (firstParen >= 0 && (arrowIndex < 0 || firstParen < arrowIndex)) {
    const end = findMatchingParen(source, firstParen);
    return end >= 0 ? source.slice(firstParen + 1, end) : "";
  }

  if (arrowIndex >= 0) {
    return source.slice(0, arrowIndex).replace(/^async\s+/, "").trim();
  }

  return "";
}

/** Extract ordered parameter metadata, including defaults and rest parameters. */
export function extractParameters(fn) {
  const source = parameterSource(fn);
  if (!source.trim()) return [];

  return splitTopLevel(source).map((rawParameter) => {
    let parameter = rawParameter.trim();
    let rest = false;
    if (parameter.startsWith("...")) {
      rest = true;
      parameter = parameter.slice(3).trim();
    }

    const equalsIndex = topLevelEquals(parameter);
    const rawName =
      (equalsIndex >= 0 ? parameter.slice(0, equalsIndex) : parameter).trim();
    const hasDefault = equalsIndex >= 0;
    const parsedDefault = hasDefault
      ? parseLiteral(parameter.slice(equalsIndex + 1))
      : { serializable: false };

    return {
      name: /^[A-Za-z_$][\w$]*$/.test(rawName) ? rawName : null,
      rawName,
      rest,
      hasDefault,
      defaultSerializable: parsedDefault.serializable,
      ...(parsedDefault.serializable
        ? { defaultValue: parsedDefault.value }
        : {}),
    };
  });
}

export function extractParamNames(fn) {
  return extractParameters(fn).map((parameter) =>
    parameter.name || parameter.rawName
  ).filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatchingBrace(source, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < source.length; index++) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }

    if (character === "/" && next === "/") {
      lineComment = true;
      index++;
    } else if (character === "/" && next === "*") {
      blockComment = true;
      index++;
    } else if (character === '"' || character === "'" || character === "`") {
      quote = character;
    } else if (character === "{") {
      depth++;
    } else if (character === "}" && --depth === 0) {
      return index;
    }
  }

  return -1;
}

function namespaceSource(sourceCode, namespacePath) {
  let source = sourceCode;
  for (const [index, segment] of namespacePath.entries()) {
    const safeSegment = escapeRegExp(segment);
    const declaration = index === 0
      ? `(?:(?:const|let|var)\\s+|window\\.|(?<![\\w$]))${safeSegment}\\s*=\\s*\\{`
      : `(?<![\\w$])${safeSegment}\\s*:\\s*\\{`;
    const match = new RegExp(declaration).exec(source);
    if (!match) return null;

    const braceStart = match.index + match[0].lastIndexOf("{");
    const braceEnd = findMatchingBrace(source, braceStart);
    if (braceEnd < 0) return null;
    source = source.slice(braceStart + 1, braceEnd);
  }
  return source;
}

function extractJSDocByName(fnName, sourceCode) {
  const safeName = escapeRegExp(fnName);
  const prefix = "\\/\\*\\*((?:(?!\\*\\/)[\\s\\S])*)\\*\\/\\s*";
  const regexes = [
    new RegExp(
      `${prefix}(?:export\\s+)?(?:async\\s+)?function\\s+${safeName}\\s*\\(`,
    ),
    new RegExp(
      `${prefix}(?:export\\s+)?(?:const|let|var)\\s+${safeName}\\s*=`,
    ),
    new RegExp(`${prefix}(?:window\\.)?${safeName}\\s*=`, "g"),
    new RegExp(
      `${prefix}${safeName}\\s*:\\s*(?:async\\s+)?(?:function|\\()`,
    ),
    new RegExp(`${prefix}(?:async\\s+)?${safeName}\\s*\\(`),
  ];

  for (const regex of regexes) {
    const match = regex.exec(sourceCode);
    if (match) return parseJSDocBlock(match[1]);
  }

  return null;
}

/** Extract JSDoc for a function name or its full namespace path. */
export function extractJSDoc(functionIdentity, sourceCode) {
  if (!sourceCode) return null;
  const path = Array.isArray(functionIdentity)
    ? functionIdentity
    : [functionIdentity];
  const fnName = path.at(-1);
  if (!fnName) return null;

  if (path.length > 1) {
    const qualifiedName = path.map(escapeRegExp).join("\\s*\\.\\s*");
    const qualified = new RegExp(
      `\\/\\*\\*((?:(?!\\*\\/)[\\s\\S])*)\\*\\/\\s*(?:window\\.)?${qualifiedName}\\s*=`,
    ).exec(sourceCode);
    if (qualified) return parseJSDocBlock(qualified[1]);

    const scopedSource = namespaceSource(sourceCode, path.slice(0, -1));
    if (scopedSource === null) return null;
    return extractJSDocByName(fnName, scopedSource);
  }

  return extractJSDocByName(fnName, sourceCode);
}

function parseJSDocDefault(source) {
  const parsed = parseLiteral(source);
  return parsed.serializable ? { defaultValue: parsed.value } : {};
}

export function parseJSDocBlock(block) {
  const lines = block.split("\n").map((line) =>
    line.replace(/^\s*\*\s?/, "").trim()
  );
  const doc = { description: "", params: {}, returns: null };
  const description = [];

  for (const line of lines) {
    if (line.startsWith("@param")) {
      const match = line.match(
        /^@param\s+(?:\{([^}]+)\}\s+)?(\[[^\]]+\]|[^\s]+)\s*(.*)$/,
      );
      if (!match) continue;

      let name = match[2];
      let optional = false;
      let defaultSource = null;
      if (name.startsWith("[") && name.endsWith("]")) {
        optional = true;
        name = name.slice(1, -1);
        const equalsIndex = name.indexOf("=");
        if (equalsIndex >= 0) {
          defaultSource = name.slice(equalsIndex + 1);
          name = name.slice(0, equalsIndex);
        }
      }
      if (name.startsWith("...")) name = name.slice(3);

      doc.params[name] = {
        type: match[1] || "string",
        description: match[3] || "",
        optional,
        ...(defaultSource === null ? {} : parseJSDocDefault(defaultSource)),
      };
    } else if (line.startsWith("@returns") || line.startsWith("@return")) {
      const match = line.match(/^@returns?\s+(?:\{([^}]+)\}\s*)?(.*)$/);
      if (match) {
        doc.returns = { type: match[1] || "any", description: match[2] || "" };
      }
    } else if (!line.startsWith("@") && line) {
      description.push(line);
    }
  }

  doc.description = description.join(" ").trim();
  return doc;
}
