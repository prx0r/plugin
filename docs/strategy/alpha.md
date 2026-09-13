# Alpha — MCP app framework cluster (saved 2026-09-13)

Stop searching "OpenAI Apps SDK"; follow the people building MCP app frameworks,
inspectors, telemetry, submission tooling and compatibility layers.

## Highest-signal cluster

| Person/account | Why they matter | GitHub |
|---|---|---|
| @gching — Gavin Ching | Best empirical experimenter. ~10 tiny ChatGPT apps built to discover platform limits. | No verified personal GitHub; do not fabricate. |
| @mcpjams — MCPJam | Operationally most important: evaluates whether models actually choose tools correctly, plus OAuth/widget/App debugging. | https://github.com/MCPJam |
| @RoeeTsur / Roee Tsur | Instrumentation + deterministic spec-checking instead of another framework. | https://github.com/Roee-Tsur |
| @alpic_ai | Infra around shipping MCP/ChatGPT Apps; sees many real implementations. | https://github.com/alpic-ai |
| @QChuret — Quentin Churet | Alpic/Skybridge builder; deployment + portability lessons. | https://github.com/alpic-ai/skybridge |
| @0xkoller — José Luis Koller | xmcp DX; practical submission/deployment guides. | https://github.com/basementstudio/xmcp |
| xmcp team / @xmcp | Framework-level view of repeated ChatGPT-app developer pain. | https://github.com/basementstudio/xmcp |
| MCP Apps/ext-apps contributors | Upstream: defining the portable interactive-app primitive. | https://github.com/modelcontextprotocol/ext-apps |
| mcp-use team | Framework comparison point; benchmarks competing approaches. | https://github.com/mcp-use/mcp-use |
| hunter_h | Best forum account for submission/review/discovery failures. | No verified GitHub yet. |

## 1. Gavin Ching — the gold mine

"Speedrunning for 10 days with a bunch of small ChatGPT Apps to experiment + see whats possible." Findings: write tool calls not supported on mobile apps; mobile PIP can disappear on a subsequent tool call that renders no widget; all widgets + resources loaded at connection time (forced waiting for render data; wants rendering directly from tool-call responses). CSP issue: SDK coercing wss:// into HTTPS. Stack: Cloudflare + React Server Components + RedwoodSDK + optionally MCP-UI; RSC "a huge win for DX". X series: PDF preview, shopping, interactive cat, YouTube analysis, browser automation, whiteboard, chess, mood music, JS sandbox. (https://community.openai.com/t/lessons-learnt-from-speedrunning-chatgpt-apps/1366805) Methodology rule for us: don't build one giant app to learn the platform — build tiny pathological apps each probing one boundary.

## 2. Roee Tsur — the validator

