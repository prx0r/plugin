# PLUGIN RUNTIME OPERATING GUIDE — ChatGPT Apps / MCP Apps that actually get called

Compiled from 18 cloned experiment repos, 5397-observation GitGoblin corpus,
13 convergence signals, and every runnable harness found in the wild.
Extracted source lives in `extract/` (see SOURCES.md for licenses).
Our clean-room implementation lives in `runtime/`.

The loop this guide operates:

```text
CAPABILITY
  -> semantic tool design (descriptions that route)
  -> protocol conformance (spec-check)
  -> host-specific compilation (ChatGPT vs Claude vs generic)
  -> tool-selection evals (mcp-eval format)
  -> UI/device/theme tests (conformance runner)
  -> security/CSP preflight
  -> discovery metadata (JSON-LD, registry, llms.txt)
  -> submission checks
  -> production telemetry (reviewer session stream)
  -> invocation data -> automatic iteration
```

Three datasets to collect from day one: prompt-to-tool-selected,
definition-variant-to-selection-rate, host-version-to-compatibility-outcome.
The upstream validator will never give you these. They are the moat.

---

## 1. Repo atlas — what each extract is and when to reach for it

### Conformance and protocol

- `speccheck-*` (Roee-Tsur/mcp-spec-check, MIT). Black-box readiness probe for
  the 2026-07-28 MCP spec. Verdict ready YES/NO/UNKNOWN from 3 required
  checks: `discover` (must implement `server/discover`), `routing-headers`
  (must require `Mcp-Method`/`Mcp-Name`, reject mismatch), `session-independence`
  (no `Mcp-Session-Id` pinning). Warnings: `error-codes` (-32002 legacy becomes
  -32602), `cache-metadata` (ttlMs/cacheScope), `mrtr` (resultType),
  `deprecated-features` (Logging, resources/subscribe), `auth-metadata`
  (RFC9728 well-known). Registry scan of 7850 servers: 1 ready (0.02%).
  Dominant failures are routing-headers (3893) and discover (2773).
  Run: `npx mcp-spec-check https://your-server/mcp --verbose --json`.
  Reference servers under `speccheck-ref-servers` pin exact verdicts in CI.
- `appconformance-*` (alpic-ai/mcp-app-conformance, MIT). WPT-style suite that
  certifies HOSTS, not servers. A reference server exposes one
  `ui://conformance/runner` page that renders in the host iframe, drives the
  bridge, and asserts. `appconformance-catalogue.json` holds 57 requirements,
  ~33 implemented in `appconformance-view/tests.ts`: lifecycle, tool proxy
  calls, app-only tool guards, display modes, sandbox composition, CSP
  allow/deny pairs, theme variables, host context, content modalities.
  ChatGPT measured result in `runner/out/chatgpt/`: 24 PASS / 9 FAIL, failing
  on app-tool-call-guard, undeclared display mode (host switched to pip),
  light-dark, theme fonts, server passthrough, sampling/downloadFile, and the
  CSP audit log. Run: `npx mcp-apps-conformance`, custom hosts by subclassing
  BrowserHost.
- `chatgpthost-src` (alpic-ai/chatgpt-host-conformance, MIT). The 50-line
  worked ChatGPT adapter: widget selector on oaiusercontent iframes, picker
  flow, conversation polling with session token (snapshot lags 30-45s), headed
  Chrome only, tunnel required because hosted ChatGPT cannot reach localhost.
- `stateless-*` (andreban/stateless-mcp, Apache-2.0). Rust Tower router for
  stateless 2026-07-28 only, with 23 integration test files. Proves 403 on
  untrusted/blank Origin, strict -32602 on missing params, no deprecated
  logging. The strictness reference: loose clients break against it, which is
  the point.
- `ext-apps-docs` (modelcontextprotocol/ext-apps, Apache transition). Upstream
  spec docs including `migrate_from_openai_apps.md` (OpenAI-only primitives
  with no clean MCP equivalent yet: widget state persistence, file
  selection/upload, modal and close behavior, open-in-app URLs, redirect
  domains), `testing-mcp-apps.md`, `csp-cors.md`, and patterns.

### Tool-selection evals

- `mcipeval-*` (alpic-ai/mcp-eval, MIT). The invocation tester. YAML test
  cases of input prompt to expected tool plus parameters, run against a
  ChatGPT system prompt with 10 distractor defaults, classifying failures as
  wrong-channel (no call), wrong-tool, or wrong-parameters (subset equality on
  declared keys, extras ignored). Run:
  `npx -y @alpic-ai/mcp-eval@latest run --url=https://... ./myserver.yml -a openai/chatgpt`
  with `OPENROUTER_API_KEY` set.
