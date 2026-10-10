import type { CallRecord, Lead } from "./types";

// ---- Output hygiene ----
// Some Gemini models write their chain of thought into JSON string values ("Wait, let's write clean JSON…").
export const META = /\b(JSON|schema|criteria|rubric|end_call|chosen_slot)\b|\bWait,|\bLet's\b|\blet me\b/i;
const LIMITS: Record<string, number> = {
  name: 60, email: 80, location: 80, project_type: 80, size: 40, timeline: 80,
  budget_mentioned: 80, decision_maker_note: 100, scope_notes: 240,
};
export function looksLeaky(o: { reply?: string; summary?: string; lead?: Lead }) {
  const vals = [o.reply, o.summary, ...Object.values(o.lead ?? {})].filter((v): v is string => typeof v === "string");
  return vals.some((v) => META.test(v) || v.length > 600);
}
/** Drop values that are reasoning rather than facts; trim the rest. */
export function cleanText(v: string | null | undefined, max: number) {
  const t = (v ?? "").trim();
  if (!t || META.test(t) || t.length > max * 1.5) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
export function cleanLead(lead: Lead | undefined): Lead {
  const out: Lead = {};
  for (const [k, v] of Object.entries(lead ?? {})) {
    if (typeof v !== "string") continue;
    const c = cleanText(v, LIMITS[k] ?? 120);
    if (c) (out as Record<string, string>)[k] = c;
  }
  return out;
}

/** Apply the same hygiene to stored calls before showing them (older records may contain leaked reasoning). */
export function cleanCall(c: CallRecord): CallRecord {
  return {
    ...c,
    lead: cleanLead(c.lead),
    summary: cleanText(c.summary, 400),
    fail_evidence: cleanText(c.fail_evidence, 200),
    caller_questions: c.caller_questions.map((q) => cleanText(q, 160)).filter(Boolean),
  };
}
