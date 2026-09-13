# Optimization layer — portability, routing, discovery, conformance (saved 2026-09-13)

Better layer than "people tweeting about Apps SDK": people hitting portability,
routing, discovery, rendering and conformance failures across hosts.

## Key people

- **@andreban (André Bandarra)**: analyzed 545 websites implementing Chrome
  WebMCP; two recurring tool-definition failures: vagueness/under-specification
  and verbosity/context bloat. Maps directly to ChatGPT app-routing: specific
  enough to select, compact enough not to poison context. Amplified by Sarah
  Drasner. (TwStalker sarah_edo)
- **@domfarolino (Domenic Farolino)**: web-platform/WebMCP/MCP Apps performance.
  Proposal: MCP Apps buffer whole HTML inside JSON, delaying first paint,
  blocking streaming/parallel fetch. (ext-apps#603)
- **@sarah_edo (Sarah Drasner)**: Chrome AI/web ecosystem lead; central
  WebMCP/agent-native-website node; amplifies empirical work.
- **@Paul_Kinlan**: discovery/model-visible web presence; testing whether URLs
  in prompts change outputs from URL content — adjacent to AgentCom discovery.
- **hydrosquall**: months of Datadog MCP Apps across ChatGPT/Claude/Cursor/
  VSCode/CLI; issue history = cross-host failure catalog. (ext-apps#666)
- **liady (Liad Yosef)**: MCP Apps contributor/spec author; pushing official
  MCP App validator — "no canonical way to check conformance". (ext-apps#673)
- **fredericbarthelet**: OpenAI Apps SDK ↔ MCP Apps difference matrix +
  host-specific metadata factories. (ext-apps#201)
- **qchuchu**: shipped MCP app specs (finary-mcp SPEC.md), Skybridge edge cases.
- **yannj-fr (Yann Jouanin)**: MCP App discovery, portable origins, JSON-LD
  discovery. (ext-apps#606, https://github.com/yannj-fr)

## 1. Description density sweet spot (biggest hidden lever)

545-site dataset: too vague → model can't choose; too verbose → context bloat,
weak signal-to-noise. Validator must test the sweet spot, not just schema:

Tool description quality = intent specificity + differentiating constraints +
argument semantics − redundant prose − marketing language − sibling overlap.

Eval with domain queries ("find me a .com for an AI accounting startup",
"is agentcom.org registered", "ten available names under 12 chars") asking:
right tool? wrong sibling? did +30% description help or hurt? Empirical
optimizer. (TwStalker sarah_edo)

## 2. Upstream commoditizes conformance — differentiate above it

Liad's validator proposal admits no canonical conformance; first-party
validator beside the spec keeps changes synchronized. (ext-apps#673) So don't
compete on "an MCP spec validator". Differentiate:

official conformance + ChatGPT compat + tool-selection evals +
submission/review checks + discovery optimization + conversion/UX telemetry.

## 3. Portability worse than marketing

Hydrosquall: breaks across ChatGPT/Claude/local; vendor field for one host
breaks another; ui.domain formatted incompatibly; app-only tools inconsistent;
responsive width/insets differ. (ext-apps#666) Rule: never emit one universal
metadata object — capability → host detector → metadata adapter (ChatGPT,
Claude, Cursor, VSCode, generic). Skybridge already does versions of this.

## 4. ui.domain is branding/discovery, not just sandboxing

On ChatGPT, ui.domain=https://manufact.com can make the app-name click lead
to that website — a homepage/branding anchor. (ext-apps#557) Lint metadata for
correctness AND commercial consequences.

## 5. Discovery is unsolved protocol space

Yann Jouanin: MCP Apps invisible to ordinary web discovery → JSON-LD proposal
(MCPApp, endpoint, platform links) in site metadata. (ext-apps#606) Ship per
capability: website, robots-friendly page, JSON-LD, MCP endpoint, llms.txt,
OpenAPI where applicable, both listings, canonical capability ID. Cheap even
if never standardized.

## 6. ChatGPT-only primitives persist

Widget state, file selection/upload, modals, close behavior, open-in-app URLs,
some redirect domains — no clean MCP equivalents. (migrate_from_openai_apps.md)
Architecture: PORTABLE CORE + OPTIONAL HOST CAPABILITIES, not lowest common
denominator.

## 7. Round-trip commerce via redirect_domains

Approved redirect domains skip the safe-link interstitial; ChatGPT appends
redirectUrl; the service returns the user into the original conversation.
(ext-apps#678) Flow: product search → merchant checkout → payment → redirectUrl
→ same workflow. First-class AgentCom capability, far beyond outbound links.

## 8. App-only helper leakage

No consistently enforced app-only tool visibility; UI helpers
(paginate_internal, resize_panel, fetch_thumbnail…) pollute model context and
routing. (ext-apps#732) Enforce: model tools = semantic business ops; UI
helpers hidden/private where allowed; flag leakage.

## 9. Retry UI spam

Bad call → retry → each response embeds another iframe; answer pushed down
conversation. (ext-apps#731) MODEL RETRY TEST: wrong args → widget? → retry →
usable conversation? Good apps may skip heavyweight widgets on
intermediate/error results.

## 10. Loading performance as differentiator

Whole-HTML-in-JSON blocks streaming (Farolino, ext-apps#603). Optimize: tiny
shell, critical CSS, deferred JS, minimal bundle, lazy noncritical, no giant
inline payloads. Time-to-interactive may drive retention among similar apps.

## 11. Published-only CSP trap

Works locally/dev/unpublished, fails published: expected CSP metadata must sit
in OpenAI's special resource _meta location. (MCPJam inspector#1322) Belongs
in preflight.

## 12. Mini-application trajectory

Roadmap: UI→server calls, conversation messages, model-context updates,
display modes, embedded tools, mobile SDKs, dynamic content,
camera/mic/geo/clipboard permissions. (ext-apps#140) Validates software-
surfaces-inside-the-model thesis.

## S-tier watchlist additions

andreban, domfarolino, sarah_edo, Paul_Kinlan, hydrosquall, liady,
fredericbarthelet, qchuchu, yannj-fr. Maintain: gching, mcpjams, alpic_ai,
QChuret, 0xkoller, Roee Tsur.

## Compiler vision + data to collect now

CAPABILITY → semantic tool design → routing evals → description optimization →
host-specific compilation → protocol validation → UI/device/theme tests →
security/CSP → discovery metadata → submission checks → production telemetry →
invocation data → automatic iteration. Collect from day one: prompt →
tool-selected; definition variant → selection rate; host/version →
compatibility outcome. Proprietary loop upstream won't give us.
