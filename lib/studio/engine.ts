import "server-only";
import { randomUUID } from "node:crypto";
import { analyzeTranscript, asksPrice, FALLBACK_REPLY, GREETING, guardReply, PRICING_DEFLECTION, runTurn } from "./agent";
import { bookSlot, getSlots } from "./calcom";
import { cfg } from "./config";
import { sendEmail } from "./email";
import { buildClientNotice, buildHandoff } from "./handoff";
import { syncHubspot } from "./hubspot";
import { reviewUrl } from "./review";
import { blankCriteria, isCrit, verdict } from "./rubric";
import { getCall, saveCall } from "./store";
import { CRITERIA, type CallRecord, type Route, type Turn } from "./types";

const FORCE_WRAP =
  "I want to be respectful of your time. I've noted everything you've told me, and a member of our team will call you back to take it forward. Thank you for calling Aangan Studio.";

function afterHours(d = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: cfg.tz, hour: "2-digit", hour12: false }).format(d)) % 24;
  return h < cfg.officeStartHour() || h >= cfg.officeEndHour();
}

export async function startCall(opts: { id?: string; phone?: string | null; simulated?: boolean }) {
  const id = opts.id || randomUUID();
  const existing = await getCall(id);
  if (existing) return { call: existing, reply: GREETING };

  let slots: CallRecord["slots"] = [];
  try {
    slots = (await getSlots()).slots; // prefetched so the model can offer a time in the same turn it qualifies
  } catch (e) {
    console.error("[studio] slots prefetch failed", e);
  }
  const now = new Date();
  const call: CallRecord = {
    id,
    simulated: !!opts.simulated,
    caller_phone: opts.phone?.trim() || null,
    started_at: now.toISOString(),
    ended_at: null,
    after_hours: afterHours(now),
    transcript: [{ role: "agent", text: GREETING, at: now.toISOString() }],
    criteria: blankCriteria(),
    lead: {},
    summary: "",
    caller_questions: [],
    pricing_asked: false,
    slots,
    booking: null,
    route: null,
    route_reason: null,
    handoff: null,
    usage: { input_tokens: 0, output_tokens: 0, model_calls: 0, errors: 0 },
    duration_s: null,
    cost: null,
    founder_decision: null,
    fail_evidence: "",
    hubspot: null,
    finalized: false,
  };
  await saveCall(call);
  return { call, reply: GREETING };
}

export async function handleUtterance(id: string, text: string): Promise<{ reply: string; end_call: boolean; call: CallRecord }> {
  const call = await getCall(id);
  if (!call) throw new Error("Unknown call");
  if (call.finalized) return { reply: "Thank you for calling Aangan Studio. Goodbye.", end_call: true, call };

  const t0 = Date.now();
  call.transcript.push({ role: "caller", text: text.trim(), at: new Date().toISOString() });
  const callerTurns = call.transcript.filter((t) => t.role === "caller").length;

  let reply: string;
  let end = false;
  try {
    const { data, usage } = await runTurn(call);
    call.usage.model_calls++;
    call.usage.input_tokens += usage.input_tokens;
    call.usage.output_tokens += usage.output_tokens;

    for (const k of CRITERIA) if (isCrit(data.criteria?.[k])) call.criteria[k] = data.criteria[k];
    for (const [k, v] of Object.entries(data.lead ?? {})) if (typeof v === "string" && v.trim()) (call.lead as Record<string, string>)[k] = v.trim();
    if (data.summary) call.summary = data.summary;
    if (data.fail_evidence?.trim()) call.fail_evidence = data.fail_evidence.trim();
    // A rejection the model cannot quote is not trusted: keep asking instead of ending the call.
    if (!call.fail_evidence) for (const k of CRITERIA) if (call.criteria[k] === "fail") call.criteria[k] = "unclear";
    if (data.caller_questions?.length) call.caller_questions = [...new Set([...call.caller_questions, ...data.caller_questions])].slice(0, 10);

    reply = data.reply;
    end = !!data.end_call;
    const v = verdict(call.criteria);

    // Booking is done by code, never claimed by the model: only qualified callers, only offered slots.
    const slot = data.chosen_slot ? call.slots.find((s) => s.start === data.chosen_slot) : undefined;
    if (slot && !call.booking) {
      if (v.kind !== "qualified") {
        reply = "Before I lock in a time, let me just confirm a couple of details. Could you tell me a little more about the project?";
        end = false;
      } else {
        call.booking = await bookSlot(slot, call.lead, call.caller_phone);
        if (call.booking.status === "failed") {
          console.error("[studio] booking failed", call.booking.error);
          reply = "I'm sorry, I couldn't lock that time just now. I've passed your details to a designer, who will call you shortly to fix a slot.";
          end = true;
        } else {
          const who = call.booking.designer ? `with ${call.booking.designer}` : "with one of our designers";
          reply = `Done. Your consultation ${who} is booked for ${slot.label}. They'll already have everything we discussed, so you won't need to repeat yourself. Is there anything else I can help with?`;
          end = false;
        }
      }
    }
    // Pricing is never the model's call: code detects the question and says the fixed pricing.md line.
    // (A caller who failed a criterion still gets their graceful goodbye, not a booking pitch.)
    if (asksPrice(text)) {
      call.pricing_asked = true;
      if (v.kind !== "not_qualified" && !(slot && call.booking?.status !== "failed")) {
        reply = PRICING_DEFLECTION;
        end = false;
      }
    }
    // A failed criterion always ends the call (the model has been told to close gracefully).
    if (v.kind === "not_qualified" && !call.booking) end = true;

    const g = guardReply(reply);
    if (g.blocked) console.warn("[studio] pricing guard replaced a reply:", reply);
    reply = g.reply;
  } catch (e) {
    console.error("[studio] turn failed", e);
    call.usage.errors++;
    reply = FALLBACK_REPLY;
    end = true;
    call.route_reason = `AI error: ${e instanceof Error ? e.message : String(e)}`;
  }

  if (!end && callerTurns >= cfg.maxTurns()) {
    reply = FORCE_WRAP;
    end = true;
  }
  call.transcript.push({ role: "agent", text: reply, at: new Date().toISOString(), latency_ms: Date.now() - t0 });
  await saveCall(call);
  if (end) return { reply, end_call: true, call: await finalizeCall(id, "agent_ended") };
  return { reply, end_call: false, call };
}