- `skytemplate-evals` (alpic-ai/apps-sdk-template). The only model-graded eval
  found: `@skybridge/test start({app, model})`, natural prompt, assert called
  tool once. Copy this pattern per tool.

### Telemetry

- `mcp-signal-*` (Roee-Tsur/mcp-signal, MIT). 5.3kB zero-dep widget SDK.
  Events loaded/visible/hidden/closed/error/interaction plus track(), with
  host/theme/locale/viewport context. Two exfil paths: direct fetch when the
  origin is declared in `_meta.ui.csp.connectDomains` (helper generates the
  fragment), and the bridge escape through a model-invisible tool call
  (`_meta.ui.visibility:["app"]`, readOnlyHint, openai private flags).
  Caveats that matter: approval is host prerogative, no confirmed delivery,
  no localStorage, per-load sessions, ~60KiB teardown cap.

### Templates and reference apps

- `skytemplate-src` (Skybridge v2 template). Minimal `start` tool plus
  fortune-cookie, HMR widgets, evals wired in. Start every new app here.
- `appseverything-*` (MCPJam/apps-sdk-everything). The gallery reference for
  every bridge call: callTool, sendFollowUpMessage, requestDisplayMode,
  setWidgetState, openExternal. Hard lessons inside: assetPrefix must equal
  baseURL or `/_next/` 404s in the iframe; the bootstrap rewrites fetch and
  pushState and requires suppressHydrationWarning; keep widgetState under ~4k
  tokens; invoking/invoked strings under 64 chars; readOnlyHint true.
- `openai-apps-sdk-examples` (ISC). Pizzaz, kitchen-sink window.openai
  surface, solar 3D, shopping-cart with widgetSessionId state merging,
  authenticated flows. Shopping-cart README warns demo client-state is wrong
  for prod: persist server-side, backend is truth, session id is only a key.
- `xkcd-app-REFONLY-NOLICENSE`. Python FastMCP reference for the cache
  pattern: generate HTML on callTool, serve from cache on resources/read.
  Base64-inline images to bypass image CSP with URL fallback. Read only.

### Submission experiments

- `advent-chatgpt-app`. Submitted game. Visibility split pattern:
  structuredContent carries the id for the model, `_meta` carries the secret
  word and image for the widget only. Locale from `_meta["openai/locale"]`.
  Manual testing only via dev connector plus ngrok. Documents the Chrome 142
  local-network flag trap.
- `double-iframes`. The full CSP failure ladder: srcdoc alone inherits nonce
  script-src and blocks everything; relaxed CSP inherits chatgpt.com origin
  and enables theft; sandbox allow-scripts gives opaque origin without
  storage; adding same-origin escapes the sandbox; direct https src needs a
  finite frame-src allowlist that cannot cover an open ecosystem. Resolution:
  wildcard sandbox subdomain, outer proxy plus inner srcdoc on per-app
  subdomain, per-app CSP from `_meta.ui.csp`. "CSP is the new CORS."
- `finary-mcp` (MIT). Richest empirical doc. Reverse-engineered auth with
  60-second JWTs and cookie rotation, org versus member scoping gotchas, PUT
  versus PATCH silent-ignore class, batch writes with per-item isolation,
  `z.object({})` requiring explicit empty-object calls, theme palettes lifted
  from the real site, `data-llm` attributes narrowing model context.
- `pokemon-mcp-testing`. Minimal contract-testing pattern in Jest:
  executeTool by name and id, invalid names, listing. Top setup failure is
  path-arg mismatch; STDIO hangs on exit are expected.
- `mcp-ext-apps-docs`. SEP-1865 spec plus Playwright E2E asserting sandbox
  composition, cross-origin isolation, and postMessage injection rejection.
- `awesome-chatgpt-apps` (Apache-2.0). Template index. Stripe template shows
  the payment pattern: list widget plus buy tool opening external Checkout
  through openExternal, never paying inside the iframe. Common failures:
  test/live key mixups, inactive products.

### Web and discovery

- `webmcp-checkout-src`. The key failure study: synchronous agent tools
  racing React state. Always-enabled tools silently overcharge on stale
  state; unregistering while busy makes the agent conclude the capability is
  missing and spam retries. The spec lacks a busy/not-ready primitive, so
  design around it with explicit status tools.
- `webmcp-lib` and `mcp-to-llm` (PaulKinlan). Discovery substrate and
  relay plumbing; `mcp-to-llm` is MIT.
- `awesome-chatgpt-apps` doubles as the listing-format reference.

