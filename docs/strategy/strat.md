# Strategy — optimize for being chosen, not just being listed (saved 2026-09-13)

Source thread: https://community.openai.com/t/apps-search-only-returning-results-based-on-app-name-or-subtitle/1380113

Yes. The Reddit/forum/X signal is much more useful than the marketing docs, and it changes how I'd attack AgentCom.

Main conclusion:

> **Don't optimize first for "having an app in the store." Optimize for becoming a tool ChatGPT reliably chooses once the app is available.**

OpenAI's own Apps team is basically saying the routing/discovery best practices are still being discovered in real time. Casey Chow from the ChatGPT Apps developer-platform team gave perhaps the highest-alpha advice found: make the tool's intended use crystal clear, let models help write the model-facing descriptions, then build lots of evals and **hill-climb against actual tool-selection performance**. (https://community.openai.com/t/can-app-metadata-and-tool-descriptions-improve-how-chatgpt-discovers-tools-from-installed-apps/1382558)

## What the builders are learning

Treat the ChatGPT UI as essentially **GUI on top of MCP**, not Apps SDK as a separate platform. Resources are UI; tools are actions. Architect around MCP from day one so the core stays portable. (https://www.reddit.com/r/ChatGPT/comments/1pf4bvo/how_to_build_a_chatgpt_app/)

That matters because AgentCom targets ChatGPT → Codex → Muse → Gemini → arbitrary MCP clients, not a giant OpenAI-specific React project. The community complains about UI cache invalidation, widget state, CSP/iframe problems, auth bugs, submission bugs, changing contracts — keep first apps boring and tool-oriented. Domain-checker may need no meaningful UI; Trades needs only a 3-result card; Prints preview genuinely benefits from UI.

## Casey Chow (highest-alpha insider)

On the ChatGPT Apps developer-platform team, unusually active in the forum, says OpenAI is investing heavily in the apps ecosystem. (https://community.openai.com/t/all-apps-have-disappeared-from-dashboard/1378798/20) On discoverability: make intended intent clear; use model-written tool language; write lots of evals; continuously optimize against them. This becomes an AgentCom rule: don't debate tool names — write 1,000 realistic utterances and test which definition gets called. Optimize routing recall extremely high without false positives. SEO except the ranker is an LLM.

## Negative evals matter equally

Submission requires at least five positive and three negative test cases, negatives showing where the app should NOT trigger. (https://www.reddit.com/r/ChatGPT/comments/1pr8y4t/just_submitted_my_mcp_server_to_the_openai_apps/) OpenAI cares about P(tool|relevant) AND P(tool|irrelevant): recall up, precision up. Eval suite needs should-call/shouldn't-call pairs per vertical (boiler repair request vs how-does-a-boiler-work; domain availability vs why-are-.coms-valuable; hoodie order vs what-is-DTG).

## Discoverability reality check

A published developer reported only ~50 users/day despite estimating millions of matching weekly queries — contextual auto-discovery wasn't driving volume. (https://community.openai.com/t/when-do-our-apps-surface-to-users-clarification-requested/1379612/9) Directory search matched app name and subtitle, not full description — Casey confirmed intentional, long-description search was too noisy. (thread above) So: never assume ChatGPT sends millions of calls because the MCP exists. Name apps literally — the query itself: **Domain Checker** ("Check exact domain availability and find available names"), **Custom Print / Pog Prints**, **Find a Tradesperson** — not AgentCom Domains. Parent/developer identity is AgentCom (trusted boring capabilities); each capability earns selection independently until/if developer reputation becomes an explicit signal.

## Don't make 36 tools

The documented submission had 36 tools with manual read/write/open-world/destructive explanations each (~1hr), and wrong annotations trigger rejection. (Reddit 1pr8y4t) Others rejected over description/annotation mismatch. (https://community.openai.com/t/app-review-xpoz-submission-rejected-twice-seeking-guidance-on-tool-descriptions/1386944) Router design consequence: hundreds of adapter operations behind 3–5 model-facing tools (find_local_service, request_quotes, get_quotes, book_service, get_job_status). Fewer overlapping choices probably also improves routing.

## Trigger-like descriptions, model-written

Not "Searches providers using AgentCom's canonical economic market abstraction" but "**Find local plumbers, electricians, heating engineers… Use this when the user needs someone to repair, install, inspect or service something at their home or business.**" Have GPT generate candidate descriptions, then evaluate GPT's own routing across thousands of prompts. Models optimizing interfaces for models.

## agentcom-evals as first-class company asset

Every router ships /evals: positives.jsonl, negatives.jsonl, ambiguous.jsonl, tool_selection.jsonl, parameter_extraction.jsonl, ranking.jsonl. Domains ~5,000 utterances, Trades 10,000+. Every metadata change runs evals; CI reports precision/recall/false-positive/parameter accuracy. Probable early internal moat.

## Auth: defer identity until action requires it

Reviewers failing OAuth is a repeated rejection cause; test accounts must be zero-friction. (https://community.openai.com/t/platform-openai-app-submission-glitch/1382472) Domain Checker V1: no auth. Print quote V1: no auth until ordering. Trades search V1: no auth until contact/booking. Less friction, less review risk, fewer failure states, lower latency.

## Latency budgets

Keep static/cacheable discovery p95 < 1s, fresh lookup p95 < 2s, multi-market quote returns partial fast, human RFQ never blocks a synchronous call (search → immediate results; request_quotes creates RFQ; get_quotes polls). Community best-practice threads stress low latency + clean errors. (https://community.openai.com/t/getting-started-with-chatgpt-apps-sdk-tips-and-best-practices/1367183)

## Submission roughness → decouple cycles

Reviews taking weeks; requirements changing mid-queue causing rejections. (https://community.openai.com/t/openai-needs-a-faster-review-funnel-already-approved-apps/1378915/11, https://community.openai.com/t/submissions-take-so-long-that-requirements-change-which-leads-to-app-rejections/1392493) Never let the review cycle be the dev cycle: MCP/API independently deployable, ChatGPT app one versioned surface, stable canonical schemas so backend changes don't trigger review churn.

## Watchlist (signal, not hype)

- @OpenAIDevs (X) — official platform/codex/agent changes. (https://mobile.x.com/OpenAIDevs/articles)
- Casey Chow / OpenAI Developer Forum — apps platform team, answers implementation/submission/discovery/MCP. (thread [3] above)
- @Hunter (Hunter Hillegas) — shipped ChatGPT/MCP apps (Enzo Reader); practical notes e.g. server instructions as model "user manual". (https://hunterhillegas.com/)
- @composio (X) — tool/API integration layer experience. (https://x.com/composio/with_replies)
- MCPJam ecosystem — rapid MCP/Apps SDK behavior testing; native debugging was painful. (https://www.reddit.com/r/mcp/comments/1o1ojqf)
- X official MCP server (200+ endpoints) + llms.txt/skill.md/OpenAPI for agents — validates machine-callable worldview. (https://docs.x.com/tools/mcp)

## Strategic danger / moat rule

Developers build tools that make ChatGPT itself more capable — OpenAI can absorb pure orchestration. (https://www.reddit.com/r/OpenAI/comments/1ppckx8/openai_just_opened_the_gates_for_developers/) Moat rule: **own external reality, not model orchestration** — registrar availability+prices, supplier catalogue+quality+routing, provider graph+quotes+availability+history. ChatGPT handles words; we handle markets.

## Next 30 days

AgentCom Core tiny canonical routing abstraction → ship Domain Checker as sacrificial learning app → instrument everything permitted (tool called, success, latency, params, errors, query types, eval performance, search→action conversion) → build Trades on same primitives → automate the loop: real usage failures → new eval cases → candidate metadata → routing benchmark → best version. The game isn't getting into ChatGPT; it's becoming the function ChatGPT learns it can reliably delegate a reality-check/action to.
