import { useMemo } from "react";
import { useWebMCP } from "use-webmcp-tool";
import { Check, Cross } from "../components/icons.jsx";
import { buildToolSpecs } from "./toolSpecs.js";

// One hook call registers one tool for the lifetime of this component: it
// registers on mount and unregisters (aborts the signal) on unmount. The hook
// reads `execute` through a ref, so a fresh closure each render never
// re-registers the tool, and it turns plain return values and thrown errors
// into MCP results for us.
function ToolRegistration({ spec }) {
  const { supported, registered, error } = useWebMCP(spec);
  const state = error ? "err" : registered ? "on" : "";
  const title = error
    ? error.message
    : registered
      ? "registered"
      : supported
        ? "registering…"
        : "document.modelContext not found";
  return (
    <li className={state} title={title}>
      {spec.name} {error ? <Cross /> : registered ? <Check /> : "…"}
    </li>
  );
}

export function HookTools({ actions, log }) {
  const specs = useMemo(() => buildToolSpecs(() => actions, log), [actions, log]);
  return (
    <ul className="tool-status" aria-label="Tools registered with useWebMCP">
      {specs.map((spec) => (
        <ToolRegistration key={spec.name} spec={spec} />
      ))}
    </ul>
  );
}
