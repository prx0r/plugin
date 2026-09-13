// Tool definitions shared by both registration styles (HookTools.jsx and
// ImperativeTools.jsx). Every mutating tool addresses an item by `id` — the
// same value the list uses as its React key — never by position, because a
// position is only true until the next change.
//
// `getActions` is read at call time so tools always see the latest list.
// `log` records each call for the on-page activity log.

const idProp = {
  type: "number",
  description: "The item's id, as returned by list-items or add-item.",
};

export function buildToolSpecs(getActions, log) {
  const traced =
    (name, run) =>
    async (args = {}) => {
      try {
        const result = await run(args ?? {});
        log?.({ name, args, result });
        return result;
      } catch (error) {
        log?.({ name, args, error: error?.message ?? String(error) });
        throw error;
      }
    };

  return [
    {
      name: "list-items",
      description:
        "List every item on the packing list in display order. Each entry has a stable `id` (use it to refer to the item in other tools) and its current `index` (changes whenever the list changes).",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: traced("list-items", () =>
        getActions()
          .list()
          .map((item, index) => ({ id: item.id, text: item.text, index }))
      ),
    },
    {
      name: "add-item",
      description: "Add an item to the packing list and return its new id.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "What to pack, e.g. 'Bear spray'." },
          position: {
            type: "string",
            enum: ["top", "bottom"],
            description: "Where to insert it. Defaults to bottom.",
          },
        },
        required: ["text"],
      },
      execute: traced("add-item", ({ text, position }) => {
        const item = getActions().add(String(text), position === "top" ? "top" : "bottom");
        return `Added "${item.text}" with id ${item.id}.`;
      }),
    },
    {
      name: "remove-item",
      description: "Remove an item from the packing list by id.",
      inputSchema: { type: "object", properties: { id: idProp }, required: ["id"] },
      execute: traced("remove-item", ({ id }) => {
        const item = getActions().remove(id);
        return `Removed "${item.text}" (id ${item.id}).`;
      }),
    },
    {
      name: "move-item",
      description: "Move an item to a new position in the list.",
      inputSchema: {
        type: "object",
        properties: {
          id: idProp,
          index: { type: "number", description: "Zero-based position to move the item to. 0 is the top." },
        },
        required: ["id", "index"],
      },
      execute: traced("move-item", ({ id, index }) => {
        const item = getActions().move(id, index);
        return `Moved "${item.text}" (id ${item.id}) to position ${index}.`;
      }),
    },
    {
      name: "rename-item",
      description: "Change an item's text. The item keeps its id.",
      inputSchema: {
        type: "object",
        properties: { id: idProp, text: { type: "string", description: "The new text." } },
        required: ["id", "text"],
      },
      execute: traced("rename-item", ({ id, text }) => {
        const item = getActions().rename(id, String(text));
        return `Renamed id ${item.id} to "${item.text}".`;
      }),
    },
  ];
}

export const TOOL_NAMES = ["list-items", "add-item", "remove-item", "move-item", "rename-item"];
