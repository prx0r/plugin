# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: WebMCP spec authors and Chrome engineers, arriving from a link in a
webmachinelearning/webmcp issue thread. They are evaluating a specific claim
("does WebMCP need a key concept of its own?") and want to see the evidence,
reproduce it on their own build, and read the code that produced it. They
already know React, MCP, and the spec; they do not need the basics explained.

Secondary (inferred from the repo, not confirmed): React developers who land
here from the README or a share and use the first two demo sections to learn
why `key` identity matters.

## Product Purpose

A single-page React app that demonstrates, and then measures, that the
identity React uses to keep the DOM in sync with data (`key`) is the same
identity a WebMCP agent needs to operate on that data safely. It exists to
turn an argument about the spec into something reproducible: a demo tab where
the failure modes are visible, and an analysis tab where two "measure this
browser" buttons re-run the probes against whatever `document.modelContext`
the visitor has.

Success is a spec author or Chrome engineer reading the analysis, pressing
"measure this browser", getting the same rows (or a different row on a newer
Chrome), and coming away with a precise view of which identity problems are
userland and which are spec gaps.

## Positioning

Not a tutorial about React keys and not an opinion piece about WebMCP. The
page's mechanism is that every claim is backed by a probe the visitor can run
in their own browser, against the native API, with the source next to it. The
same list state is driven by two independent registration styles (the
`use-webmcp-tool` hook and a hand-written `registerTool` + `AbortController`),
so a finding cannot be blamed on one implementation. The author maintains
`use-webmcp-tool`, and the analysis reports that hook's own bugs, which is the
credibility the page trades on.

## Operating Context

- Opened from a GitHub issue thread, usually in Chrome with
  `chrome://flags/#enable-webmcp-testing` and the WebMCP extension. A status
  line in the WebMCP section, and on the Analysis tab, reports native /
  simulator / not detected.
- Visitors without the flag can install an in-page simulator
  (`src/lib/modelContextShim.js`, or `?sim`). The simulator deliberately
  differs from Chrome (returns `undefined` from `registerTool`, replaces
  duplicate names) and the page says so.
- The two tabs are `demo` (default) and `analysis` (`?page=analysis`).
  Switching tabs unmounts the other page, which unregisters the demo's tools;
  that lifecycle is itself part of what the page shows.
- Developers run it with `npm install && npm run dev` (Vite). There is no
  deployed URL recorded yet.
- The code is meant to be read alongside the page. `README.md` maps every file
  in `src/` to its role, and the analysis names files by path.

## Capabilities and Constraints

Confirmed functionality:

- Demo section 1: the same array rendered with and without `key`; typing a
  note then prepending an item shows the unkeyed column desync.
- Demo section 2: dynamic list rendered under `key={index}`,
  `key={Math.random()}`, and `key={item.id}` (id minted once in
  `makeItem()`), plus a "re-render parent only" control.
- Demo section 3: five tools (`list-items`, `add-item`, `remove-item`,
  `move-item`, `rename-item`) registered on `document.modelContext`, each
  mutating tool taking the item `id` that is also the React key. A tab
  switches between the hook and by-hand registrations. A "break it" checkbox
  switches the list to index keys so an agent's correct edit still desyncs
  the UI. An in-page "Agent console" calls any registered tool with JSON.
- Analysis tab: the written answer, a native-API probe runner
  (`src/analysis/nativeProbes.js`), a spec-issue list, and takeaways.

Hard constraint (confirmed):

- **Measurements stay factual.** The Chrome version, the measurement date,
  issue numbers, probe outcomes, and the description of the hook's bugs are
  evidence. They must never be softened, rounded, generalized, or restated
  as if measured on a browser they were not. New numbers come only from
  re-running the probes, and the recorded date and version move with them.

Current facts that are not hard constraints (the user did not pin them):

- The shim path exists and currently works without the flag.
- The app is one page with two tabs and no router.
- File names shown on the page currently match the repo.

Terminology in use: "key" (React), "id" (the value minted at item creation,
also the tool argument), "tool identity" (a registration's `name`), "native"
vs "simulator" (the source of `document.modelContext`), "probe" (one
measured scenario), "in flight" (a tool call executing while its registration
is aborted).

Technical: React 19, Vite 6, `use-webmcp-tool` 0.2.0. StrictMode double-mount
is relevant to the findings and must not be disabled to hide them.

## Brand Commitments

None made binding. The page is published under the author's own name, not
under a company or the spec's identity. The README's voice (plain, exact,
unhurried, no marketing claims) is the current register but was not declared
a constraint.

## Evidence on Hand

- Measured findings in Chrome 152 on 2026-09-06 against the native API, with
  the probe code that produced them in `src/analysis/`. Both runners re-check
  the numbers on any build.
- Spec issue references in `src/pages/Analysis.jsx`: #234, #167, #199, #262, #300,
  #218 (closed by PR #248, 2026-08-19), #101.
- Two independent registration implementations that reproduce the same
  behaviour: `src/webmcp/HookTools.jsx` and `src/webmcp/ImperativeTools.jsx`.
- The hook's two observed bugs (reports `registered` on a name collision;
  one unhandled `AbortError` per tool per StrictMode mount).

Absent, and not to be fabricated: results from any Chrome other than 152,
testimonials, adoption numbers, any statement about what the spec editors
have decided, and any claim that a fix has shipped unless a version is named.

## Product Principles

1. **Every claim has a button.** If the page asserts something about the
   API, the visitor can re-run the probe that produced it in their own
   browser, and the result is labelled with the source it ran against.
2. **Show the failure, not just the fix.** The unkeyed, index-keyed, and
   random-keyed columns stay on the page next to the correct one so the
   desync is witnessed, not described.
3. **Separate userland from spec.** Data identity (ids minted at creation)
   is solved in userland; tool identity (name-only, no handle, no update) is
   the spec's. The page never blurs the two.
4. **Two implementations, one behaviour.** A finding that reproduces in both
   the hook and the by-hand registration is a finding about the platform.
5. **Evidence is dated and versioned.** Numbers travel with the Chrome
   version and date they were taken on, and the page invites re-measurement
   rather than claiming permanence.
