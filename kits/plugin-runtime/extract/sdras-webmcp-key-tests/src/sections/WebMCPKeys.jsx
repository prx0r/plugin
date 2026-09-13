import { useCallback, useState } from "react";
import { ItemList } from "../components/ItemList.jsx";
import { Alert, Check, Cross } from "../components/icons.jsx";
import { TabList, tabPanelProps } from "../components/TabList.jsx";
import { initialItems } from "../lib/items.js";
import { AgentConsole } from "../webmcp/AgentConsole.jsx";
import { HookTools } from "../webmcp/HookTools.jsx";
import { ImperativeTools } from "../webmcp/ImperativeTools.jsx";
import { useListActions } from "../webmcp/useListActions.js";
import hookSource from "../webmcp/HookTools.jsx?raw";
import imperativeSource from "../webmcp/ImperativeTools.jsx?raw";
import specsSource from "../webmcp/toolSpecs.js?raw";

const EXTENSION_URL =
  "https://chromewebstore.google.com/detail/webmcp-model-context-tool/gbpdfapgefenggkahomfgkhfehlcenpd";

const IMPLS = [
  { key: "hook", label: "use-webmcp-tool hook" },
  { key: "imperative", label: "Imperative API, by hand" },
];

let logId = 0;

function McpStatus({ mcp, onInstallShim }) {
  if (!mcp.supported) {
    return (
      <div className="status none">
        <Cross />
        <span>
          <code>document.modelContext</code> not found. Install the{" "}
          <a href={EXTENSION_URL} target="_blank" rel="noopener">
            WebMCP extension
          </a>{" "}
          and enable <code>chrome://flags/#enable-webmcp-testing</code>, or{" "}
          <button type="button" onClick={onInstallShim}>
            use the in-page simulator
          </button>
        </span>
      </div>
    );
  }
  if (mcp.source === "shim") {
    return (
      <div className="status shim">
        <Alert />
        <span>
          In-page simulator active: tools register on a shimmed <code>document.modelContext</code>. For a
          real agent, install the{" "}
          <a href={EXTENSION_URL} target="_blank" rel="noopener">
            extension
          </a>{" "}
          and enable the flag, then reload.
        </span>
      </div>
    );
  }
  return (
    <div className="status native">
      <Check />
      <span>
        <code>document.modelContext</code> is live. The tools below are visible to your agent.
      </span>
    </div>
  );
}

export function WebMCPKeys({ mcp, onInstallShim }) {
  const { items, actions } = useListActions(initialItems);
  const [impl, setImpl] = useState("hook");
  const [keyBy, setKeyBy] = useState("id");
  const [log, setLog] = useState([]);

  const appendLog = useCallback((entry) => {
    setLog((prev) => [{ ...entry, id: ++logId, at: new Date() }, ...prev].slice(0, 12));
  }, []);

  const Tools = impl === "hook" ? HookTools : ImperativeTools;

  return (
    <section id="webmcp" className="demo">
      <div className="section-head">
        <h2>WebMCP tools driving the dynamic list</h2>
        <p className="lede">
          Every tool here addresses an item by the{" "}
          <em>same id React uses as the key</em>, so React, your state and the agent all agree on which item
          is which. Type a note in a row, then have the agent add, move, rename or remove items around it.
        </p>
      </div>

      <McpStatus mcp={mcp} onInstallShim={onInstallShim} />

      <div className="controls">
        <TabList
          className="tabs"
          idBase="impl"
          label="Registration style"
          tabs={IMPLS}
          selected={impl}
          onSelect={setImpl}
        />
        <div {...tabPanelProps("impl", impl)}>
          {/* Keyed on support so the tools re-register if the API appears later
              (e.g. the simulator is installed after mount). */}
          <Tools key={`${impl}:${mcp.supported}`} actions={actions} log={appendLog} supported={mcp.supported} />
        </div>
      </div>

      <div className="columns two">
        <div className="stack">
          <ItemList
            title={keyBy === "id" ? "what the agent edits" : "out of sync on purpose"}
            tone={keyBy === "id" ? "good" : "bad"}
            items={items}
            keyBy={keyBy}
          />
          <label className="switch">
            <input
              type="checkbox"
              checked={keyBy === "index"}
              onChange={(e) => setKeyBy(e.target.checked ? "index" : "id")}
            />
            <span>
              Break it: render this list with <code>key={"{index}"}</code>
            </span>
          </label>
        </div>
        <AgentConsole mcp={mcp} items={items} log={log} />
      </div>

      <div className="callout">
        <div className="callout-side">
          <span className="callout-label">What to look for</span>
        </div>
        <ul>
          <li>
            <strong>Target IDs, never array positions.</strong> <code>list-items</code> returns both an <code>id</code> and an{" "}
            <code>index</code>, but every mutating tool takes only the id. Index paths become invalid the moment any item shifts, including from actions the agent just executed.
          </li>
          <li>
            <strong>Same root cause, different trigger.</strong> Toggle "Break it", add a note to row one, then have the agent delete that row. Even though the agent sends the correct payload, the UI breaks state because the DOM bound to positional indexes rather than stable IDs.
          </li>
          <li>
            <strong>Lifecycle & cleanup.</strong> Switching tabs unmounts the active implementation and mounts the new one. The initial toolset unregisters via its AbortSignal, and the new toolset registers. The custom hook abstracts this automatically, whereas the imperative approach handles the teardown and setup manually.
          </li>
        </ul>
      </div>

      <details className="code">
        <summary>Source: {impl === "hook" ? "HookTools.jsx (with use-webmcp-tool)" : "ImperativeTools.jsx (by hand)"}</summary>
        <pre>
          <code>{impl === "hook" ? hookSource : imperativeSource}</code>
        </pre>
      </details>
      <details className="code">
        <summary>Source: toolSpecs.js (shared by both)</summary>
        <pre>
          <code>{specsSource}</code>
        </pre>
      </details>
    </section>
  );
}
