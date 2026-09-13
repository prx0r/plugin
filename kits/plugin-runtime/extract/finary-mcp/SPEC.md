# Finary MCP

A personal MCP server over Finary's **cashflow** feature. Finary has no official
API — this talks to the same private API the web app (`app.finary.com`) uses.

## Value proposition

From an AI assistant, over your own Finary account:
- Browse transactions for a date range (visual list).
- List categories (with IDs).
- (Re)categorize a transaction.

Single user (the account whose cookie is configured). Not multi-tenant.

## Authentication

**To Finary (Clerk):** Finary auth is handled by Clerk. A long-lived, httpOnly
`__client` cookie mints short-lived (~60s) session JWTs; those JWTs authorize
`api.finary.com` calls. The server:
1. Reads the `__client` cookie from `FINARY_CLERK_CLIENT` (see `.env.example`).
2. `GET clerk.finary.com/v1/client` → active session id.
3. `POST clerk.finary.com/v1/client/sessions/{sid}/tokens` → a JWT (cached until ~5s before its `exp`).
4. Absorbs any rotated `__client` from `Set-Cookie` so a long-running process stays authed.

The `__client` cookie is the only Finary secret. It lasts months; re-copy it if calls start 401ing.

**To this MCP server:** optional HTTP Basic Auth on `/mcp`, enabled by setting
`MCP_BASIC_AUTH=user:pass`. Off by default (fine for local dev / a private tunnel).
Turn it on before exposing the server publicly. Full OAuth is overkill for a
single-user personal server.

## UX Flows

List transactions:
1. Ask for transactions over a date range → visual list with amounts, dates, categories, totals.

Update a transaction (conversational):
1. (Optionally) list categories to find the target category id.
2. Update a transaction by id — categorize, rename, and/or tick it.

## Tools and Views

**View: list-transactions** — `readOnly`
- Input: `{ ownerId?, startDate?, endDate?, page?, perPage?, marked? }` (dates `YYYY-MM-DD`; default current month; `page` default 1, `perPage` default 100). Without `ownerId` the org-level endpoint returns the whole family merged server-side (Finary's "Family & Enterprise" view — exact pages, no duplicate ids); with `ownerId` (from list-owners) only that member's accounts. `marked` filters server-side: `false` = only unticked (à pointer), `true` = only ticked, omit = all.
- Output: `{ transactions[], count, markedCount, totalIncome, totalExpenses, page, perPage, hasMore, nextPage }`
- Pagination: Finary returns no page metadata, so `hasMore` is inferred (`count === perPage`) and `nextPage` tells the caller which page to fetch next. Totals are **per page**, not the whole range.
- Joint accounts appear under every membership sharing them (same transaction ids), so listing two
  members separately can return the same joint transaction twice — dedup by id when aggregating
  across owners. The merged (no-`ownerId`) view has no duplicates.
- Each transaction: `{ id, date, name, value, currency, marked, includeInAnalysis, categoryId, category, account, owner, ownerId }`.
  `owner`/`ownerId` = the membership the transaction was fetched from; `null` in the merged view.

**Tool: list-owners** — `readOnly`
- Input: `{}`
- Output: `{ owners[] }` — org memberships, authenticated user first, each `{ id, owner }` (`owner` = display name, null with env override).
  `marked` = the "Pointer la transaction" toggle (French *pointer*: ticked/reconciled).
  `includeInAnalysis` = the "Ajouter à l'analyse budgétaire" toggle (counted in budget analysis).
- View: inline list (top 8) with income/expense totals and a per-row ticked/not-ticked dot; expands
  to fullscreen for the full list. Fullscreen has a "Charger plus" button that fetches the next page
  through the tool and appends (totals recomputed over everything loaded).

**Tool: list-categories** — `readOnly`
- Input: `{}`
- Output: `{ categories[] }` — flattened main + subcategories, each `{ id, name, isSubcategory, isCustom, parentId, parentName }`.

**Tool: delete-categories** — writes, destructive, batch
- Input: `{ categoryIds: number[] }` (1–100, from list-categories)
- Behavior: only `isCustom` categories are deleted; built-in or unknown ids are refused per-item
  without touching the API. Runs in batches of 10; per-item failures are isolated. Irreversible.
- Output: `{ results[], okCount, failCount }` — each result `{ categoryId, ok, error }`.

**Tool: update-transactions** — writes, reversible, batch
- Input: `{ updates: Array<{ transactionId, categoryId?, name?, marked?, includeInAnalysis? }> }` (1–200; each item needs ≥1 mutable field)
- Behavior: `name` renames (maps to `display_name`); categorizing defaults `marked` to true unless overridden. Runs in batches of 10 concurrent requests; per-item failures are isolated.
- Output: `{ results[], okCount, failCount }` — each result `{ transactionId, ok, name, category, categoryId, marked, includeInAnalysis, error }`.

## Finary private API reference

Base: `https://api.finary.com`. Headers on every call:
`Authorization: Bearer <jwt>`, `x-client-api-version: 2`, `x-finary-client-id: webapp`.
Two scopes (org id auto-derived from `GET /users/me/organizations`):
- Org-level `{org} = /organizations/{orgId}` — all family members merged server-side; what the
  web app's "Family & Enterprise" view uses.
- Membership-scoped `{member} = {org}/memberships/{membershipId}` — one member only.

- `GET  {org}/transactions?start_date=&end_date=&per_page=&page=` → `{ result: Transaction[] }` (also on `{member}`)
- `GET  {org}/transaction_categories?included_in_analysis=true` → `{ result: Category[] }` (nested subcategories)
- `POST {org}/transaction_categories` body `{ "name", "main_category_id"?, "color"?, "icon"? }` → 201 `{ result: Category }` (custom category)
- `DELETE {org}/transaction_categories/{id}` → 200 (custom categories only)
- `PUT {org}/transactions/{id}` body `{ "custom_subcategory_id"?, "display_name"?, "marked"?, "include_in_analysis"? }` → `{ result: Transaction }`
  - `custom_subcategory_id` assigns the category — accepts a **main-category or subcategory** id (35 = "unknown"/uncategorized). This is the field the web app uses.
  - `display_name` renames; `marked` ticks; `include_in_analysis` toggles budget-analysis inclusion. One PUT can carry all of them.
  - ⚠️ `PATCH` and `category_id` are silently ignored for category — must be `PUT` + `custom_subcategory_id`.
  - The org-level PUT reaches any member's transaction; the membership-scoped PUT 404s on other
    members' transactions — always update org-level.

A transaction's assigned category is `subcategory` (falls back to `category`).
`category_id` accepts either a main-category or subcategory id. The `marked`
boolean is the "Pointer la transaction" toggle (ticked/reconciled).

## Environment

See `.env.example`. `FINARY_CLERK_CLIENT` (required), `MCP_BASIC_AUTH` (optional),
`FINARY_ORG_ID` / `FINARY_MEMBERSHIP_ID` (optional overrides).

## Run

- Local: `npm run dev` → server at `http://localhost:3000/mcp`, DevTools at `http://localhost:3000`.
- Connect a client: `npm run dev:tunnel` (Alpic tunnel), add the `{url}/mcp` as a custom connector.
- Deploy: `npm run deploy` (Alpic). Set env vars in the Alpic project — do NOT ship `.env`.
