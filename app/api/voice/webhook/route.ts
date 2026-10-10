import { requireWebhook } from "@/lib/studio/auth";
import { finalizeCall, handleUtterance, startCall } from "@/lib/studio/engine";
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

export const POST = handle(async (req) => {
  requireWebhook(req);
  const p = await readJson(req);
  const id = pick(p, "call_id", "callId", "call_sid", "session_id", "id");
  if (!id) return Response.json({ error: "call_id is required" }, { status: 400 });
  const event = (pick(p, "event", "type") ?? "utterance").toLowerCase();
  const phone = pick(p, "from", "caller_number", "caller", "phone");

  if (event === "start" || event === "call_started") {
    const { reply } = await startCall({ id, phone });
    return Response.json({ reply, end_call: false });
  }
  if (event === "end" || event === "call_ended" || event === "hangup") {
    if (!(await getCall(id))) return Response.json({ ok: true });
    const dur = Number(pick(p, "duration_s", "duration", "call_duration"));
    await finalizeCall(id, "hangup", Number.isFinite(dur) && dur > 0 ? dur : undefined);
    return Response.json({ ok: true });
  }
  const text = pick(p, "text", "transcript", "utterance", "user_message", "speech");
  if (!text?.trim()) return Response.json({ reply: "Sorry, I didn't catch that. Could you say it again?", end_call: false });
  if (!(await getCall(id))) await startCall({ id, phone });
  const { reply, end_call } = await handleUtterance(id, text);
  return Response.json({ reply, end_call });
});
