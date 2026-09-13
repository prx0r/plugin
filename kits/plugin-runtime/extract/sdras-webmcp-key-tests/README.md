# WebMCP Key Tests

A small React demo about `key`, and why the same identity that keeps React's
DOM in sync with your data is what lets a WebMCP agent operate on that data
safely.

One page, two tabs at the top: the **demo**, and an **analysis** of what the
demo shows when measured against the native API. `?page=analysis` opens the
analysis tab directly. Switching tabs unmounts the other page, so the demo's
tools unregister while you read the analysis, and the agent's tool list stays
in lockstep with what is on screen.

## The demo

Three sections:

1. **A simple list, with and without keys.** Two columns render the same
   array. One omits `key`, the other uses `key={item.id}`. Type a note in a
   row, add an item to the top, and watch the unkeyed column put your note
   next to the wrong item.
2. **Dynamic lists need keys minted at creation.** Items arrive at runtime
   (buttons, or a live feed). Three columns: `key={index}`,
   `key={Math.random()}` generated in render, and `key={item.id}` assigned
   once when the item is created. A "re-render parent only" button shows the
   random-key column being torn down with no data change at all.
3. **WebMCP tools driving the dynamic list.** Five tools (`list-items`,
   `add-item`, `remove-item`, `move-item`, `rename-item`) are registered with
   `document.modelContext` using the imperative API. Every mutating tool takes
   an `id`, which is the same value the list uses as its React key. A tab
   switches between two implementations of the same registration:
   - **[`use-webmcp-tool`](https://www.npmjs.com/package/use-webmcp-tool)**, one hook call per tool (`src/webmcp/HookTools.jsx`)
   - **by hand**, `registerTool` + `AbortController` in a `useEffect` (`src/webmcp/ImperativeTools.jsx`)

   Switching tabs unmounts one and mounts the other, so you can watch tools
   unregister and re-register. A "break it" checkbox re-renders the list with
   index keys so the agent's correct edit still leaves the UI out of sync.

## The analysis

The Analysis tab asks whether WebMCP needs a key concept of its own, or whether
the demo's approach (ids minted at creation, passed as tool arguments) is
enough. The short version, measured in Chrome 152 on 2026-09-06:

- **Data identity is userland, and solved.** Against the native API, a note
  typed on a row survived an agent adding, moving, removing and renaming items
  around it. With `key={index}` the same edits put the note on the wrong item.
- **Tool identity is a spec gap.** A registration's only identity is its
  `name`; `registerTool` resolves to `undefined` and nothing can be updated in
  place. Every description or schema change is an unregister plus a register,
  which fires two `toolchange` events and, in Chrome 152, loses any call in
  flight.

The page has a "measure this browser" button so the numbers can be
re-checked on any build: it runs identity probes against
`document.modelContext` (`src/analysis/nativeProbes.js`) and cleans up after
itself.

## Run it

```sh
npm install
npm run dev
```

