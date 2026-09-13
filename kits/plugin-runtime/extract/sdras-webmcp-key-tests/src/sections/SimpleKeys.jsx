import { useState } from "react";
import { ItemList } from "../components/ItemList.jsx";
import { initialItems, makeItem, nextText, shuffle, starterItems } from "../lib/items.js";

const SNIPPET = `// No key: React matches rows by position.
{items.map((item) => <Row item={item} />)}

// Stable key: React matches rows by identity.
{items.map((item) => <Row key={item.id} item={item} />)}`;

export function SimpleKeys() {
  const [items, setItems] = useState(initialItems);

  return (
    <section id="simple" className="demo">
      <div className="section-head">
        <h2>A simple list, with and without keys</h2>
        <p className="lede">
          Both columns render the <em>same array</em>. Type a note in a row and star it, then change the
          list. React tracks which DOM nodes and component state to keep by matching children on their{" "}
          <code>key</code>. With no key it falls back to position.
        </p>
      </div>

      <div className="controls">
        <button className="primary" onClick={() => setItems((prev) => [makeItem(nextText()), ...prev])}>
          Add to top
        </button>
        <button onClick={() => setItems((prev) => prev.slice(1))} disabled={items.length === 0}>
          Remove first
        </button>
        <button onClick={() => setItems((prev) => prev.slice().reverse())}>Reverse</button>
        <button onClick={() => setItems((prev) => shuffle(prev))}>Shuffle</button>
        <span className="spacer" />
        <button onClick={() => setItems(starterItems())}>Reset</button>
      </div>

      <div className="columns two">
        <ItemList title="matched by position" tone="bad" items={items} keyBy="none" />
        <ItemList title="matched by identity" tone="good" items={items} keyBy="id" />
      </div>

      <div className="callout">
        <div className="callout-side">
          <span className="callout-label">What to look for</span>
          <p className="callout-lead">Rows flash when React creates them.</p>
        </div>
        <ul>
          <li>
            <strong>No key:</strong> after “Add to top”, your note and star stay in the <em>first slot</em>,
            now next to the wrong item. The new row flashes at the bottom, because React reused 
            existing nodes in place and appended one.
          </li>
          <li>
            <strong>Stable key:</strong> the note and star travel with their item. Only the new row flashes.
          </li>
          <li>
            Open the console: React warns about the missing key. It isn’t a style nit, it’s React telling
            you it has no way to know which row is which.
          </li>
        </ul>
      </div>

      <details className="code">
        <summary>Code</summary>
        <pre>
          <code>{SNIPPET}</code>
        </pre>
      </details>
    </section>
  );
}
