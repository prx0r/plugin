// Studio creator: generate submission artifacts from capability definitions.
// Generalizes the hand-built Domain Availability packet so new verticals
// (print, trades, pog) get correct-by-construction specs. Source truth flows
// capability → plugin_spec.json → chatgpt-app-submission.json, never reverse.
import type { EvalTool } from "@agentcom/evals";

export interface SpecInput {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface SpecTool extends EvalTool {
  inputs: SpecInput[];
  outputs: string[];
  behavior: {
    mutates_state: boolean;
    accesses_public_or_open_ended_external_entities: boolean;
    irreversible_or_hard_to_reverse: boolean;
    sends_data_to_third_party: boolean;
  };
  justifications: {
    readOnlyHint: string;
    openWorldHint: string;
    destructiveHint: string;
  };
}

export interface PacketCase {
  prompt: string;
  expectedTool: string;
  expectedOutput?: string;
}

export interface PacketNegative {
  prompt: string;
  expectedBehavior?: string;
}

export interface CapabilityInput {
  name: string;
  subtitle: string;
  description: string;
  category: string;
  commerce: "none" | "physical_goods" | "digital_goods_or_services";
  mcpUrl: string;
  releaseNotes: string;
  demoUrl?: string;
  starterPrompts?: string[];
  capabilities?: string[];
  tools: SpecTool[];
  positives: PacketCase[];
  negatives: PacketNegative[];
}

const TODO_OUTPUT = "[TODO: describe the expected result for reviewers]";

function toSpecTool(t: SpecTool): Record<string, unknown> {
  if (!t.hints) throw new Error(`creator: tool ${t.name} needs explicit hints before packet generation`);
  return {
    name: t.name,
    description: t.description,
    inputs: t.inputs,
    outputs: t.outputs,
    returns_structured_content: true,
    has_output_schema: true,
    annotations: { ...t.hints },
    behavior: { ...t.behavior },
    annotation_justifications: { ...t.justifications },
  };
}

/** Kit-shaped plugin_spec.json. Deployment-gated flags stay false by default. */
export function buildPluginSpec(cap: CapabilityInput): Record<string, unknown> {
  return {
    app: {
      name: cap.name,
      subtitle: cap.subtitle,
      description: cap.description,
      category: cap.category,
      commerce: cap.commerce,
      has_ui: false,
      serves_ads: false,
      capabilities: cap.capabilities ?? [],
      starter_prompts: cap.starterPrompts ?? [],
      demo_recording_url: cap.demoUrl ?? "https://example.com/review-demo",
      release_notes: cap.releaseNotes,
    },
    publisher: {
      verified_identity: false,
      identity_name_matches_public_urls: false,
      website_url: "https://agentcom.org",
      support_url: "https://agentcom.org/support",
      privacy_url: "https://agentcom.org/privacy",
      terms_url: "https://agentcom.org/terms",
    },
    mcp: {
      url: cap.mcpUrl,
      public_production: false,
      url_type: "Universal",
      auth_required: false,
      review_account_no_mfa: true,
      domain_verified: false,
      scan_current: false,
    },
    privacy: {
      policy_covers_categories: false,
      policy_covers_purposes: false,
      policy_covers_recipients: false,
      policy_covers_retention: false,
      policy_covers_controls: false,
    },
    ui: {
      connect_domains: [],
      resource_domains: [],
      frame_domains: [],
      redirect_domains: [],
      widget_uri_versioned: true,
    },
    tools: cap.tools.map(toSpecTool),
    tests: {
      positive: cap.positives.map((p) => ({ prompt: p.prompt, expected_tools: [p.expectedTool] })),
      negative: cap.negatives.map((n) => ({ prompt: n.prompt, expected_tools: [] })),
    },
    third_party_integrations: [],
  };
}

/** Review-facing chatgpt-app-submission.json draft. */
export function buildSubmissionPacket(cap: CapabilityInput): Record<string, unknown> {
  const tools: Record<string, unknown> = {};
  for (const t of cap.tools) {
    if (!t.hints) throw new Error(`creator: tool ${t.name} needs explicit hints before packet generation`);
    tools[t.name] = {
      annotations: { ...t.hints },
      justifications: {
        read_only_justification: t.justifications.readOnlyHint,
        open_world_justification: t.justifications.openWorldHint,
        destructive_justification: t.justifications.destructiveHint,
      },
    };
  }
  return {
    $schema: "https://developers.openai.com/apps-sdk/schemas/chatgpt-app-submission.v1.json",
    schema_version: 1,
    app_info: {
      display_name: cap.name,
      subtitle: cap.subtitle,
      description: cap.description,
      category: cap.category,
    },
    tools,
    positive_test_cases: cap.positives.map((p) => ({
      prompt: p.prompt,
      tools_triggered: [p.expectedTool],
      expected_output: p.expectedOutput ?? TODO_OUTPUT,
    })),
    negative_test_cases: cap.negatives.map((n) => ({
      prompt: n.prompt,
      expected_behavior: n.expectedBehavior ?? "Do not trigger the plugin.",
    })),
  };
}
