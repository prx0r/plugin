// Ids are minted exactly once, when an item is created, and stored on the
// item. That single decision is what makes `key={item.id}` stable for the
// item's whole life — and what lets an agent refer to the same item later.
let nextId = 1;

export function makeItem(text) {
  return { id: nextId++, text };
}

const STARTER = ["Tent", "Sleeping bag", "Headlamp", "Camp stove"];

export function starterItems() {
  return STARTER.map(makeItem);
}

// The list every section starts from, minted once at module load rather than
// inside each section's useState: StrictMode calls state initializers twice in
// development, which would burn ids and start each section at a different
// number. Items are never mutated in place, so sections can share these.
export const initialItems = starterItems();

const MORE = [
  "Water filter",
  "Trail mix",
  "First-aid kit",
  "Rain shell",
  "Map",
  "Matches",
  "Enamel mug",
  "Hammock",
  "Sunscreen",
  "Rope",
  "Lantern",
  "Compass",
];
let cursor = 0;

export function nextText() {
  return MORE[cursor++ % MORE.length];
}

export function shuffle(list) {
  const next = list.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  // Guarantee a visible change for short lists.
  if (next.length > 1 && next.every((item, i) => item === list[i])) {
    [next[0], next[1]] = [next[1], next[0]];
  }
  return next;
}

export function moveInList(list, id, index) {
  const from = list.findIndex((item) => item.id === id);
  if (from === -1) return list;
  const to = Math.max(0, Math.min(list.length - 1, index));
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