<!-- PART2 -->

---

## 2. Environment setup — the tunnel-first rule

Every hosted-host failure in the corpus traces to localhost assumptions.
Set this up once, never debug it again.

```bash
# tunnel before anything else; hosted ChatGPT cannot reach localhost
cloudflared tunnel --url http://localhost:3000
# register the https URL in ChatGPT Settings -> Apps & Connectors
# local dev loop: server + ngrok + Developer-mode connector
pnpm dev
ngrok http 3000
```

Chrome 142 traps: disable `chrome://flags/#local-network-access-check` and
restart or local iframes render blank. Python SDK users behind ngrok must set
`MCP_ALLOWED_HOSTS`/`ORIGINS` or DNS rebinding blocks everything. Static
widget HTML is cached aggressively: restart the server after every rebuild
(the `lru_cache` gotcha bit two separate teams). First conformance run needs
a manual login with a persisted profile, and conversation snapshots lag
30-45 seconds, so poll at 8-second intervals and do not assert instantly.

---

## 3. Tool design — descriptions are the ranking lever

André Bandarra's 545-site finding is the highest-value empirical input in the
corpus: vague tools never get selected, verbose tools poison context. Optimize
for the sweet spot with this procedure, run per tool, recorded every time.

Description quality equals intent specificity plus differentiating constraints
plus argument semantics, minus redundant prose, marketing language, and
overlap with sibling tools. Concretely: name the exact intent in the first
clause, state the constraints that separate this tool from its siblings,
document every argument's semantics including edge formats, and delete
everything else. Then evaluate with prompts like "find a .com for an AI
accounting startup", "check whether agentcom.org is registered", "ten
available names under 12 characters", asking three questions: was the right
tool chosen, was a wrong sibling chosen, and did adding 30 percent more
description help or hurt selection. Keep the variant that wins. Record the
selection rate per variant. That table is dataset two and it compounds.

Eval file format, adopted from `mcipeval-*`:

```yaml
server: https://your-server/mcp
agent: openai/chatgpt
test_cases:
  - name: exact-domain-check
    input_prompt: "check whether agentcom.org is registered"
    expected_tool_call:
      tool_name: check_domain
      parameters: { domain: "agentcom.org" }
  - name: sibling-disambiguation
    input_prompt: "give me ten available names under 12 characters"
    expected_tool_call:
      tool_name: suggest_names
      parameters: { max_length: 12, count: 10 }
```

Failure classes to track: wrong-channel (model answered without calling),
wrong-tool (sibling chosen, a description defect), wrong-parameters (schema
or semantics defect, subset-compared on declared keys). Distractor note: run
every eval against the real ChatGPT default toolset, not a clean room, or the
scores lie about production routing.

Schema strictness rules from the corpus: `additionalProperties: false`
everywhere intentional; `z.object({})` rejects omitted args so the widget
must call with an explicit empty object; strict -32602 on missing required
params; tolerant parsers only where humans type free text (the comic-number
extractor pattern: URL, hash-number, bare number).

Model tools must be semantic business operations only. UI helpers like
paginate, resize, thumbnail fetch, and preference saves stay hidden through
app-only visibility wherever the host honors it, and the preflight flags any
leakage, because every visible helper is routing ambiguity plus context tax.

---

## 4. Protocol conformance — the deterministic gate

Run this gate on every build. It is cheap and the registry data says almost
everyone fails it.

```bash
npx mcp-spec-check https://your-server/mcp --verbose --json
```

Required verdicts: `server/discover` implemented, `Mcp-Method`/`Mcp-Name`
headers required with mismatch rejection, no session-id pinning. Warnings
enforced as errors in our preflight: modern -32602 codes, cache metadata,
result types, no deprecated logging or resource subscriptions, RFC9728 auth
metadata through the 401 wall. Stateless-first design per `stateless-*`:
Origin validation with 403 on untrusted or blank browser origins, pass on
missing non-browser origins, header-plus-body fallback for method routing,
ETag and Cache-Control from ttl metadata, 204 for notifications.

Then the host suite for every release: `npx mcp-apps-conformance` against the
reference runner, plus the ChatGPT adapter while it remains the revenue host.
Track the 9 known ChatGPT failures as your compatibility backlog, not as
surprises: app-tool-call-guard, undeclared display modes, light-dark theming,
theme fonts, server passthrough, sampling and download surfacing, app-tools
invocation, and the CSP audit log.

---

## 5. Host compilation — one capability, many metadata

