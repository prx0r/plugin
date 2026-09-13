// Selectors: interchangeable routing functions. The keyword proxy is
// deliberately dumb — it proves the harness and captures the real SEO dynamic
// (user language outscores jargon). Swap in an LLM judge or MCPJam suites
// without changing case format.
import type { EvalTool } from "./cases.ts";

export type ToolSelector = (utterance: string, tools: EvalTool[]) => string | null;

/** Score = total matched trigger length. Deterministic. Null when nothing hits. */
export function keywordSelector(utterance: string, tools: EvalTool[]): string | null {  const u = utterance.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const t of tools) {
    let s = 0;
    for (const trig of t.triggers) {
      const k = trig.toLowerCase();
      if (k && u.includes(k)) s += k.length;
    }
    if (s > bestScore) {
      bestScore = s;
      best = t.name;
    }
  }
  return best;
}

const STOP = new Set("a,an,the,to,for,and,or,of,when,use,user,users,this,it,is,with,me,my,by,on,at,as,be,are,do,does,did,what,why,how,which,give,find,check,whether".split(","));

function tokens(s: string): Set<string> {
  return new Set(
    (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/**
 * Lexical-similarity proxy: utterance tokens vs tool name + description +
 * triggers. Description wording genuinely moves scores (unlike the keyword
 * proxy), so metadata experiments resolve. Still deterministic; the model
 * judge plugs into the same ToolSelector slot for production runs.
 */
export function similaritySelector(utterance: string, tools: EvalTool[]): string | null {
  const u = tokens(utterance);
  if (u.size === 0) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const t of tools) {
    const doc = new Set([...tokens(t.name.replace(/_/g, " ")), ...tokens(t.description), ...t.triggers.flatMap((tr) => [...tokens(tr)])]);
    let overlap = 0;
    for (const w of u) if (doc.has(w)) overlap += 1;
    const score = overlap / Math.sqrt(doc.size || 1);
    if (score > bestScore) {
      bestScore = score;
      best = t.name;
    }
  }
  return best;
}
