# AgentCom Submission-Day Checklist

This is the final human + agent gate. **Any hard-gate failure = NO GO**, regardless of rubric score. Re-run against current OpenAI docs on submission day.

## 1. Product fit
- [ ] The plugin fills a clear conversational intent that benefits from external truth/action.
- [ ] It adds standalone utility rather than reproducing a built-in/common conversational response.
- [ ] The model-facing surface is user-goal-shaped, not a mirror of provider APIs.
- [ ] Similar tools are meaningfully distinguishable.

## 2. Third-party legitimacy
- [ ] Every provider has an entry conforming to `schemas/provider_ledger.schema.json`.
- [ ] Authorization / official API / partnership is documented.
- [ ] Provider terms were reviewed for the exact use.
- [ ] No scraping or prohibited automation.
- [ ] The plugin is not primarily an unofficial pass-through connector.
- [ ] AgentCom adds independent normalization/ranking/workflow value.

## 3. Tool contract
- [ ] Every tool name is literal, action-oriented, non-promotional.
- [ ] Every description says **what**, **when to use**, important **limits/prerequisites**, and distinction where needed.
- [ ] Inputs are the minimum needed; no full transcripts or speculative context.
- [ ] No raw precise location fields when platform side-channel/context should be used.
- [ ] Stable IDs and structured fields support follow-up calls.
- [ ] `outputSchema` exactly validates every `structuredContent` result.
- [ ] Internal debug/provider secrets are absent from model-visible outputs.

## 4. Annotations / safety
- [ ] `readOnlyHint` explicit true/false on every tool.
- [ ] `openWorldHint` explicit true/false on every tool.
- [ ] `destructiveHint` explicit true/false on every tool.
- [ ] Each has a behavior-grounded written justification.
- [ ] Write operations are separated from reads.
- [ ] Side effects are explicit and retries are safe/idempotent where possible.
- [ ] User confirmation occurs before consequential external actions.

## 5. Auth / privacy
- [ ] Reviewer credentials work in a fresh incognito session.
- [ ] No MFA, SMS, email confirmation, invitation, VPN or manual provisioning is required for review.
- [ ] Privacy policy covers categories, purposes, recipients, retention, and controls.
- [ ] Data collection/retention is minimized.
- [ ] No prohibited restricted data or secrets are requested.

## 6. MCP / UI
- [ ] Production MCP is public HTTPS and stable.
- [ ] Domain challenge verified.
- [ ] MCP tool scan is current after final deploy.
- [ ] CSP domains are exact; no wildcards.
- [ ] `frameDomains` is empty unless essential and explicitly justified.
- [ ] UI exists only where it improves the task; tool works without unnecessary mini-site complexity.
- [ ] Web + mobile flows tested when relevant.

## 7. Routing evals
- [ ] Exactly 5 submission positive cases all pass repeatedly.
- [ ] Exactly 3 submission negative cases all avoid unintended invocation.
- [ ] Larger internal routing corpus measures precision/recall beyond the eight submitted cases.
- [ ] Ambiguous prompts are included.
- [ ] Parameter extraction and output invariants are tested.
- [ ] Tool-selection changes are hill-climbed against evals, not intuition.

## 8. Listing / submission package
- [ ] Display name <=30 chars.
- [ ] Subtitle <=30 chars and literal enough for discovery.
- [ ] Long description <=4000 chars.
- [ ] <=20 capabilities, each <=120 chars.
- [ ] <=3 starter prompts, each <=128 chars, no @mentions.
- [ ] Demo recording URL is live.
- [ ] Release notes included.
- [ ] Website/support/privacy/terms are live HTTPS pages and publisher identity is consistent.
- [ ] Custom UI screenshots comply with current dimensions/rules; no screenshots if no custom UI.

## 9. Operational reliability
- [ ] p95 latency budget is explicit.
- [ ] Timeouts produce clean model-readable errors.
- [ ] Provider failures degrade gracefully.
- [ ] Logs contain no credentials/restricted data.
- [ ] Core MCP/API can ship independently of directory review.

## 10. Final commands
```bash
python checks/plugin_lint.py templates/plugin_spec.clean_example.json
python checks/source_scan.py /path/to/project
python checks/run_all.py /path/to/plugin_spec.json /path/to/project
```

Expected final state: `GO` with zero hard errors. Warnings need written waivers.
