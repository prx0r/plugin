import { useEffect, useRef, useState } from "react";
import { Check, Cross } from "../components/icons.jsx";
import { buildToolSpecs, TOOL_NAMES } from "./toolSpecs.js";

// The same five tools, registered by hand with document.modelContext. Everything
// the hook does for you is spelled out here:
//   - feature detection (and no retry if the API shows up late)
//   - one AbortController whose signal unregisters every tool on unmount
//   - a ref so `execute` sees the latest actions without re-registering
//   - normalizing results and errors into MCP's { content: [...] } shape
// plus the one thing the hook does not do yet: settle the promise that
// registerTool returns, so an unmount never leaves an unhandled AbortError and
// a rejected registration (a duplicate name, say) shows as ✗ instead of ✓.
const IDLE = { pending: false, registered: [], errors: {} };

export function ImperativeTools({ actions, log, supported }) {
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  const [status, setStatus] = useState(IDLE);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      setStatus(IDLE);
      return;
    }

    const controller = new AbortController();
    const specs = buildToolSpecs(() => actionsRef.current, log);
    let cancelled = false;
    setStatus({ pending: true, registered: [], errors: {} });

    // Every registerTool call happens in this same tick; the async wrapper only
    // records how each one settles. Native Chrome returns a promise and the
    // simulator returns undefined, and awaiting either works.
    const outcomes = specs.map(async (spec) => {
      try {
        await modelContext.registerTool(toDescriptor(spec), { signal: controller.signal });
        return { name: spec.name, error: null };
      } catch (error) {
        return { name: spec.name, error };
      }
    });

    Promise.all(outcomes).then((settled) => {
      if (cancelled) return;
      // An AbortError can only come from our own signal, which means unmount.
      const failed = settled.filter((outcome) => outcome.error && outcome.error.name !== "AbortError");
      setStatus({
        pending: false,
        registered: settled.filter((outcome) => !outcome.error).map((outcome) => outcome.name),
        errors: Object.fromEntries(failed.map((outcome) => [outcome.name, outcome.error])),
      });
    });

    // Aborting the signal unregisters every tool registered with it. Any
    // registration still pending rejects with AbortError, which the wrapper
    // above already caught.
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [supported, log]);

  return (
    <ul className="tool-status" aria-label="Tools registered imperatively">
      {TOOL_NAMES.map((name) => {
        const error = status.errors[name];
        const on = status.registered.includes(name);
        const state = error ? "err" : on ? "on" : "";
        const title = error
          ? error.message
          : on
            ? "registered"
            : status.pending
              ? "registering…"
              : "document.modelContext not found";
        return (
          <li key={name} className={state} title={title}>
            {name} {error ? <Cross /> : on ? <Check /> : "…"}
          </li>
        );
      })}
    </ul>
  );
}

function toDescriptor(spec) {
  return {
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    annotations: spec.annotations,
    async execute(args) {
      try {
        const value = await spec.execute(args);
        const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        // A failure must never read as success to the agent.
        return {
          content: [{ type: "text", text: error?.message ?? String(error) }],
          isError: true,
        };
      }
    },
  };
}
