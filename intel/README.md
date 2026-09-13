# intel/ — structured submission & distribution knowledge

JSON files of hard-won, source-attributed advice about getting AgentCom apps
through OpenAI review and surfaced by ChatGPT. Loosely structured on purpose:
each item carries `confidence` and `status` so we can tighten, confirm, or
retire entries as more evidence arrives.

## Files

- `index.json` — registry: every file, topic, item count, freshness.
- `schema.json` — JSON Schema for intel items (validate additions against it).
- `submission-field-notes.json` — community field reports (2 detailed Reddit
  submission threads + dev-forum issues). Status mostly `anecdotal`.
- `submission-official.json` — OpenAI's stated requirements. `official`.
- `tool-design.json` — hints, descriptions, UI-acceptance bar. Mixed.
- `review-ops.json` — timelines, resubmission, Scan-tool bugs, redirect URIs.

## Item shape

```json
{
  "id": "unique-slug",
  "topic": "submission|tool-design|review-ops|discovery|auth",
  "advice": "one actionable sentence",
  "detail": "optional longer note",
  "source": { "type": "community|official", "url": "...", "date": "YYYY-MM-DD" },
  "confidence": "high|medium|low",
  "status": "verified|anecdotal|official|stale",
  "applies_to": ["domains", "print", "trades"],
  "last_checked": "YYYY-MM-DD"
}
```

## Optimization loop

1. New evidence (thread, rejection, approval, doc change) → append/adjust items,
   never delete history: set `status: stale` with a `superseded_by` note.
2. `anecdotal` + second independent report → `verified`. Official doc change →
   update `official` items and `last_checked`.
3. Before any submission, print the checklist: all `official` + `verified`
   items with `applies_to` matching the app.
