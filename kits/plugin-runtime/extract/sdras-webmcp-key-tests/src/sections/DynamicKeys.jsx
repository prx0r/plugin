import { useEffect, useReducer, useState } from "react";
import { ItemList } from "../components/ItemList.jsx";
import { initialItems, makeItem, nextText, shuffle, starterItems } from "../lib/items.js";

const SNIPPET = `// Mint the id once, when the item is created — never in render.
let nextId = 1;
const makeItem = (text) => ({ id: nextId++, text });

// ✗ position: changes whenever the list changes
items.map((item, index) => <Row key={index} item={item} />)

// ✗ a new identity on every render: every row remounts every time
items.map((item) => <Row key={Math.random()} item={item} />)

// ✓ stable for the item's whole life
items.map((item) => <Row key={item.id} item={item} />)`;

const FEED_MAX = 7;

export function DynamicKeys() {
  const [items, setItems] = useState(initialItems);
  const [live, setLive] = useState(false);
  // Re-renders this component without touching the data.
  const [, rerenderParent] = useReducer((n) => n + 1, 0);

  // A "live feed": new items arrive at the top, old ones fall off the bottom.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      setItems((prev) => [makeItem(nextText()), ...prev].slice(0, FEED_MAX));
    }, 1500);
    return () => clearInterval(timer);
  }, [live]);

  return (
    <section id="dynamic" className="demo">
      <div className="section-head">
        <h2>Dynamic lists need keys added at creation</h2>
        <p className="lede">
          Items arrive at runtime. Each one gets an id <em>when it is created</em>, and that id lives on
          the item. The ids are either index, random, or stable. The stable id is the only one that survives moves, shuffles and re-renders.
        </p>
      </div>

      <div className="controls">
        <button className="primary" onClick={() => setItems((prev) => [makeItem(nextText()), ...prev])}>
          Add to top
        </button>
        <button onClick={() => setItems((prev) => [...prev, makeItem(nextText())])}>Add to bottom</button>
        <button onClick={() => setItems((prev) => prev.slice(1))} disabled={items.length === 0}>
          Remove first
        </button>
        <button onClick={() => setItems((prev) => shuffle(prev))}>Shuffle</button>
        <button onClick={rerenderParent} title="Calls setState on the parent with no data change">
          Re-render parent only
        </button>
        <label className="switch">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          Live feed
        </label>
        <span className="spacer" />
        <button
          onClick={() => {
            setLive(false);
            setItems(starterItems());
          }}
        >
          Reset
        </button>
      </div>

      <div className="columns three">
        <ItemList title="by position" tone="bad" items={items} keyBy="index" />
        <ItemList title="new every render" tone="bad" items={items} keyBy="random" />
        <ItemList title="added at creation" tone="good" items={items} keyBy="id" />
      </div>

      <div className="callout">
        <div className="callout-side">
          <span className="callout-label">What to look for</span>
          <p className="callout-lead">Type a note and star a row in each column first.</p>
        </div>
        <ul>
          <li>
            <strong>Index key:</strong> fine until something moves. “Remove first” shifts every note up one
            row, and “Shuffle” scrambles them.
          </li>
          <li>
            <strong>Random key:</strong> “Re-render parent only” changes nothing in the data, yet every row
            flashes, every note and star is gone, and every timer restarts. That column is torn down and
            rebuilt on each render.
          </li>
          <li>
            <strong>Id key:</strong> only genuinely new rows flash. Notes, stars and timers stay with their
            item through adds, removes, shuffles and the live feed.
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
