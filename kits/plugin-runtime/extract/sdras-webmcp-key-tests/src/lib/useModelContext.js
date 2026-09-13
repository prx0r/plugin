import { useEffect, useState } from "react";

const EMPTY = { supported: false, source: null, canList: false, canCall: false, tools: [] };

function detect() {
  const modelContext = typeof document !== "undefined" ? document.modelContext : undefined;
  if (!modelContext) return EMPTY;
  return {
    supported: true,
    source: modelContext.__isShim ? "shim" : "native",
    canList: typeof modelContext.getTools === "function",
    canCall: typeof modelContext.executeTool === "function",
    tools: [],
  };
}

// Watches `document.modelContext`: whether it exists, whether it is the real
// API or the in-page shim, and (when the API can enumerate) which tools are
// registered right now. Detection is synchronous on first render so a
// natively-supported page never flips from "unsupported" to "supported".
// Changes arrive via the native `toolchange` event or the shim's
// `modelcontext:change`, with a slow poll as a backstop for late injection.
export function useModelContext() {
  const [state, setState] = useState(detect);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const base = detect();
      if (!base.supported) {
        if (!cancelled) setState((prev) => (prev.supported ? EMPTY : prev));
        return;
      }
      let tools = [];
      if (base.canList) {
        try {
          tools = (await document.modelContext.getTools()) ?? [];
        } catch {
          tools = [];
        }
      }
      if (cancelled) return;
      const next = {
        ...base,
        tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      };
      setState((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }

    refresh();
    const timer = setInterval(refresh, 1000);
    window.addEventListener("modelcontext:change", refresh);
    const modelContext = document.modelContext;
    modelContext?.addEventListener?.("toolchange", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("modelcontext:change", refresh);
      modelContext?.removeEventListener?.("toolchange", refresh);
    };
  }, [state.supported]);

  return state;
}
