// Probes of how `document.modelContext` treats tool identity: what
// registerTool returns, what a duplicate name does, whether a descriptor
// captured before a re-registration still works, and what happens to a call
// that is in flight when its registration is aborted.
//
// Every probe reports `{ probe, result, reference }`, where `reference` is what
// the native API in Chrome 152 returned on 2026-09-06. All probe tools are
// named `probe_*` and are unregistered before the run resolves.

const schema = { type: "object", properties: {} };
const tool = (name, description, execute) => ({ name, description, inputSchema: schema, execute });
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// registerTool returns a promise natively and undefined from the shim.
function settle(value) {
  if (value && typeof value.then === "function") {
    return value.then(
      (resolved) => `promise resolved to ${String(resolved)}`,
      (error) => `promise rejected: ${error?.name}: ${error?.message}`
    );
  }
  return Promise.resolve(`returned ${String(value)} (not a promise)`);
}

export const NATIVE_PROBE_REFERENCE = [
  ["registerTool() return value", "promise resolved to undefined"],
  ["Register a second tool with the same name", "promise rejected: InvalidStateError: Duplicate tool name"],
  ["Which one executes after that", "the first (\"A\")"],
  ["Abort the rejected registration's signal", "the first survives"],
  ["Abort the first registration", "removed"],
  ["Abort, then register the same name in one tick", "promise resolved to undefined; description now \"Y2\""],
  ["Execute with a descriptor captured before that swap", "runs \"Y2\": identity is the name"],
  ["Register, then abort in the same tick", "promise rejected: AbortError: signal is aborted without reason; absent"],
  ["Abort a registration while its execute is in flight", "threw UnknownError: The operation failed for an unknown transient reason (e.g. out of memory)."],
  ["Execute the same descriptor after the swap", "\"slow2 done\""],
  ["toolchange events for the whole run", "12"],
];

export async function runNativeProbes(modelContext, onRow) {
  const rows = [];
  const report = (probe, result) => {
    const reference = NATIVE_PROBE_REFERENCE.find(([name]) => name === probe)?.[1] ?? "";
    const row = { probe, result, reference };
    rows.push(row);
    onRow?.(row);
  };

  let changes = 0;
  const onChange = () => changes++;
  modelContext.addEventListener?.("toolchange", onChange);
  window.addEventListener("modelcontext:change", onChange); // the shim's event

  const controllers = [];
  const controller = () => {
    const c = new AbortController();
    controllers.push(c);
    return c;
  };
  const find = async (name) => (await modelContext.getTools()).find((t) => t.name === name);
  const has = async (name) => Boolean(await find(name));
  const execute = async (descriptor, args = "{}") => {
    try {
      const result = await modelContext.executeTool(descriptor, args);
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (error) {
      return `threw ${error?.name}: ${error?.message}`;
    }
  };

  try {
    const c1 = controller();
    const r1 = modelContext.registerTool(tool("probe_x", "A", async () => "A"), { signal: c1.signal });
    report("registerTool() return value", await settle(r1));

    const c2 = controller();
    const r2 = modelContext.registerTool(tool("probe_x", "B", async () => "B"), { signal: c2.signal });
    report("Register a second tool with the same name", await settle(r2));
    const first = await find("probe_x");
    const which = first ? await execute(first) : "no probe_x registered";
    report("Which one executes after that", which === "A" ? 'the first ("A")' : which === "B" ? 'the second ("B")' : which);

    c2.abort();
    await tick();
    report("Abort the rejected registration's signal", (await has("probe_x")) ? "the first survives" : "the first was removed too");

    c1.abort();
    await tick();
    report("Abort the first registration", (await has("probe_x")) ? "still registered" : "removed");

    const c3 = controller();
    modelContext.registerTool(tool("probe_y", "Y1", async () => "Y1"), { signal: c3.signal });
    await tick();
    const stale = await find("probe_y");
    c3.abort();
    const c4 = controller();
    const r4 = modelContext.registerTool(tool("probe_y", "Y2", async () => "Y2"), { signal: c4.signal });
    const swapped = await settle(r4);
    report("Abort, then register the same name in one tick", `${swapped}; description now "${(await find("probe_y"))?.description}"`);
    const viaStale = stale ? await execute(stale) : "no descriptor to test";
    report("Execute with a descriptor captured before that swap", viaStale === "Y2" ? 'runs "Y2": identity is the name' : viaStale);

    const c5 = controller();
    const r5 = modelContext.registerTool(tool("probe_z", "Z", async () => "Z"), { signal: c5.signal });
    c5.abort();
    const r5result = await settle(r5);
    report("Register, then abort in the same tick", `${r5result}; ${(await has("probe_z")) ? "present" : "absent"}`);

    const c6 = controller();
    modelContext.registerTool(
      tool("probe_slow", "slow1", async () => {
        await tick(300);
        return "slow1 done";
      }),
      { signal: c6.signal }
    );
    await tick();
    const slow = await find("probe_slow");
    const inFlight = execute(slow);
    await tick(20);
    c6.abort();
    const c7 = controller();
    modelContext.registerTool(tool("probe_slow", "slow2", async () => "slow2 done"), { signal: c7.signal });
    report("Abort a registration while its execute is in flight", await inFlight);
    report("Execute the same descriptor after the swap", `"${await execute(slow)}"`);
  } catch (error) {
    report("Probe run stopped", `threw ${error?.name}: ${error?.message}`);
  } finally {
    for (const c of controllers) c.abort();
    await tick(50);
    modelContext.removeEventListener?.("toolchange", onChange);
    window.removeEventListener("modelcontext:change", onChange);
  }
  report("toolchange events for the whole run", String(changes));
  return rows;
}
