import * as React from "react";
import { createRoot } from "react-dom/client";
import { useWebMCP } from "use-webmcp-tool";

// Scenarios that mount real components using `useWebMCP` against whatever
// `document.modelContext` is present, and count what the browser sees: native
// registerTool calls, toolchange events, and unhandled promise rejections.
// Each row's `reference` is Chrome 152 on 2026-09-06. All tools are named
// `h_*` and every root is unmounted before the run resolves.

const tick = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
const schema = { type: "object", properties: {} };

export const HOOK_SCENARIO_REFERENCE = [
  ["One tool under StrictMode", { registers: 2, events: 3, outcome: "registered; 1 unhandled AbortError" }],
  [
    "Two components, same tool name",
    {
      registers: 2,
      events: 2,
      outcome:
        "first says registered, second says registered; second was rejected (InvalidStateError); unmounting the first: tool removed while the second says registered",
    },
  ],
  ["Tool name changes 20 times", { registers: 20, events: 40, outcome: "h_item_20 registered" }],
  ["Description changes 10 times", { registers: 10, events: 20, outcome: "description tracks state" }],
  ["One tool per row: add, remove, reorder", { registers: 1, events: 2, outcome: "h_row_1, h_row_3, h_row_4, h_row_5" }],
  ["Execute with a descriptor from before a re-registration", { registers: 2, events: 3, outcome: "runs the current tool" }],
  [
    "execute() changes state embedded in its own description",
    {
      registers: 3,
      events: 4,
      outcome:
        "live description: threw UnknownError: The operation failed for an unknown transient reason (e.g. out of memory); static description: succeeded",
    },
  ],
];

// One hook call, one tool. Reports its hook state into `states` by id.
function Tool({ id, name, description, states }) {
  const state = useWebMCP({
    name,
    description: description ?? `tool ${name}`,
    inputSchema: schema,
    execute: async () => `executed ${id}`,
  });
  states[id] = state;
  return null;
}

// A tool whose execute() updates state. With `live`, that state is embedded in
// the description, so the hook re-registers the tool while the call is in flight.
function SelfMutating({ live, states }) {
  const [items, setItems] = React.useState(["Tent", "Stove"]);
  const state = useWebMCP({
    name: live ? "h_self_live" : "h_self_static",
    description: live ? `Add an item. Current: ${items.join(", ")}` : "Add an item.",
    inputSchema: schema,
    execute: async () => {
      setItems((prev) => [...prev, "New"]);
      await tick(50);
      return "added";
    },
  });
  states[live ? "live" : "static"] = state;
  return null;
}

