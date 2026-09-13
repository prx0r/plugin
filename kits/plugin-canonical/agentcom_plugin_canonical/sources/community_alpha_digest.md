# Community / Staff Alpha Digest

This file intentionally distinguishes facts from anecdotes.

## Highest-confidence alpha

### Tool discovery is an eval problem
OpenAI staff member Casey Chow (2026-06-13) said the few stable best practices were to make the intended tool intent clear, lean on model-written descriptions, and write lots of evals/hill-climb on them. This is the strongest direct signal for how AgentCom should optimize tool metadata.

### Directory discovery is not reliable distribution
In April-May 2026, OpenAI staff described directory placement as fairly manual/experimental, while multiple developers reported low or collapsing usage despite relevant query demand. This is not proof of future discovery behavior; it is a strong reason not to build a business model that assumes automatic traffic.

### Search metadata has changed
As of 2026-04-30, Casey Chow said directory search intentionally focused on app title/subtitle because long-description search was noisy. Treat this as stale-able implementation detail. Use literal useful names, but do not keyword-stuff or manipulate selection.

### Review failures cluster around boring correctness
Common community/review reports include: incorrect/missing tool annotations, OAuth/reviewer-account friction, CSP mistakes, test-case inconsistency, publisher identity mismatch, stale connector metadata, and changing review infrastructure. This supports AgentCom's policy of stable schemas, no-auth reads where possible, minimal UI, and deterministic preflight checks.

## Reddit takeaways (lower confidence)

- Builders commonly conceptualize Apps SDK as MCP tools + optional UI resources, which reinforces tool-first architecture.
- One detailed submission writeup used a large 36-tool app and documented the administrative burden. AgentCom treats this as evidence in favor of smaller model-facing tool sets, but there is no official numeric tool limit.

## Things not to assume

- Do not assume a developer-wide trust/ranking score exists.
- Do not assume usage alone currently determines directory rank.
- Do not assume proactive suggestions are guaranteed.
- Do not assume title/subtitle search behavior will remain unchanged.
- Do not assume review turnaround time.
- Do not assume an MCP published elsewhere can simply be referenced in a submission; current portal expects a remote MCP server submission/snapshot.

## Review-failure corpus added in this kit

The structured file `data/failure_modes.json` converts recurring review problems into diagnosable conditions with severity, authority tier, deterministic checks, and remediation. It includes annotation mismatch, identity mismatch, reviewer OAuth failure, stale tool scans, missing domain verification, inconsistent submitted tests, ambiguous tool descriptions, output-schema drift, unauthorized/pass-through integration risk, CSP/frame risk, excess data collection, commerce mismatch, weak distribution assumptions, and review-cycle drift.

Recent community reports reinforce that the most expensive failures are mundane: missing reviewer credentials, tool-description rejection, repeated test-case inconsistency, OAuth that works in Developer Mode but fails review, and platform requirements changing during long review cycles. These are evidence for defensive preflight engineering, not additional platform policy.
