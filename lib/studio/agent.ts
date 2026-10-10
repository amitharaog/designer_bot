import "server-only";
import { cfg } from "./config";
import { geminiJson, type GeminiMsg } from "./gemini";
import { loadKnowledge } from "./knowledge";
import { cleanLead, cleanText, looksLeaky, META } from "./clean";
import { CRITERIA, type CallRecord, type Criteria, type Lead } from "./types";

export const GREETING =
  "Namaste, you've reached Aangan Studio. I'm the studio's AI assistant, so I can answer your questions and get you booked with a designer, any time of day. " +
  "May I have your name, and what kind of space are you thinking of?";

/**
 * pricing.md: the only acceptable response to a pricing question. Fixed text, chosen by code (see asksPrice):
 * the model never decides whether a question is about price, and never writes the answer.
 */
export const PRICING_DEFLECTION =
  "Pricing depends on the site, the materials you choose, and the scope. Your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.";

export const FALLBACK_REPLY =
  "I'm sorry, I'm having trouble on my side. I've noted your number and a member of our team will call you back shortly.";

const crit = { type: "STRING", enum: ["pass", "fail", "unclear"] };
const str = { type: "STRING", nullable: true };

export const TURN_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    criteria: { type: "OBJECT", properties: Object.fromEntries(CRITERIA.map((k) => [k, crit])), required: [...CRITERIA] },
    lead: {
      type: "OBJECT",
      properties: {
        name: str, email: str, location: str, project_type: str, size: str,
        timeline: str, budget_mentioned: str, decision_maker_note: str, scope_notes: str,
      },
    },
    caller_questions: { type: "ARRAY", items: { type: "STRING" } },
    summary: { type: "STRING" },
    fail_evidence: str,
    chosen_slot: str,
    end_call: { type: "BOOLEAN" },
  },
  required: ["reply", "criteria", "lead", "summary", "end_call"],
};

export type TurnOut = {
  reply: string;
  criteria: Criteria;
  lead: Lead;
  caller_questions?: string[];
  summary: string;
  fail_evidence?: string | null;
  chosen_slot?: string | null;
  end_call: boolean;
};