mcp-signal: normal web analytics break in sandboxed widgets; routes events through a model-invisible MCP tool call so telemetry escapes widget CSP with credentials server-side. Answers: does it load? which controls get used? where do people drop off? what errors happen in the sandboxed iframe? (https://github.com/Roee-Tsur/mcp-signal) mcp-spec-check: scanned 7,850 registry MCP servers with black-box deterministic pass/fail probes; ~one of reachable set passed all three new-spec requirements. Philosophy: "probe correctness is the whole game"; validates against known-good references + independent conformance suite. (https://github.com/Roee-Tsur/mcp-spec-check) Adoption for our submission gate: probe → expected observable behaviour → known-good fixture → known-bad fixture → deterministic result. S-tier follow. (https://github.com/Roee-Tsur)

## 3. MCPJam — tool-selection/evals rabbit hole

Pitch: "test, debug, and evaluate MCP servers, MCP apps, and ChatGPT apps." (https://docs.mcpjam.com/) Evals layer: test cases with expected tool calls, run across LLMs, metrics + CI gating PRs. Answers "will ChatGPT actually invoke our tool for this query?" Three distinct tests: protocol correctness → tool-selection correctness → task completion correctness; MCPJam owns #2. Repos: https://github.com/MCPJam, https://github.com/MCPJam/inspector, reference impl https://github.com/MCPJam/apps-sdk-everything (tools, widgets, bidi comms, persistent state, external integrations). X: https://x.com/mcpjams

## 4. Alpic / Skybridge — production-abstraction cluster

Thesis: developers shouldn't write separately against proprietary ChatGPT widget APIs and MCP Apps; detect OpenAI Apps SDK/window.openai vs standard MCP Apps/ext-apps and wrap both. (https://github.com/alpic-ai/skybridge/blob/main/AGENTS.md) Relevant layering: AgentCom Capability → plain MCP → MCP App UI → ChatGPT compat → website → x402/API. Mine for what abstractions survive across clients; every ChatGPT special-case is signal. Core: https://github.com/alpic-ai/skybridge (~2k stars; local emulation, HMR, tunneling, deployment, runtime abstraction). X: https://x.com/alpic_ai, https://x.com/QChuret

## 5. Koller / xmcp — submission alpha

Guide details: test icons in dark mode (many go invisible); older Apps SDK syntax already aged — use current MCP Apps _meta.ui format. (https://xmcp.dev/blog/build-and-submit-gpt-apps) Rule for our checker: never encode docs as timeless truth; every rule carries introduced/last_verified/source/host/spec_version/confidence. X: https://x.com/0xkoller. Framework: https://github.com/basementstudio/xmcp

## 6. modelcontextprotocol/ext-apps — most important upstream

Convergence: OpenAI-specific widgets → MCP tool + ui:// resource + sandbox iframe + bidirectional host bridge. Lifecycle: tool declares UI resource → model invokes → host fetches → host displays iframe → bidi comms. (https://github.com/modelcontextprotocol/ext-apps) Watch contributors/issues, not just the MCP account — tomorrow's platform appears there first. Ships agent skills: create-mcp-app, migrate-oai-app, add-app-to-server, convert-web-app; migrate-oai-app is near-official convergence acknowledgment.

## 7. hunter_h — review reality

Rejected, assumed reviewer wrong, telemetry showed the reviewer really hit a problem; fixed, resubmitted. (https://community.openai.com/t/chatgpt-apps-reject-with-same-feedback/1376488/2) Lesson: reviewer telemetry mandatory — instrument review sessions (connect, list, select, args, execute, render, error, theme, client, latency, result). Also probing MCP Apps spec vs ChatGPT implementation gaps. (https://community.openai.com/t/tracking-chatgpt-mcp-app-compatibility/1380311)

## 8. Concrete review failure modes (Tushar Dhar)

Three issues → approved: one test case displayed no data; UI needed dark/light support; dev links removed from WIDGET_CSP. (https://community.openai.com/t/chatgpt-apps-reject-with-same-feedback/1376488) All three are deterministically checkable pre-submission.

## Six quality layers (+ observability)

1. PROTOCOL — valid MCP? 2. HOST COMPAT — does ChatGPT support what we use? 3. MODEL ROUTING — correct tool selected? 4. EXECUTION — expected result? 5. UI — renders across host/theme/device? 6. MARKETPLACE/DISCOVERY — findable + understandable? 7. OBSERVABILITY — can we diagnose every failure above? Division: Roee Tsur → 1+7; MCPJam → 3+4; Gavin Ching → 2-boundaries; Skybridge → 2-compat; xmcp → submission ergonomics; hunter_h → review reality; ext-apps contributors → future spec.

## X list + repos

@gching, @mcpjams, @alpic_ai, @QChuret, @0xkoller, @OpenAIDevs, MCP/Apps contributors, Roee Tsur (GitHub activity > X). Repos: MCPJam/inspector, MCPJam/apps-sdk-everything, Roee-Tsur/mcp-signal, Roee-Tsur/mcp-spec-check, alpic-ai/skybridge, modelcontextprotocol/ext-apps, mcp-use/mcp-use, basementstudio/xmcp. Next: resolve top contributors/issues/PR authors across ext-apps, MCPJam, Skybridge, xmcp, mcp-use to X; score by frequency of new empirical findings over tutorials — expect 20–50 more high-signal people.
