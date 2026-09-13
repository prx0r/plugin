import { useEffect, useState } from "react";

// Example arguments per tool, using real ids from the current list so the
// first call succeeds.
function exampleFor(tool, items) {
  const first = items[0]?.id ?? 1;
  const last = items[items.length - 1]?.id ?? first;
  const examples = {
    "list-items": {},
    "add-item": { text: "Bear spray", position: "top" },
    "remove-item": { id: first },
    "move-item": { id: last, index: 0 },
    "rename-item": { id: first, text: "Two-person tent" },
  };
  const example = examples[tool.name];
  if (example) return JSON.stringify(example);
  const props = tool.inputSchema?.properties ?? {};
  const guess = Object.fromEntries(
    Object.entries(props).map(([key, schema]) => [
      key,
      schema.type === "number" ? 0 : schema.type === "boolean" ? false : "",
    ])
  );
  return JSON.stringify(guess);
}

function summarize(entry) {
  if (entry.error) return `✗ ${entry.error}`;
  const result = entry.result;
  const text = typeof result === "string" ? result : JSON.stringify(result);
  return text.length > 90 ? text.slice(0, 87) + "…" : text;
}

// Stands in for a browser-integrated agent. It discovers the page's tools and
// invokes one through the very same document.modelContext surface the
// extension uses — getTools() to discover, executeTool() to call — so what
// you see here is exactly what an agent would get back.
export function AgentConsole({ mcp, items, log }) {
  const [toolName, setToolName] = useState("");
  const [argsText, setArgsText] = useState("{}");
  const [response, setResponse] = useState(null);
  const [busy, setBusy] = useState(false);
  const tools = mcp.tools;

  useEffect(() => {
    if (tools.length && !tools.some((tool) => tool.name === toolName)) {
      setToolName(tools[0].name);
      setArgsText(exampleFor(tools[0], items));
    }
  }, [tools, toolName, items]);

  const selectTool = (name) => {
    setToolName(name);
    const tool = tools.find((candidate) => candidate.name === name);
    if (tool) setArgsText(exampleFor(tool, items));
  };

  async function callTool() {
    setBusy(true);
    setResponse(null);
    try {
      const modelContext = document.modelContext;
      const registered = await modelContext.getTools();
      const tool = registered.find((candidate) => candidate.name === toolName);
      if (!tool) throw new Error(`Tool "${toolName}" is not registered`);
      const raw = await modelContext.executeTool(tool, argsText);
      setResponse(typeof raw === "string" ? JSON.parse(raw) : raw);
    } catch (error) {
      setResponse({ content: [{ type: "text", text: error?.message ?? String(error) }], isError: true });
    } finally {
      setBusy(false);
    }
  }

  const selected = tools.find((tool) => tool.name === toolName);
  const canCall = mcp.supported && mcp.canCall && tools.length > 0;

  return (
    <div className="console">
      <h3>Agent console</h3>
      {!mcp.supported && <p className="hint">No <code>document.modelContext</code> yet. Enable the simulator above.</p>}
      {mcp.supported && !mcp.canList && (
        <p className="hint">
          The native API doesn’t let the page enumerate or call its own tools. Use your agent, or the
          Model Context Tool Inspector extension, to see and call them. Calls still show in the log below.
        </p>
      )}
      {mcp.supported && mcp.canList && (
        <>
          <label>
            Tool
            <select value={toolName} onChange={(e) => selectTool(e.target.value)} disabled={!tools.length}>
              {tools.map((tool) => (
                <option key={tool.name} value={tool.name}>
                  {tool.name}
                </option>
              ))}
            </select>
          </label>
          {selected && <p className="hint">{selected.description}</p>}
          <label>
            Arguments (JSON)
            <textarea value={argsText} onChange={(e) => setArgsText(e.target.value)} spellCheck={false} />
          </label>
          <div className="controls">
            <button className="primary" onClick={callTool} disabled={!canCall || busy}>
              {busy ? "Calling…" : "Call tool as agent"}
            </button>
          </div>
          {response && (
            <pre className={"response" + (response.isError ? " error" : "")}>
              <code>{JSON.stringify(response, null, 2)}</code>
            </pre>
          )}
        </>
      )}

      <h3>Activity</h3>
      {log.length === 0 ? (
        <p className="hint">Tool calls, from this console or a real agent, appear here.</p>
      ) : (
        <ul className="log">
          {log.map((entry) => (
            <li key={entry.id} className={entry.error ? "err" : ""}>
              <span className="muted">{entry.at.toLocaleTimeString()}</span> {entry.name}(
              {JSON.stringify(entry.args)}) → {summarize(entry)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