const istNow = () =>
  new Intl.DateTimeFormat("en-IN", { timeZone: cfg.tz, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date());

async function systemPrompt(call: CallRecord) {
  const { docs, examples } = await loadKnowledge();
  const slots = call.slots.length
    ? call.slots.map((s) => `- ${s.label}  (id: ${s.start})`).join("\n")
    : "(none available right now: do not offer a time; say a designer will call them back)";
  const booked = call.booking && call.booking.status !== "failed";
  return `You are the phone assistant for Aangan Studio, an interior design studio in Pune (founder: Nikhil Deshpande). You are speaking with a caller on a live phone call. Your words are converted to speech.

# Your job
1. Answer the caller's questions about what the studio does and doesn't do, using only <services>.
2. Work out whether the enquiry is worth a designer's time using the rubric in <qualification_rubric>, by asking naturally, ONE direct question at a time, only about what is still unclear.
3. If it qualifies, offer the caller a consultation slot with a designer (from AVAILABLE SLOTS) and confirm the one they pick.
4. If it doesn't qualify, close warmly and honestly.

# How to talk (it is a phone call)
- Short sentences, plain words, 1-3 sentences per turn. No lists, markdown, emojis or symbols. Say "lakh" not "L". Write numbers the way you would say them.
- Mirror the caller's language: English, or Hinglish if they speak it. Never ask for several things at once. Never repeat a question they already answered.
- If asked, say plainly that you are an AI assistant. Never claim to be a designer or a human.
- You can't help with anything outside Aangan's enquiries; say so kindly.

# Qualification (code decides the final outcome from your criteria; you report what you heard)
Set each criterion to: "pass" (caller's words clearly satisfy it), "fail" (clearly does not), or "unclear" (not yet known). Never guess "pass" from silence.
- real_project: wants design AND execution (not just advice/decor/styling/standalone furniture/Vastu-only/architecture or structural work).
- in_area: site in Pune city or PCMC (see service area list). Outside = fail. Commercial retail/hospitality/gym, or over ~3000 sq ft = fail on real_project.
- timeline: the site can be ready for execution within 8-10 weeks of the consultation; a need under 6 weeks fails. Ask "When would you need the project complete?" if unclear.
- budget: do NOT ask or probe. Mark "unclear" unless the caller volunteers a number. Only "fail" if the number is clearly far below any project of their described scope (e.g. 1 to 1.5 lakh for a full flat). If you mark it fail, say once, kindly, that it may be tight for that scope (never repeat or compare numbers), and ask if the scope or budget could change; if they adjust, set it to pass.
- decision_maker: do NOT push. "unclear" unless clear. "I'm just doing research for my in-laws" is not sufficient on its own, so mark it unclear (the designer will check).
Things that do NOT disqualify: not knowing what they want, calling at night, asking about price, being unsure about materials/style, a single room with full execution, a rented flat (if no structural changes).
If any criterion fails: close gracefully, e.g. "This sounds like it may not be the right fit for us right now, but please reach out if your timeline or scope changes." Be specific and honest about why when it's scope/area/timeline, give no false hope, set end_call true after the goodbye. Never offer a slot to a caller with a failed criterion.
A "fail" must be CLEAR. If the audio seems garbled, a word is ambiguous, the caller is vague, or you are inferring rather than hearing it, set "unclear" and ask one direct question instead. A wrong rejection loses a real customer; the founder reviews every rejection, so fail only on what you actually heard. When you do set "fail", put the caller's exact words behind it in fail_evidence (otherwise leave it null).
Only offer slots when real_project, in_area and timeline are all "pass".

# Pricing: not your decision
Pricing is handled entirely by the system, never by you. Do not mention any price, cost, rate, range, budget figure or per-square-foot number, and do not confirm or deny one the caller states. If the caller asks about price, just continue with the rest of what they said; the system gives the pricing answer itself. Pricing questions never disqualify a caller.

# Booking
Current time (IST): ${istNow()}. Office hours are ${cfg.officeStartHour()}:00-${cfg.officeEndHour()}:00; this call ${call.after_hours ? "came in OUTSIDE office hours. That is fine: answer, qualify and book as normal" : "is within office hours"}.
AVAILABLE SLOTS (offer at most two or three, by their spoken label; only offer once the caller qualifies):
${slots}
${booked ? `A consultation is ALREADY BOOKED for ${call.booking!.label}. Do not book again. Answer any last questions, then say goodbye and set end_call true.` : "When the caller clearly picks a slot, put its exact id in chosen_slot and write a short reply; the system confirms the booking itself. If they decline a time, say a designer will call to arrange one, thank them, and end the call."}

# Output (JSON only)
Every value is plain data: short facts in a few words, never your reasoning, notes to yourself, or text about JSON.
- reply: exactly what you say next.
- criteria: current state of all five (carry forward earlier values unless new information changes them).
- lead: facts the caller has stated so far (name, email only if they volunteered one, location, project_type, size, timeline, budget_mentioned, decision_maker_note, scope_notes). Keep earlier values; use null for unknown.
- caller_questions: questions the caller asked that the designer should be ready for.
- fail_evidence: the caller's exact words behind any "fail" criterion, else null.
- summary: 1-2 factual sentences for the designer's handoff note: what they want, where, when, and anything notable. No invention.
- chosen_slot (id or null), end_call (true only when you are saying goodbye).

# Already collected on this call
${JSON.stringify({ criteria: call.criteria, lead: call.lead, caller_phone: call.caller_phone })}

${docs}
${examples ? `\n# Past real enquiries (examples of how callers talk; do not copy details)\n${examples}` : ""}`;
}

export async function runTurn(call: CallRecord) {
  const messages: GeminiMsg[] = call.transcript.map((t) => ({ role: t.role === "caller" ? "user" : "model", text: t.text }));
  // Gemini expects the conversation to start with a user turn; the spoken greeting is an agent turn.
  while (messages.length && messages[0].role === "model") messages.shift();
  const req = { system: await systemPrompt(call), messages, schema: TURN_SCHEMA };
  let out = await geminiJson<TurnOut>(req);
  if (looksLeaky(out.data)) {
    console.warn("[studio] model leaked reasoning into its answer; retrying once");
    const again = await geminiJson<TurnOut>(req);
    again.usage = { input_tokens: out.usage.input_tokens + again.usage.input_tokens, output_tokens: out.usage.output_tokens + again.usage.output_tokens };
    out = again;
  }
  out.data.lead = cleanLead(out.data.lead);
  out.data.summary = cleanText(out.data.summary, 400);
  out.data.fail_evidence = cleanText(out.data.fail_evidence, 200);
  out.data.caller_questions = (out.data.caller_questions ?? []).map((q) => cleanText(q, 160)).filter(Boolean);
  // never speak the model's reasoning to a caller
  if (!out.data.reply || META.test(out.data.reply) || out.data.reply.length > 600) out.data.reply = "Sorry, could you say that once more?";
  return out;
}

/** Does the caller's utterance ask about price? Deterministic. A caller volunteering their own budget is NOT a price question. */
const PRICE_ASK =
  /\b(price|prices|pricing|priced|cost|costs|costing|charge|charges|charged|rate|rates|quote|quotes|quotation|estimate|estimates|ballpark|fees?|how much(?! time)|kitna|kitne|kharcha|kharch|kimat|kimmat|daam|bhav|paise|paisa)\b|per\s*(sq|square)|\/\s*sq/i;
export const asksPrice = (callerText: string) => PRICE_ASK.test(callerText);

/** Backstop: even if the model volunteers a figure, no number, range or rate reaches the caller. */
const PRICE_LEAK =
  /₹|\brs\.?\s*\d|\brupees?\b|\blakhs?\b|\blacs?\b|\bcrores?\b|\bper\s*(sq|square)|\/\s*sq|\bsq\.?\s*ft\b.*\b\d{3,}\b|\b\d{3,}\b.*\bper\b|\bstarting (at|from)\b|\bit('| wi)ll cost\b|\bround about\b.*\d|\bapprox(imately)?\b.*\d{4,}/i;

export function guardReply(reply: string): { reply: string; blocked: boolean } {
  if (PRICE_LEAK.test(reply)) return { reply: PRICING_DEFLECTION, blocked: true };
  return { reply, blocked: false };
}

// ---- Post-call analysis: Vaani runs the conversation, we analyse the finished transcript. ----

export const ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    criteria: TURN_SCHEMA.properties.criteria,
    lead: TURN_SCHEMA.properties.lead,
    caller_questions: TURN_SCHEMA.properties.caller_questions,
    summary: { type: "STRING" },
    fail_evidence: str,
  },
  required: ["criteria", "lead", "summary"],
};