Never emit one universal metadata object. The corpus proves vendor fields
break rival hosts, `ui.domain` formats differ between ChatGPT and Claude,
and responsive behavior diverges. Architecture is capability, host detector,
then per-host metadata adapter with ChatGPT, Claude, Cursor, VSCode, and
generic MCP targets. Skybridge already ships this shape; `runtime/hosts/`
reimplements it clean-room.

ChatGPT field rules, each with a submission scar behind it. `ui.domain` is
branding as well as security: the app name links to it, so lint it for
commercial sense, not just correctness. Declare every connect, resource,
frame, and redirect domain; undeclared means blocked at the worst moment,
which is after publication, because unpublished apps do not enforce the
published CSP path. Test dark mode explicitly since invisible icons are a
real rejection reason. Remove development links from widget CSP before
submitting. `redirect_domains` is the commerce primitive: approved domains
skip the safe-link interstitial and return the user into the same
conversation through redirectUrl, which turns checkout from an outbound link
into a round trip. Payments, file pickers, modals, and anything needing
popups go through openExternal or redirect domains, never inside the iframe.
Widget state persistence, upload APIs, and modal behavior have no portable
equivalent yet, so gate them as optional host capabilities, never core.

## 6. UI and rendering — the retry and state rules

Ship a tiny HTML shell with critical CSS inline, deferred JS, lazy
components, and no enormous inline payloads, because full-HTML-in-JSON
blocks streaming and first paint is a retention lever. Never render
heavyweight widgets for intermediate or error results: every tool retry
spawns another iframe and pushes the answer down the conversation, so the
retry test is wrong-args, retry, retry, then judge whether the conversation
is still usable. Server is the source of truth for all state; client widget
state is a cache keyed by session id, merged, bounded around 4k tokens, with
optimistic patches that roll back. Stale-tool overcharge versus
unregister-retry-spam is the fundamental race: expose explicit busy status
tools instead of toggling registration, since the spec has no not-ready
primitive. Theme through host variables only, test inline against fullscreen
against PiP, paginate long content, escape all injected text, inline small
images as base64 with URL fallback behind error handlers.

## 7. Telemetry — the reviewer sees everything

Every submission gets a reviewer session stream: connect, tool list, tool
select with arguments, execution with latency, widget render with theme and
client, widget errors, and result. Integrate the signal pattern from
`mcp-signal-*`: declare the telemetry origin in CSP metadata, bridge the
rest through the model-invisible tool, keep credentials server-side, expect
fire-and-forget delivery without confirmation, sessions per load, teardown
under 60KiB. The hunter_h lesson is the policy: when review says broken and
telemetry agrees, you fix and resubmit instead of arguing blind. No
telemetry, no submission.

## 8. Discovery — be machine-readable everywhere

MCP Apps are invisible to web discovery by default, so ship the full bundle:
website with a robots-friendly capability page, JSON-LD declaring the app,
endpoint, and platform links, MCP registry listing, ChatGPT app listing,
canonical capability identifier, OpenAPI where applicable, and agent-readable
docs. Every metadata field carries a rule record with introduced version,
last verified date, source, host, spec version, and confidence, because this
ecosystem invalidates documentation monthly and timeless rules are how apps
die.

## 9. Submission preflight — the checklist that gates release

Run `runtime/preflight.py` (section 10) plus the conformance gate plus the
evals plus one real-device pass, and block release on any failure. The
standing checklist: CSP domains declared and matching network behavior;
no dev links in published metadata; dark and light render verified;
display modes declared and honored; app-only tools hidden; descriptions
evaluated against distractors with per-variant selection rates recorded;
schemas strict with explicit empty-object calls; assets served from declared
origins with correct base paths; auth metadata exact through the 401 wall;
redirect and payment flows round-tripping; telemetry streaming reviewer
sessions; discovery bundle published. Known rejection trio to verify twice:
one test case showing no data, theme support gaps, dev links in CSP.

## 10. Iteration — the proprietary loop

Upstream owns protocol validation now. Your edge is the loop: conformance
plus ChatGPT compatibility plus selection evals plus submission checks plus
discovery plus telemetry plus invocation data feeding description and routing
iteration. Review the three datasets weekly, promote winning description
variants, extend the host matrix with every new failure, and re-verify rule
records on a schedule. That is the compiler-optimizer thesis, and this
runtime is its first build.

<!-- APPENDIX -->

## Appendix A. Run-command index

