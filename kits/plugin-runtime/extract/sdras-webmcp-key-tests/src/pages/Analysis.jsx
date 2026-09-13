import { useCallback, useState } from "react";
import { NATIVE_PROBE_REFERENCE, runNativeProbes } from "../analysis/nativeProbes.js";
import { Alert, Check, Cross } from "../components/icons.jsx";

const MEASURED = "Chrome 152, native API, 2026-09-06";
const REFERENCE = "Chrome 152";
const SPEC = "https://github.com/webmachinelearning/webmcp";

const ISSUES = [
  ["#234", "registerTool should return the registered tool instead of undefined. A handle is the missing key."],
  ["#167", "Dynamic tool definitions: an updateTool() that changes description or schema while preserving identity."],
  ["#199", "Frameworks and WebMCP meta-issue: stale closures, register rarely but read state fresh at execution, and a stable key separate from the tool's name so a re-registration updates in place."],
  ["#262", "WebMCP loses important context when tools appear or disappear. The cost of every unregister-plus-register pair."],
  ["#300", "Unregistration must not fail an in-flight execution, including a tool that unregisters itself from inside execute()."],
  ["#218", "Closed by PR #248 (2026-08-19): in-flight executions survive unregistration. Chrome 152 predates it."],
  ["#101", "Why a duplicate name is an error, not a replace: a third-party script must not be able to take over a first-party tool."],
];

// A live cell that matches the reference says so once instead of repeating
// the reference text; only a differing result is worth reading twice.
const Same = () => (
  <span className="same">
    <Check /> same
  </span>
);

function Source({ mcp, onInstallShim }) {
  if (!mcp.supported) {
    return (
      <div className="status none">
        <Cross />
        <span>
          No <code>document.modelContext</code>. Enable <code>chrome://flags/#enable-webmcp-testing</code> for real
          numbers, or{" "}
          <button type="button" onClick={onInstallShim}>
            measure the in-page simulator instead
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
          Measuring the in-page simulator. It returns <code>undefined</code> from <code>registerTool</code> and replaces
          duplicate names, so expect the live column to differ from Chrome.
        </span>
      </div>
    );
  }
  return (
    <div className="status native">
      <Check />
      <span>
        Measuring the native <code>document.modelContext</code> in {navigator.userAgent.match(/Chrome\/(\d+)/)?.[0] ?? "this browser"}.
      </span>
    </div>
  );
}

