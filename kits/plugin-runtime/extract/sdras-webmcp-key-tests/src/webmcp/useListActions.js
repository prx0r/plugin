import { useEffect, useMemo, useRef, useState } from "react";
import { makeItem, moveInList } from "../lib/items.js";

// List state plus a stable `actions` object the tools call into. Agents call
// tools between renders, so the actions read the latest committed list through
// a ref instead of closing over a render's `items`.
export function useListActions(initialItems) {
  const [items, setItems] = useState(initialItems);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const actions = useMemo(() => {
    const find = (id) => {
      const numericId = Number(id);
      const item = itemsRef.current.find((candidate) => candidate.id === numericId);
      if (!item) throw new Error(`No item with id ${id}. Call list-items to get current ids.`);
      return item;
    };

    return {
      list: () => itemsRef.current,

      add(text, position = "bottom") {
        const item = makeItem(text);
        setItems((prev) => (position === "top" ? [item, ...prev] : [...prev, item]));
        return item;
      },

      remove(id) {
        const item = find(id);
        setItems((prev) => prev.filter((candidate) => candidate.id !== item.id));
        return item;
      },

      move(id, index) {
        const item = find(id);
        setItems((prev) => moveInList(prev, item.id, Number(index)));
        return item;
      },

      rename(id, text) {
        const item = find(id);
        setItems((prev) => prev.map((candidate) => (candidate.id === item.id ? { ...candidate, text } : candidate)));
        return { ...item, text };
      },
    };
  }, []);

  return { items, setItems, actions };
}
