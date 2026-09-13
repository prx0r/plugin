# SOURCES — provenance and license table

All material under `extract/` was cloned September 2026 and is attributed to its
authors. MIT/Apache-2.0/ISC sources may be reused with their license notices
preserved. Entries marked REFONLY have no license file (all rights reserved):
study them, do not copy code from them.

| Extract dir | Upstream repo | License | Use |
|---|---|---|---|
| `speccheck-src`, `speccheck-docs`, `speccheck-ref-servers` | Roee-Tsur/mcp-spec-check | MIT | copy with notice |
| `mcp-signal-src`, `mcp-signal-docs`, `mcp-signal-example`, `mcp-signal-test` | Roee-Tsur/mcp-signal | MIT | copy with notice |
| `appconformance-server`, `appconformance-view`, `appconformance-shared`, `appconformance-runner`, `appconformance-catalogue.json` | alpic-ai/mcp-app-conformance | MIT | copy with notice |
| `chatgpthost-src` | alpic-ai/chatgpt-host-conformance | MIT (pkg) | copy with notice |
| `mcipeval-src`, `mcipeval-test`, `mcipeval-workflows`, `mcipeval-README.md` | alpic-ai/mcp-eval | MIT (pkg) | copy with notice |
| `skytemplate-src`, `skytemplate-evals`, `skytemplate-AGENTS.md` | alpic-ai/apps-sdk-template (Skybridge v2) | unknown (no license field) | reference; reimplement, attribute |
| `appseverything-tools`, `appseverything-lib`, `appseverything-README.md` | MCPJam/apps-sdk-everything | unknown | reference; reimplement, attribute |
| `advent-chatgpt-app` | fredericbarthelet/advent-chatgpt-app | unknown | reference; reimplement, attribute |
| `double-iframes` | fredericbarthelet/mcp-apps-double-iframes | unknown | reference; reimplement, attribute |
| `finary-mcp` | qchuchu/finary-mcp | MIT | copy with notice |
| `pokemon-mcp-testing` | mcpjam/pokemon-mcp-and-testing | unknown | reference; reimplement, attribute |
| `openai-apps-sdk-examples` | yannj-fr/openai-apps-sdk-examples | ISC | copy with notice |
| `mcp-ext-apps-docs` | yannj-fr/mcp-ext-apps (SEP-1865 spec+SDK) | Apache-2.0 transition | copy with notice |
| `xkcd-app-REFONLY-NOLICENSE` | mcp-use/xkcd-chatgpt-app | NONE | read only, do not copy |
| `widget-samples-REFONLY-NOLICENSE` | hydrosquall/widget-samples (tree + README only) | NONE | read only, do not copy |
| `stateless-src`, `stateless-tests`, `stateless-docs` | andreban/stateless-mcp | Apache-2.0 | copy with notice |
| `webmcp-checkout-src`, `webmcp-checkout-README.md` | andreban/webmcp-checkout | unknown | reference; reimplement, attribute |
| `awesome-chatgpt-apps` | mcp-use/awesome-chatgpt-apps | Apache-2.0 | copy with notice |
| `ext-apps-docs` | modelcontextprotocol/ext-apps (upstream spec docs) | Apache-2.0 transition | copy with notice |
| `webmcp-lib` | PaulKinlan/webmcp-lib | (see repo) verify before reuse | reference until verified |
| `mcp-to-llm` | PaulKinlan/mcp-to-llm | MIT (has LICENSE) | copy with notice |
| `a2ui-specification`, `a2ui-docs` | liady/a2ui (A2UI agent-to-UI protocol) | Apache-2.0 | copy with notice |
| `mcpgarden-inspect` | liady/mcpgarden-inspect | MIT | copy with notice |
| `skill-eval-harness` | adewale/skill-eval-harness | MIT | copy with notice |
| `mattpocock-skills` (skills + docs only) | mattpocock/skills | MIT | copy with notice |
| `sdras-webmcp`, `sdras-webmcp-key-tests` | sdras/webmcp, sdras/webmcp-key-tests | Apache-2.0 | copy with notice |
| `andreban-webmcp-tools` | andreban/webmcp-tools | Apache-2.0 | copy with notice |
| `ucp-over-mcp` | fredericbarthelet/ucp-over-mcp | ISC | copy with notice |
| `webml-webmcp` | webmachinelearning/webmcp | W3C community reports license | reference, do not relicense |
| `authserver-REFONLY-AGPL` (tree + README only) | authplane/authserver | AGPL (strong copyleft) | read only, never copy |

Rule from the GitGoblin reuse workflow applies to everything above:
license first, then architecture, then benchmarks, then dependency graph,
then primitive, then product hypothesis. Unknown-license code is never pasted
into the runtime; it is reimplemented from the documented behavior.
