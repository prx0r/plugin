const SKIPPED_KEYS = new Set([
  "window",
  "self",
  "top",
  "parent",
  "frames",
  "document",
  "location",
  "history",
  "navigator",
  "screen",
  "localStorage",
  "sessionStorage",
  "customElements",
  "performance",
  "crypto",
  "console",
  "speechSynthesis",
  "constructor",
  "prototype",
  "__proto__",
]);

function getOwnValue(object, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    // Do not invoke browser or application getters while discovering tools.
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function isDeveloperFunction(value) {
  if (typeof value !== "function") return false;

  try {
    const source = Function.prototype.toString.call(value);
    return !source.includes("[native code]") && !/^\s*class\b/.test(source);
  } catch {
    return false;
  }
}

function isNamespace(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownKeys(value) {
  try {
    return Object.getOwnPropertyNames(value);
  } catch {
    return [];
  }
}

function resolveNamespace(root, namespace) {
  if (typeof namespace === "string") {
    const path = namespace.split(".").filter(Boolean);
    let value = root;
    for (const part of path) {
      value = getOwnValue(value, part);
      if (value == null) break;
    }
    return { value, path };
  }

  if (namespace && typeof namespace === "object" && "root" in namespace) {
    const path = Array.isArray(namespace.path)
      ? namespace.path
      : String(namespace.name || "").split(".").filter(Boolean);
    return { value: namespace.root, path };
  }

  return { value: undefined, path: [] };
}

/**
 * Discover own, developer-authored functions without walking browser prototypes
 * or invoking getters. Nested traversal is limited to plain-object namespaces.
 *
 * @param {object} root Object whose own functions should be discovered.
 * @param {number|object} options A legacy maxDepth number, or discovery options.
 * @returns {Array<object>} Function records including their receiver and tool path.
 */
export function discoverFunctions(root = globalThis, options = 0) {
  const normalized = typeof options === "number"
    ? { maxDepth: options }
    : (options || {});
  const maxDepth = Math.max(0, normalized.maxDepth ?? 0);
  const namespaces = normalized.namespaces || [];
  const discovered = [];
  const toolNames = new Set();

  function walk(value, path, depth, ancestors) {
    if (
      value == null ||
      (typeof value !== "object" && typeof value !== "function")
    ) return;
    if (ancestors.has(value)) return;

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(value);

    for (const key of ownKeys(value)) {
      if (SKIPPED_KEYS.has(key) || key.startsWith("_")) continue;

      const child = getOwnValue(value, key);
      const childPath = [...path, key];

      if (isDeveloperFunction(child)) {
        const toolName = childPath.join("_");
        if (!toolNames.has(toolName)) {
          toolNames.add(toolName);
          discovered.push({
            name: key,
            toolName,
            path: childPath,
            fn: child,
            parent: value,
          });
        }
      } else if (depth < maxDepth && isNamespace(child)) {
        walk(child, childPath, depth + 1, nextAncestors);
      }
    }
  }

  // The root's own functions are always considered. Namespace traversal is opt-in.
  walk(root, [], 0, new Set());

  for (const namespace of namespaces) {
    const resolved = resolveNamespace(root, namespace);
    if (isNamespace(resolved.value) && resolved.path.length > 0) {
      walk(resolved.value, resolved.path, 0, new Set());
    }
  }

  return discovered;
}
