# AgentCom canonical architecture — ensemble synthesis (2026-09-13)

Distilled from 8 cloned repos in /home/ubuntu/vendor (see alpha.md for the
people; this doc is the engineering decisions). Guiding rule from strat.md:
**own external reality, not model orchestration.** Hosts are interchangeable;
the market graph is the moat.

## Layer model (test exactly one thing per layer)
2. HOST COMPAT     does this host support what we use? ← skybridge adaptor + compat matrix
3. MODEL ROUTING   correct tool for the utterance?    ← evals hill-climb
4. EXECUTION       expected result?                   ← existing unit/integration tests
5. UI              renders across host/theme/device?  ← pathological probe apps
6. DISCOVERY       findable + understandable?         ← intel/discovery.json rules
7. OBSERVABILITY   can we diagnose 1–6?              ← signal telemetry + review sessions
```

Positioning (opti.md #2): upstream is commoditizing layer 1 with an official
validator. We do not compete there — we consume it. Our defensible stack is
layers 2–7 plus the market graph underneath: ChatGPT compat, selection evals,
submission checks, discovery optimization, conversion telemetry, and the
proprietary prompt→selection→compatibility datasets no spec project will own.

## Ensemble: what we take from each

- **mcp-spec-check**: gate shape, not their checks. `probe(target) → Report`
  with `CheckDefinition{id,title,why,fixUrl,run}` + pure `interpret()`
  functions; preflight classify (auth/unreachable ≠ fail); REQUIRED vs warn
  split; `pass/warn/fail/inconclusive` four-state; pinned good/bad/ambiguous
  fixtures asserting full matrix + exit codes in CI; `--json` with 0/1/2 exit
  contract. Our gate checks differ (hints complete, schemas stable, latency
  budget, no supplier leakage) but the harness shape is identical.
- **mcp-signal**: telemetry via a **model-invisible tool call**
  (`_meta.ui.visibility:['app']`, readOnly, no context cost). Widget batches
  load/visible/interaction/error/drop-off events; server fans out to storage
  with credentials server-side. Adopt: every widget ships this; every review
  submission gets a reviewer-session event stream (connect/list/select/args/
  execute/render/error/theme/client/latency/result) so we never argue with
  feedback blindly (hunter_h lesson).
- **MCPJam**: eval contract. Cases with expected tool calls
  (`toolCalledWith` + partial arg matching + `onlyToolsCalled:[]` for
  negatives), iterations × concurrency, accuracy + unexpected-call-rate (not
  raw failures), CI gate with baselines and waivers, deterministic predicates
  preferred over LLM-judge. Our packages/evals implements this contract in
  miniature; graduate to their YAML/CI when case counts demand it.
- **Skybridge**: portability shape. Always-on standard transport + optional
  proprietary overlay detected at load; per-method routing table with
  `NotSupportedError` for host-only APIs; dual metadata emit (standard `ui.*`
  + quirk keys); content-hash cache busters; never fork tool identity per
  host. Our capability layer must look like this: `AgentCom Capability →
  plain MCP → MCP App UI → ChatGPT compat → web → API`.
- **xmcp**: submission ergonomics checklist (assets, dark mode, same-domain
  video/legal, 706px screenshots, per-tool permission justifications,
  positive+negative cases, local backup of the form). Encode as gate checks,
  not tribal knowledge.
- **ext-apps (upstream)**: the target. Tool + `ui://` resource + sandbox
  iframe + bidirectional bridge; `registerAppTool/registerAppResource`
  helpers; `migrate-oai-app` mapping as the convergence proof. Watch
  contributors/issues — that is tomorrow's platform. Pin spec version per
  release; never encode docs as timeless truth.
- **mcp-use**: methodology discipline. Pinned harnesses, published fixtures,
  identical workloads, rotated rounds → median, explicit limits, no composite
  scores. Copy the honesty, not the benchmark.

## Canonical service shape

