import { useEffect, useState } from "react";
import { Star } from "./icons.jsx";

// One list row. It carries three kinds of per-row state so you can see what
// React keeps or throws away:
//   - an uncontrolled <input>: DOM state React never reads
//   - `starred`: React state
//   - `mountedAt`: when this component instance was created
// The row flashes when it mounts, so a remount is visible at a glance. It also
// remembers which item it was created for: when React hands this instance a
// different item (which only happens when children are matched by position),
// the row says so, because the note, star and timer beside it still belong
// to the item it was made for. A keyed row never earns that tag.
export function Row({ item }) {
  const [starred, setStarred] = useState(false);
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(mountedAt);
  const [createdFor] = useState(() => item.id);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const age = Math.round((now - mountedAt) / 1000);
  const reassigned = createdFor !== item.id;
  const explanation = `This row was created for #${createdFor}. React matched it to #${item.id} by position, so the note, star and timer here still belong to #${createdFor}.`;

  return (
    <li className="row">
      <span className="row-id">#{item.id}</span>
      <span className="row-text">
        <span className="row-name" title={item.text}>
          {item.text}
        </span>
        {reassigned && (
          <span className="row-was" title={explanation}>
            was #{createdFor}
          </span>
        )}
      </span>
      <input className="row-note" placeholder="type a note…" aria-label={`Note for ${item.text}`} />
      <button
        type="button"
        className={"star" + (starred ? " on" : "")}
        aria-pressed={starred}
        aria-label={`Star ${item.text}`}
        onClick={() => setStarred((s) => !s)}
      >
        <Star filled={starred} />
      </button>
      <span className="row-age" title="Seconds since this row was mounted">
        {age}s
      </span>
    </li>
  );
}