function NativeProbes({ mcp, running, setRunning }) {
  const [rows, setRows] = useState(null);
  const busy = running === "native";

  const run = useCallback(async () => {
    setRunning("native");
    setRows([]);
    try {
      await runNativeProbes(document.modelContext, (row) => setRows((prev) => [...(prev ?? []), row]));
    } finally {
      setRunning(null);
    }
  }, [setRunning]);

  const live = (probe) => rows?.find((row) => row.probe === probe);
  const done = rows !== null && !busy;
  const stopped = rows?.find((row) => row.probe === "Probe run stopped");
  const differing = done ? NATIVE_PROBE_REFERENCE.filter(([probe, reference]) => live(probe)?.result !== reference).length : 0;
  const total = NATIVE_PROBE_REFERENCE.length;

  return (
    <>
      <div className="controls">
        <button className="primary" onClick={run} disabled={!mcp.supported || !mcp.canCall || running !== null}>
          {busy ? "Measuring…" : rows ? "Measure again" : "Measure this browser"}
        </button>
        {/* The verdict replaces the hint once a run settles, so the result is
            stated in one line rather than left to a scan of the table. */}
        <span className="hint" role="status">
          {!done ? (
            <>
              Registers and aborts eleven throwaway tools named <code>probe_*</code>, then cleans up.
            </>
          ) : stopped ? (
            `Stopped early: ${stopped.result}. ${rows.length - 1} of ${total} probes ran.`
          ) : differing === 0 ? (
            `Matches ${REFERENCE} on all ${total} probes.`
          ) : (
            `Differs from ${REFERENCE} on ${differing} of ${total} probes. Those rows are highlighted.`
          )}
        </span>
      </div>
      <div className="table-wrap">
        <table className="results">
          <thead>
            <tr>
              <th>Probe</th>
              <th>{MEASURED}</th>
              <th className="live">This browser</th>
            </tr>
          </thead>
          <tbody>
            {NATIVE_PROBE_REFERENCE.map(([probe, reference]) => {
              const row = live(probe);
              const cls = "mono live" + (!row ? " pending" : row.result !== reference ? " differs" : "");
              return (
                <tr key={probe}>
                  <td>{probe}</td>
                  <td className="mono">{reference}</td>
                  <td className={cls}>
                    {row ? row.result === reference ? <Same /> : row.result : busy ? "…" : rows ? "skipped" : "not measured yet"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function AnalysisPage({ mcp, onInstallShim }) {
  // The runner counts toolchange events and registerTool calls on the shared
  // modelContext, so only one run happens at a time.
  const [running, setRunning] = useState(null);

  return (
    <>
      <main>
        <section id="answer" className="demo">
          <div className="section-head">
            <h2>The short answer</h2>
            <p className="lede">
              The analysis question is whether WebMCP itself needs a key concept for
              that to hold, or whether userland can carry it. The answer splits by <em>what</em> is being identified.
            </p>
          </div>
          <div className="cards">
            <div className="card tone-good">
              <h3>
                <span className="tag">Userland</span> Data identity
              </h3>
              <p>
                Ids passed as tool arguments keep React, app state and the agent in agreement. Against the native
                API, a note typed on Headlamp survived an agent adding an item to the top, moving Headlamp to
                position 0, removing Tent and renaming Camp stove. With <code>key={"{index}"}</code> the same edits
                left the note next to the wrong item. No spec change needed.
              </p>
            </div>
            <div className="card tone-warn">
              <h3>
                <span className="tag">Spec gap</span> Tool identity
              </h3>
              <p>
                A registration's only identity is its <code>name</code>. <code>registerTool</code> resolves to{" "}
                <code>undefined</code>, so there is no handle, and nothing can be updated in place. Changing a
                description or schema means unregister plus register: two <code>toolchange</code> events and, in
                Chrome 152, a lost result for any call in flight. Userland cannot hide that from the agent.
              </p>
            </div>
          </div>
        </section>

        <section id="native" className="demo">
          <div className="section-head">
            <h2>What the native API does with identity</h2>
            <p className="lede">
              Each row is one probe from <code>src/analysis/nativeProbes.js</code>. The middle column is what Chrome
              152 returned. Press the button to measure the browser you are in; the live column is highlighted where
              it differs.
            </p>
          </div>
          <Source mcp={mcp} onInstallShim={onInstallShim} />
          <NativeProbes mcp={mcp} running={running} setRunning={setRunning} />
          <div className="callout">
            <div className="callout-side">
              <span className="callout-label">What to notice</span>
            </div>
            <ul>
              <li>
                <strong>The name is the key.</strong> A descriptor captured before a re-registration still runs
                whatever currently owns that name. Agents that cache tool lists keep working, and an agent can never
                tell that a tool was replaced.
              </li>
              <li>
                <strong>Collisions are errors, not warnings.</strong> A second registration with the same name is
                rejected with <code>InvalidStateError</code>. That was chosen deliberately (issue #101) so a
                third-party script cannot silently take over a first-party tool.
              </li>
              <li>
                <strong>Unregistering is not free.</strong> In Chrome 152 an abort mid-call loses the result. Spec
                PR #248 (merged 2026-08-19) says in-flight calls must survive, and Chrome 153 reportedly does that;
                issue #300 asks for the self-unregistration case to be spelled out.
              </li>
            </ul>
          </div>
        </section>


        <section id="takeaways" className="demo">
          <div className="section-head">
            <h2>What follows</h2>
          </div>
          <div className="cards">
            <div className="card tone-warn">
              <h3>
                <span className="tag">Spec gap</span> Ask of the spec
              </h3>
              <ul className="prose">
                <li>
                  <strong>A handle from <code>registerTool</code></strong> (issue #234) and{" "}
                  <strong>an update path that keeps identity</strong> (issue #167). Together they are the missing
                  key: a way to change what the agent sees about a tool without a gap in the event stream and
                  without cancelling work.
                </li>
                <li>
                  <strong>Not needed:</strong> any key concept for the data a tool operates on. That belongs to the
                  page.
                </li>
              </ul>
            </div>
            <div className="card tone-good">
              <h3>
                <span className="tag">Userland</span> Keep in userland
              </h3>
              <ul className="prose">
                <li>
                  <strong>Item identity.</strong> Ids as tool arguments are correct. Chrome's guidance prefers
                  natural-language values over opaque ids, so let mutating tools accept either an id or a text match
                  and resolve inside <code>execute</code>.
                </li>
                <li>
                  <strong>Static descriptions.</strong> Put live data in a read-only tool's output, never in another
                  tool's description.
                </li>
              </ul>
            </div>
          </div>
          <div className="prose">
            <p>
              <strong>Spec issues to follow</strong>
            </p>
            <ul className="issues">
              {ISSUES.map(([id, text]) => (
                <li key={id}>
                  <a href={`${SPEC}/issues/${id.slice(1)}`} target="_blank" rel="noopener">
                    {id}
                  </a>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer>
        <a href={SPEC} target="_blank" rel="noopener">
          WebMCP spec
        </a>
        {" · "}
        <a href={`${SPEC}/issues`} target="_blank" rel="noopener">
          spec issues
        </a>
        {" · "}
        <a href="https://github.com/GoogleChromeLabs/use-webmcp-tool" target="_blank" rel="noopener">
          use-webmcp-tool
        </a>
      </footer>
    </>
  );
}