/** Decide the route, send the handoff email, record cost. Safe to call repeatedly (provider hangup webhooks do). */
export async function finalizeCall(id: string, reason: string, durationS?: number): Promise<CallRecord> {
  const call = await getCall(id);
  if (!call) throw new Error("Unknown call");
  if (call.finalized) return call;

  const end = new Date();
  call.ended_at = end.toISOString();
  call.duration_s = durationS ?? Math.max(1, Math.round((end.getTime() - new Date(call.started_at).getTime()) / 1000));

  const v = verdict(call.criteria);
  const spoke = call.transcript.some((t) => t.role === "caller");
  let route: Route;
  let why: string;
  if (call.usage.errors > 0) [route, why] = ["needs_review", call.route_reason ?? "AI error during the call"];
  else if (!spoke) [route, why] = ["needs_review", "Caller hung up before speaking: call back"];
  else if (v.kind === "not_qualified") [route, why] = ["not_qualified", v.reason];
  else if (v.kind === "qualified") [route, why] = ["qualified", v.reason];
  else [route, why] = ["needs_review", `${v.reason}${reason === "hangup" ? " (caller hung up)" : ""}`];
  call.route = route;
  call.route_reason = why;

  if (route === "not_qualified") {
    // The AI may be wrong: a rejection goes to the founder with the transcript, never silently to the bin.
    call.founder_decision = "pending";
    const to = cfg.email.founder();
    const note = buildHandoff(call, { reviewUrl: reviewUrl(call.id) });
    const r = await sendEmail(to, note.subject, note.text, note.html);
    call.handoff = { to, status: r.status, at: new Date().toISOString(), error: r.error };
  } else {
    const to = route === "qualified" ? [...cfg.email.designers(), ...cfg.email.frontDesk()] : cfg.email.frontDesk();
    const note = buildHandoff(call);
    const r = await sendEmail(to, note.subject, note.text, note.html);
    call.handoff = { to, status: r.status, at: new Date().toISOString(), error: r.error };
    if (route === "qualified") {
      if (call.lead.email) {
        const n = buildClientNotice(call);
        call.handoff.client = (await sendEmail([call.lead.email], n.subject, n.text, n.html)).status;
      } else call.handoff.client = "skipped";
    }
  }

  const ai_inr =
    ((call.usage.input_tokens * cfg.gemini.inUsdPerM() + call.usage.output_tokens * cfg.gemini.outUsdPerM()) / 1e6) * cfg.usdInr();
  const voice_inr = call.simulated ? 0 : (call.duration_s / 60) * cfg.voiceInrPerMin();
  call.cost = { ai_inr, voice_inr, total_inr: ai_inr + voice_inr };
  call.finalized = true;
  call.hubspot = await syncHubspot(call);
  await saveCall(call);
  return call;
}

