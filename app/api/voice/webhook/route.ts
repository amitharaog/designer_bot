import { requireWebhook } from "@/lib/studio/auth";
import { finalizeCall, handleUtterance, ingestTranscript, startCall } from "@/lib/studio/engine";
import { getCall } from "@/lib/studio/store";
import { handle, readJson } from "@/lib/http";

/**
 * Voice-provider adapter (Vaani Labs). One endpoint, three events:
 *   start     { call_id, from }                      -> { reply }          (the greeting to speak)
 *   utterance { call_id, text }                      -> { reply, end_call }
 *   end       { call_id, duration_s? }               -> { ok }             (hangup; finalises + sends the handoff)
 *
 * The field names below are tolerant guesses. Vaani's real webhook/custom-LLM payload must be mapped here (and
 * only here) once their docs/dashboard are in hand: nothing else in the system knows about the provider.
 */
type Payload = Record<string, unknown>;
const pick = (p: Payload, ...keys: string[]) => {
  for (const k of keys) if (typeof p[k] === "string" || typeof p[k] === "number") return String(p[k]);
  return undefined;
};

/** Accepts [{role|speaker, text|content|message}] or "Agent: ...\nCaller: ..." lines. */
function parseTranscript(raw: unknown): { role: "agent" | "caller"; text: string }[] {
  const role = (r: unknown) => (/agent|bot|assistant|ai|model/i.test(String(r)) ? "agent" : "caller") as "agent" | "caller";
  if (Array.isArray(raw)) {
    return raw
      .map((m) => (m && typeof m === "object" ? (m as Payload) : {}))
      .map((m) => ({ role: role(m.role ?? m.speaker ?? m.from), text: String(m.text ?? m.content ?? m.message ?? "").trim() }))
      .filter((m) => m.text);
  }
  if (typeof raw === "string") {
    return raw
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Za-z ]{2,20}):\s*(.+)$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => ({ role: role(m[1]), text: m[2].trim() }));
  }
  return [];
}

export const POST = handle(async (req) => {
  requireWebhook(req);
  const p = await readJson(req);
  // Vaani's payload shape isn't documented publicly: log it (truncated) so the mapping below can be checked in Vercel logs.
  console.log("[vaani] webhook payload", JSON.stringify(p).slice(0, 4000));
  const id = pick(p, "call_id", "callId", "call_sid", "session_id", "id", "conversation_id", "room_name");
  if (!id) return Response.json({ error: "call_id is required" }, { status: 400 });
  const event = (pick(p, "event", "type") ?? "utterance").toLowerCase();
  const phone = pick(p, "from", "caller_number", "caller", "phone");

  if (event === "start" || event === "call_started") {
    const { reply } = await startCall({ id, phone });
    return Response.json({ reply, end_call: false });
  }
  const dur = Number(pick(p, "duration_s", "duration", "call_duration"));
  const turns = parseTranscript(p.transcript ?? p.messages ?? p.conversation);
  // Post-call mode: the finished transcript arrives with the end event (or as its own event).
  if (turns.length && (event === "end" || event === "call_ended" || event === "hangup" || event === "transcript" || event === "call_completed")) {
    const call = await ingestTranscript({ id, phone, turns, durationS: Number.isFinite(dur) && dur > 0 ? dur : undefined });
    return Response.json({ ok: true, route: call.route });
  }
  if (event === "end" || event === "call_ended" || event === "hangup") {
    if (!(await getCall(id))) {
      // A call we never heard speak (caller hung up at once): still create the record so the front desk calls back.
      const call = await ingestTranscript({ id, phone, turns: [], durationS: Number.isFinite(dur) && dur > 0 ? dur : undefined });
      return Response.json({ ok: true, route: call.route });
    }
    await finalizeCall(id, "hangup", Number.isFinite(dur) && dur > 0 ? dur : undefined);
    return Response.json({ ok: true });
  }
  const text = pick(p, "text", "transcript", "utterance", "user_message", "speech");
  if (!text?.trim()) return Response.json({ reply: "Sorry, I didn't catch that. Could you say it again?", end_call: false });
  if (!(await getCall(id))) await startCall({ id, phone });
  const { reply, end_call } = await handleUtterance(id, text);
  return Response.json({ reply, end_call });
});