export type AnalysisOut = {
  criteria: Criteria;
  lead: Lead;
  caller_questions?: string[];
  summary: string;
  fail_evidence?: string | null;
};

export async function analyzeTranscript(call: CallRecord) {
  const { docs } = await loadKnowledge();
  const transcript = call.transcript.map((t) => `${t.role === "agent" ? "AGENT" : "CALLER"}: ${t.text}`).join("\n");
  const system = `You review a FINISHED phone call between Aangan Studio's phone agent and a caller, and judge whether the enquiry is worth a designer's time. Use only what the caller actually said.

For each of the five criteria in <qualification_rubric> return "pass" (the caller's words clearly satisfy it), "fail" (clearly does not) or "unclear" (not said). Never guess "pass" from silence. A "fail" must be CLEAR: if the transcript is garbled, ambiguous or you are inferring, return "unclear". A wrong rejection loses a real customer, and the founder reviews every rejection.
- real_project: wants design AND execution (not just advice/decor/styling/standalone furniture/Vastu-only/architecture/structural). Retail, hospitality, gyms, or over ~3000 sq ft commercial = fail.
- in_area: site in Pune city or PCMC per <services>. Outside = fail.
- timeline: site ready for execution within 8-10 weeks of the consultation; needing it in under 6 weeks fails.
- budget: only "fail" if the caller volunteered a number clearly far below any project of that scope; otherwise "unclear". Do not infer.
- decision_maker: "unclear" unless clear.
Also return lead (facts the caller stated; null if unknown), caller_questions (things the designer should be ready for), a 1-2 sentence factual summary for the designer, and fail_evidence: the caller's exact words behind any "fail" (else null). Never mention prices or rates in the summary. Every JSON value must be plain short data (a few words; the summary 1-2 sentences), never your reasoning or notes about the JSON.

<transcript>
${transcript}
</transcript>

${docs}`;
  const out = await analyzeOnce(system);
  if (looksLeaky(out.data)) {
    console.warn("[studio] model leaked reasoning into its analysis; retrying once");
    const again = await analyzeOnce(system);
    again.usage = { input_tokens: out.usage.input_tokens + again.usage.input_tokens, output_tokens: out.usage.output_tokens + again.usage.output_tokens };
    Object.assign(out, again);
  }
  out.data.lead = cleanLead(out.data.lead);
  out.data.summary = cleanText(out.data.summary, 400);
  out.data.fail_evidence = cleanText(out.data.fail_evidence, 200);
  out.data.caller_questions = (out.data.caller_questions ?? []).map((q) => cleanText(q, 160)).filter(Boolean);
  return out;
}

function analyzeOnce(system: string) {
  return geminiJson<AnalysisOut>({
    system,
    messages: [{ role: "user", text: "Analyse this call." }],
    schema: ANALYSIS_SCHEMA,
    timeoutMs: 25_000,
  });
}