```bash
# protocol gate (every build)
npx mcp-spec-check https://your-server/mcp --verbose --json
# host suite (every release)
npx mcp-apps-conformance
# ChatGPT adapter (headed Chrome, login persisted, tunnel up)
npm run conformance
# selection evals (per tool, per variant)
npx -y @alpic-ai/mcp-eval@latest run --url=https://... ./myserver.yml -a openai/chatgpt
# our preflight (gates release, see runtime/)
python3 runtime/preflight.py --manifest capability.yaml --out preflight.json
# our eval runner (static + live tool-list validation)
python3 runtime/evals_run.py --eval evals/check-domain.yml --url https://...
# discovery bundle (JSON-LD + llms.txt + capability page)
python3 runtime/discovery_build.py --manifest capability.yaml --out public/
```

## Appendix B. Rule records (verify on schedule, never timeless)

| Rule | Introduced | Last verified | Source | Host | Confidence |
|---|---|---|---|---|---|
| Write tool calls unsupported on mobile | 2026-09 | 2026-09-13 | gching speedrun report | chatgpt | 0.85 |
| Widgets plus resources load at connect time | 2026-09 | 2026-09-13 | gching speedrun report | chatgpt | 0.9 |
| CSP metadata must live in `_meta` published path | 2026-08 | 2026-09-13 | inspector issue 1322, conformance | chatgpt | 0.95 |
| `ui.domain` doubles as branding link | 2026-08 | 2026-09-13 | ext-apps discussion 557 | chatgpt | 0.9 |
| `redirect_domains` round-trips into conversation | 2026-08 | 2026-09-13 | ext-apps issue 678 | chatgpt | 0.85 |
| App-only helpers pollute model context | 2026-08 | 2026-09-13 | ext-apps issue 732 | all | 0.95 |
| Retries spawn stacked iframes | 2026-08 | 2026-09-13 | ext-apps issue 731 | all | 0.9 |
| HTML-in-JSON blocks streaming paint | 2026-08 | 2026-09-13 | ext-apps issue 603 | all | 0.9 |
| Chrome 142 local-network flag blanks local iframes | 2026-09 | 2026-09-13 | advent app docs | chatgpt-local | 0.9 |
| Reviewer telemetry decides disputes | 2026-09 | 2026-09-13 | hunter_h review thread | chatgpt | 0.95 |
| Dark-mode icons rejected at review | 2026-09 | 2026-09-13 | xmcp submission guide | chatgpt | 0.9 |
| Legacy `_meta.ui` syntax superseded by `_meta.ui` current format | 2026-08 | 2026-09-13 | xmcp submission guide | chatgpt | 0.8 |
| Only 1 of 7850 registry servers fully ready | 2026-07 | 2026-09-13 | spec-check scan | all | 0.97 |
| Vague vs verbose description tradeoff | 2026-09 | 2026-09-13 | andreban 545-site study | chrome-webmcp | 0.85 |

*End of guide. Build the loop, collect the three datasets, iterate weekly.*

## Appendix C. Second-wave extracts (coverage audit backfill)

- `skill-eval-harness` (MIT). Trigger-eval doctrine that maps 1:1 onto our
  invocation problem: trigger tests must run the real user prompt, detect
  loading from real load evidence (temp skill paths, not names), keep
  trigger cases separate from answer-quality cases, fail closed on missing
  prompts or leaked answer keys, and track saturation separately from lift.
  `LESSONS_LEARNED.md` is required reading before designing evals.
- `a2ui-specification` + `a2ui-docs` (Apache-2.0). Google's agent-to-UI
  protocol with versioned specs (v0.8 through v1.0). Watch it as the second
  convergence target alongside ext-apps; capabilities should avoid semantics
  that cannot survive both envelopes.
- `mattpocock-skills` (MIT, skills plus docs). Real skill corpus across
  engineering, productivity, and product: mine for description patterns that
  trigger reliably, and for the deprecated folder, which shows what stopped
  working.
- `mcpgarden-inspect` (MIT). Liad Yosef's inspection tooling; pair with the
  MCPJam inspector for host-differential testing.
- `sdras-webmcp`, `sdras-webmcp-key-tests` (Apache-2.0). Earliest WebMCP
  interaction demos and key tests: the baseline that later routing work
  improved on.
- `andreban-webmcp-tools` (Apache-2.0). Bandarra's tool-definition bench
  behind the 545-site vagueness-versus-verbosity finding.
- `ucp-over-mcp` (ISC). UCP commerce transport over MCP: the reference for
  our checkout-over-MCP capability design.
- `webml-webmcp` (W3C reports license). Standards-venue WebMCP repo: the
  upstream of the webmcp signal pair in the corpus.
- `authserver-REFONLY-AGPL` (AGPL, tree only). Agent auth server frederic
  barthelet starred: study the OAuth metadata patterns, never copy the code.
