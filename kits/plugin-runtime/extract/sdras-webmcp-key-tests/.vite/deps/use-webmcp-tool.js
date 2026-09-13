import {
  __toESM,
  require_react
} from "./chunk-KWUQWS3S.js";

// node_modules/use-webmcp-tool/useWebMCP.js
var React = __toESM(require_react());
function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
function toToolResponse(value) {
  if (value && typeof value === "object" && Array.isArray(value.content)) {
    return value;
  }
  if (value === void 0 || value === null) {
    return { content: [] };
  }
  if (typeof value === "string") {
    return { content: [{ type: "text", text: value }] };
  }
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}
function toErrorResponse(error) {
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : safeStringify(error);
  return { content: [{ type: "text", text }], isError: true };
}
function useWebMCP({
  name,
  description,
  inputSchema,
  annotations,
  execute,
  enabled = true,
  formatOutput,
  onError
}) {
  const [state, setState] = React.useState({
    supported: false,
    registered: false,
    error: null
  });
  const executeRef = React.useRef(execute);
  const formatOutputRef = React.useRef(formatOutput);
  const onErrorRef = React.useRef(onError);
  React.useEffect(() => {
    executeRef.current = execute;
    formatOutputRef.current = formatOutput;
    onErrorRef.current = onError;
  });
  const schemaKey = inputSchema ? JSON.stringify(inputSchema) : "";
  const annotationsKey = annotations ? JSON.stringify(annotations) : "";
  const [detectTick, redetect] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => {
    const supported = typeof document !== "undefined" && Boolean(document.modelContext);
    if (!supported) {
      setState({ supported: false, registered: false, error: null });
      if (typeof document === "undefined") return;
      let attempts = 0;
      const timer = setInterval(() => {
        if (document.modelContext) {
          clearInterval(timer);
          redetect();
        } else if (++attempts >= 20) {
          clearInterval(timer);
        }
      }, 500);
      return () => clearInterval(timer);
    }
    if (!enabled) {
      setState({ supported: true, registered: false, error: null });
      return;
    }
    const controller = new AbortController();
    try {
      document.modelContext.registerTool(
        {
          name,
          description,
          inputSchema,
          annotations,
          async execute(args) {
            try {
              const result = await executeRef.current(args);
              const format = formatOutputRef.current;
              const shaped = format ? format(result, args) : result;
              if (shaped instanceof Error) throw shaped;
              return toToolResponse(shaped);
            } catch (error) {
              if (onErrorRef.current) {
                onErrorRef.current(error);
              }
              return toErrorResponse(error);
            }
          }
        },
        { signal: controller.signal }
      );
      setState({ supported: true, registered: true, error: null });
    } catch (error) {
      setState({
        supported: true,
        registered: false,
        error: error instanceof Error ? error : new Error(safeStringify(error))
      });
    }
    return () => {
      controller.abort();
    };
  }, [name, description, schemaKey, annotationsKey, enabled, detectTick]);
  return state;
}
export {
  useWebMCP
};
//# sourceMappingURL=use-webmcp-tool.js.map