/** Founder's call on an AI-rejected (or review) lead after reading the transcript. Idempotent. */
export async function founderDecide(id: string, decision: "forward" | "keep"): Promise<CallRecord> {
  const call = await getCall(id);
  if (!call || !call.finalized) throw new Error("Unknown call");
  if (call.route === "qualified") throw new Error("This call was already qualified");
  if (decision === "keep") {
    if (call.founder_decision === "forwarded") return call; // the designer has already been told
    call.founder_decision = "kept_rejected";
  } else {
    if (call.founder_decision === "forwarded") return call;
    call.founder_decision = "forwarded";
    const to = [...cfg.email.designers(), ...cfg.email.frontDesk()];
    const note = buildHandoff(call);
    const r = await sendEmail(to, note.subject, note.text, note.html);
    call.handoff = { to, status: r.status, at: new Date().toISOString(), error: r.error };
  }
  call.hubspot = await syncHubspot(call);
  await saveCall(call);
  return call;
}

/**
 * Post-call mode: Vaani runs the whole conversation and sends the finished transcript.
 * Analyse it once, qualify, book the earliest slot for qualified leads, then the normal finalize
 * (designer email / founder review / HubSpot). Idempotent per call id.
 */
export async function ingestTranscript(opts: { id?: string; phone?: string | null; turns: Omit<Turn, "at">[]; durationS?: number; simulated?: boolean }) {
  const id = opts.id || randomUUID();
  const existing = await getCall(id);
  if (existing?.finalized) return existing;

  const now = new Date();
  const call: CallRecord = existing ?? {
    id,
    simulated: !!opts.simulated,
    caller_phone: opts.phone?.trim() || null,
    started_at: new Date(now.getTime() - (opts.durationS ?? 0) * 1000).toISOString(),
    ended_at: null,
    after_hours: false,
    transcript: [],
    criteria: blankCriteria(),
    lead: {},
    summary: "",
    caller_questions: [],
    pricing_asked: false,
    slots: [],
    booking: null,
    route: null,
    route_reason: null,
    handoff: null,
    usage: { input_tokens: 0, output_tokens: 0, model_calls: 0, errors: 0 },
    duration_s: null,
    cost: null,
    founder_decision: null,
    fail_evidence: "",
    hubspot: null,
    finalized: false,
  };
  call.after_hours = afterHours(new Date(call.started_at));
  call.transcript = opts.turns.map((t) => ({ ...t, at: now.toISOString() }));
  call.pricing_asked = call.transcript.some((t) => t.role === "caller" && asksPrice(t.text));
  // Vaani's own model is speaking live, so code can't gate its words. Check afterwards and flag any figure it may have quoted.
  const priceLeak = call.transcript.some((t) => t.role === "agent" && guardReply(t.text).blocked);

  if (call.transcript.some((t) => t.role === "caller")) {
    try {
      const { data, usage } = await analyzeTranscript(call);
      call.usage.model_calls++;
      call.usage.input_tokens += usage.input_tokens;
      call.usage.output_tokens += usage.output_tokens;
      for (const k of CRITERIA) if (isCrit(data.criteria?.[k])) call.criteria[k] = data.criteria[k];
      for (const [k, v] of Object.entries(data.lead ?? {})) if (typeof v === "string" && v.trim()) (call.lead as Record<string, string>)[k] = v.trim();
      call.summary = data.summary ?? "";
      call.caller_questions = (data.caller_questions ?? []).slice(0, 10);
      call.fail_evidence = data.fail_evidence?.trim() ?? "";
      // a rejection that can't be quoted is not trusted; the founder/designer can still see the transcript
      if (!call.fail_evidence) for (const k of CRITERIA) if (call.criteria[k] === "fail") call.criteria[k] = "unclear";
    } catch (e) {
      console.error("[studio] transcript analysis failed", e);
      call.usage.errors++;
      call.route_reason = `AI error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  if (priceLeak) call.summary = `WARNING: the agent may have quoted a price on this call. Check the transcript. ${call.summary}`.trim();

  // Qualified: book the earliest slot (the caller was told a designer will confirm a time).
  if (verdict(call.criteria).kind === "qualified" && !call.usage.errors && !call.booking) {
    try {
      const { slots } = await getSlots();
      call.slots = slots;
      if (slots[0]) call.booking = await bookSlot(slots[0], call.lead, call.caller_phone);
    } catch (e) {
      console.error("[studio] post-call booking failed", e);
    }
  }
  await saveCall(call);
  return finalizeCall(id, "transcript", opts.durationS);
}
