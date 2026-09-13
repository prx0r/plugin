# Define tools (OpenAI — verbatim, saved 2026-09-13)

Source: https://developers.openai.com/plugins/plan/tools.md

Tools are the actions and data that a plugin's MCP server exposes to ChatGPT
and Codex. Define them after you brainstorm use cases and before you implement
the server.

Every tool should help complete a user goal. Do not mirror an internal API
without considering how people will ask for and use the capability.

## Map use cases to tools

For each supported use case:

1. Write the outcome the user expects.
2. List the information required to produce that outcome.
3. Identify the reads, writes, or external actions the server must perform.
4. Group operations that represent one coherent action.
5. Split operations when they have different permissions, safety risks, or
   confirmation requirements.

Separate read and write behavior so the model and user can distinguish
information retrieval from actions that change state.

## Define each contract

Record for every proposed tool: Name, Title, Description, Input schema,
Output schema, Authorization, Side effects, Failure behavior.

Use explicit inputs. Do not depend on the model guessing identifiers, account
scope, or other values required for correctness. Return stable identifiers and
enough structured information for follow-up calls. Keep secrets, access tokens,
internal diagnostics, and unnecessary personal data out of results.

## Write descriptions for selection

The model uses tool descriptions to decide when a tool fits a request. Describe
the user intent, not the implementation. State what the tool does, when to use
it, how it differs from similar tools, and important limits or prerequisites.
Avoid restating the tool name or exposing internal service terminology.

## Plan safety annotations

Per the MCP ToolAnnotations schema:

- `readOnlyHint` true only when the tool cannot change state.
- `destructiveHint` true when the tool can cause irreversible or hard-to-reverse outcomes.
- `openWorldHint` true when the tool touches the public internet or open-ended
  external entities (including read-only web search). A bounded private
  account/workspace is NOT open-world just for being externally hosted.

Annotations do not replace server-side authorization, validation, or confirmation.

## Check coverage and boundaries

Confirm every supported use case has a path to a useful result; cut tools with
no documented use case; check for missing reads before writes; make unsupported
requests produce an understandable limitation, not an unsafe approximation;
check similar tools don't have overlapping descriptions. Keep the tool plan as
an implementation and evaluation checklist.