export async function runHookScenarios(modelContext, container, onRow) {
  const rows = [];
  const counters = { registers: 0, events: 0, unhandled: [] };
  const report = (scenario, outcome, base) => {
    const reference = HOOK_SCENARIO_REFERENCE.find(([name]) => name === scenario)?.[1] ?? {};
    const row = {
      scenario,
      registers: counters.registers - base.registers,
      events: counters.events - base.events,
      outcome,
      reference,
    };
    rows.push(row);
    onRow?.(row);
  };
  const snapshot = () => ({ registers: counters.registers, events: counters.events, unhandled: counters.unhandled.length });
  const unhandledSince = (base) => counters.unhandled.slice(base.unhandled);

  // Count native registerTool calls by shadowing the method for the duration.
  const ownRegister = Object.prototype.hasOwnProperty.call(modelContext, "registerTool");
  const originalRegister = modelContext.registerTool;
  modelContext.registerTool = function (...args) {
    counters.registers++;
    return originalRegister.apply(this, args);
  };
  const onChange = () => counters.events++;
  modelContext.addEventListener?.("toolchange", onChange);
  window.addEventListener("modelcontext:change", onChange);
  const onUnhandled = (event) => counters.unhandled.push(`${event.reason?.name}: ${event.reason?.message}`);
  window.addEventListener("unhandledrejection", onUnhandled);

  const roots = [];
  const mount = (element, strict = false) => {
    const el = document.createElement("div");
    container.appendChild(el);
    const root = createRoot(el);
    root.render(strict ? React.createElement(React.StrictMode, null, element) : element);
    const handle = {
      root,
      unmount() {
        root.unmount();
        el.remove();
      },
    };
    roots.push(handle);
    return handle;
  };
  const names = async () => (await modelContext.getTools()).map((t) => t.name).filter((n) => n.startsWith("h_"));
  const find = async (name) => (await modelContext.getTools()).find((t) => t.name === name);
  const execute = async (descriptor) => {
    try {
      const raw = await modelContext.executeTool(descriptor, "{}");
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return parsed?.content?.[0]?.text ?? JSON.stringify(parsed);
    } catch (error) {
      return `threw ${error?.name}: ${error?.message}`;
    }
  };
  const h = React.createElement;

  try {
    // 1. StrictMode mounts, unmounts, and mounts again.
    let base = snapshot();
    let states = {};
    let m = mount(h(Tool, { id: "strict", name: "h_strict", states }), true);
    await tick();
    const strictTools = await names();
    const strictUnhandled = unhandledSince(base);
    report(
      "One tool under StrictMode",
      `${strictTools.includes("h_strict") ? "registered" : "NOT registered"}; ${strictUnhandled.length} unhandled ${strictUnhandled[0]?.split(":")[0] ?? "rejection"}`.replace(/\s+$/, ""),
      base
    );
    m.unmount();
    await tick();

    // 2. A collision: two mounted components claim the same name.
    base = snapshot();
    states = {};
    m = mount(
      h(React.Fragment, null, h(Tool, { key: "a", id: "a", name: "h_dup", states }), h(Tool, { key: "b", id: "b", name: "h_dup", states })),
      false
    );
    await tick();
    const dupUnhandled = unhandledSince(base);
    const says = (s) => (s?.error ? `error (${s.error.name})` : s?.registered ? "registered" : "not registered");
    const collisionMounted = `first says ${says(states.a)}, second says ${says(states.b)}; ${dupUnhandled.length ? `second was rejected (${dupUnhandled[0].split(":")[0]})` : "no rejection"}`;
    m.root.render(h(React.Fragment, null, h(Tool, { key: "b", id: "b", name: "h_dup", states })));
    await tick();
    const afterUnmount = (await names()).includes("h_dup") ? "tool still registered" : "tool removed";
    report("Two components, same tool name", `${collisionMounted}; unmounting the first: ${afterUnmount} while the second says ${says(states.b)}`, base);
    m.unmount();
    await tick();

    // 3. The tool's name is derived from state that changes.
    states = {};
    let setName;
    function Churn() {
      const [n, setN] = React.useState(0);
      setName = setN;
      return h(Tool, { id: "churn", name: `h_item_${n}`, states });
    }
    m = mount(h(Churn));
    await tick();
    base = snapshot();
    for (let i = 1; i <= 20; i++) {
      setName(i);
      await tick(5);
    }
    await tick();
    report("Tool name changes 20 times", `${(await names()).join(", ") || "nothing"} registered`, base);
    m.unmount();
    await tick();

    // 4. The description embeds state that changes.
    states = {};
    let setItems;
    function DescriptionChurn() {
      const [items, set] = React.useState(["Tent"]);
      setItems = set;
      return h(Tool, { id: "desc", name: "h_remove", description: `Remove one of: ${items.join(", ")}`, states });
    }
    m = mount(h(DescriptionChurn));
    await tick();
    base = snapshot();
    for (let i = 1; i <= 10; i++) {
      setItems((prev) => [...prev, `Item${i}`]);
      await tick(5);
    }
    await tick();
    const description = (await find("h_remove"))?.description ?? "";
    report("Description changes 10 times", description.endsWith("Item10") ? "description tracks state" : `description is "${description}"`, base);
    m.unmount();
    await tick();

    // 5. One tool per row, rows keyed by id.
    states = {};
    let setRows;
    function Rows() {
      const [rows, set] = React.useState([1, 2, 3, 4]);
      setRows = set;
      return h(React.Fragment, null, rows.map((id) => h(Tool, { key: id, id: `row${id}`, name: `h_row_${id}`, states })));
    }
    m = mount(h(Rows));
    await tick();
    base = snapshot();
    setRows((r) => [5, ...r]);
    await tick();
    setRows((r) => r.filter((x) => x !== 2));
    await tick();
    setRows((r) => [...r].reverse());
    await tick();
    report("One tool per row: add, remove, reorder", (await names()).join(", "), base);
    m.unmount();
    await tick();

    // 6. An agent holds a descriptor from before a re-registration.
    states = {};
    let setVersion;
    function Versioned() {
      const [v, set] = React.useState(1);
      setVersion = set;
      return h(Tool, { id: "ver", name: "h_versioned", description: `v${v}`, states });
    }
    base = snapshot();
    m = mount(h(Versioned));
    await tick();
    const stale = await find("h_versioned");
    setVersion(2);
    await tick();
    const viaStale = stale ? await execute(stale) : "no descriptor";
    report("Execute with a descriptor from before a re-registration", viaStale === "executed ver" ? "runs the current tool" : viaStale, base);
    m.unmount();
    await tick();

    // 7. execute() mutates the state its own description embeds.
    states = {};
    base = snapshot();
    m = mount(h(React.Fragment, null, h(SelfMutating, { key: "live", live: true, states }), h(SelfMutating, { key: "static", live: false, states })));
    await tick();
    const liveResult = await execute(await find("h_self_live"));
    const staticResult = await execute(await find("h_self_static"));
    await tick();
    report(
      "execute() changes state embedded in its own description",
      `live description: ${liveResult.startsWith("threw") ? liveResult.replace(/\.$/, "") : "succeeded"}; static description: ${staticResult === "added" ? "succeeded" : staticResult}`,
      base
    );
    m.unmount();
    await tick();
  } catch (error) {
    report("Scenario run stopped", `threw ${error?.name}: ${error?.message}`, snapshot());
  } finally {
    for (const r of roots) {
      try {
        r.unmount();
      } catch {
        // already unmounted
      }
    }
    await tick();
    if (ownRegister) modelContext.registerTool = originalRegister;
    else delete modelContext.registerTool;
    modelContext.removeEventListener?.("toolchange", onChange);
    window.removeEventListener("modelcontext:change", onChange);
    window.removeEventListener("unhandledrejection", onUnhandled);
  }
  return rows;
}