```
capability/            pure domain functions (no MCP, no UI imports)
  index.ts             search/quote/book/status + canonical types
transport/
  server.ts            McpServer + registerAppTool, dual metadata, stateless HTTP
  rest                 same core over POST /v1/* (packages/http)
view/                  standard-bridge-first widget, openai overlay only for gaps
  widget.html
  declarative form     same capability as HTML (apps/web declarativeFormSnippet)
telemetry/
  record_signal        model-invisible tool (layer 7 for layers 1–6)
gate/
  checks.ts            deterministic pre-submission probes (exit 0/1/2)
  evals/*.jsonl        positives / negatives / ambiguous / tool_selection /
                       parameter_extraction / ranking
schemas/
  <capability>/v1.json frozen release artifacts (server asserted equal in CI)
registry/
  capabilities.json    surfaces, versions, status per capability
  experiments.json     open metadata experiments (A/B/C naming live)
  compatibility.json   append-only host/version outcomes
  results/             dated experiment outputs (proprietary loop)
packet/
  chatgpt-app-submission.json  generated from code, committed, backed up
```

Constraints: adding a marketplace never changes tool semantics; tool schemas
frozen across backend iterations (review-cycle decoupling); no supplier-named
operations cross the transport; every rule carries
introduced/last_verified/source/host/spec_version/confidence (xmcp rule).

## Optimizer framework (packages/evals)

hill-climb loop, deterministic-first:

```
eval cases (JSONL-able TS)
   → selector bench (keyword proxy in CI; LLM judge interchangeable)
   → precision / recall / false-positive / parameter-accuracy
   → candidate metadata variant
   → delta on F1 → ship winner
```

The keyword selector is deliberately dumb: it proves the harness and captures
the real SEO dynamic (descriptions written in user language outscore
implementation jargon). Production swaps in model selection (or MCPJam suites)
without changing case format. See packages/evals/src/*.ts.

Density gates operationalize the 545-site finding (opti.md #1): descriptions
are scored for the specificity/brevity sweet spot — `no-marketing` rejects
generic fluff, `sibling-overlap` rejects shared triggers between tools, and
the hill-climb settles "did +30% more description help or hurt" empirically.
`modelSurface()` + `visibilityGate` enforce the app-only helper rule (opti.md
#8): UI helpers never enter the routed set.

## Compiler pipeline (opti.md vision, staged)

```
CAPABILITY → semantic tool design → routing evals → description optimization
→ host-specific compilation → protocol validation → UI/device/theme tests
→ security/CSP checks → discovery metadata → submission checks
→ production telemetry → invocation data → automatic iteration
```

- **Host-specific compilation**: never one universal metadata object. Detect
  negotiated capabilities per host (ChatGPT / Claude / Cursor / VSCode /
  generic) and adapt: visibility flags for app-only tools, `ui.domain` set
  deliberately (it doubles as a branding/homepage anchor on ChatGPT),
  redirect domains declared where round-trip commerce applies, widget URIs
  content-hashed. Lowest common denominator is not the target — portable core
  plus optional host capabilities is.
- **Round-trip commerce** is a first-class capability, not an outbound link:
  search → merchant checkout on an approved redirect domain → redirectUrl back
  into the originating conversation. Design transaction tools for the return
  leg from day one.
- **Model retry test**: feed wrong args, retry twice, and assert the resulting
  conversation stays usable (no iframe spam). Prefer light or no widget on
  intermediate/error results.
- **Widget budget** (streaming is blocked by whole-HTML-in-JSON): tiny shell,
  critical CSS inline, deferred JS, lazy noncritical components, no giant
  inline payloads. Measure time-to-interactive per widget.
- **Published-only CSP preflight**: dev-green means nothing. The gate must
  assert production metadata placement (OpenAI `_meta` location, exact
  connect/resource domains, zero dev origins) before every submission.
- **Three datasets from day one**: prompt → tool-selected; definition variant
  → selection rate; host/version → compatibility outcome. Recorded by the
  reviewer-session stream and production signal tool; reviewed weekly to mint
  new eval cases and gate checks.

## Probe-app methodology (Gavin Ching rule)

Don't learn the platform with the flagship app. Ship tiny pathological apps,
each probing one boundary (mobile write support, PIP lifecycle, connection-time
resource loading, CSP edges, dark mode, Free-tier invocation). Promote findings
to gate checks + intel entries with version stamps.
