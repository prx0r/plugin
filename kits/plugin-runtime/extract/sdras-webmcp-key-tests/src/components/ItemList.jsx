import { Row } from "./Row.jsx";

const LABELS = {
  none: { tag: "No key", code: "<Row item={item} />" },
  index: { tag: "Index key", code: "<Row key={index} item={item} />" },
  random: { tag: "Random key", code: "<Row key={Math.random()} item={item} />" },
  id: { tag: "Stable key", code: "<Row key={item.id} item={item} />" },
};

// Renders the same items four different ways. Only the `key` differs.
export function ItemList({ items, keyBy, title, tone }) {
  const label = LABELS[keyBy];
  return (
    <div className={`list tone-${tone}`}>
      <header className="list-head">
        <h3>
          <span className="tag">{label.tag}</span> {title}
        </h3>
        <code>{label.code}</code>
      </header>
      {/* Keyed on the mode so switching strategies rebuilds every row: the
          demo is about what happens within a strategy, not about the old id
          keys happening to collide with the new index keys. */}
      <ul className="rows" key={keyBy}>
        {items.map((item, index) => {
          switch (keyBy) {
            case "none":
              // Deliberately no key. React warns in the console and falls
              // back to matching children by position.
              return <Row item={item} />;
            case "index":
              return <Row key={index} item={item} />;
            case "random":
              // Minted during render: a brand-new identity every time, so
              // React unmounts and remounts every row on every render.
              return <Row key={Math.random()} item={item} />;
            default:
              return <Row key={item.id} item={item} />;
          }
        })}
      </ul>
    </div>
  );
}
