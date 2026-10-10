import { requireWebhook } from "@/lib/studio/auth";
import { ingestTranscript } from "@/lib/studio/engine";
import { getCall } from "@/lib/studio/store";
import { handle, readJson } from "@/lib/http";

/**
 * Vaani webhook ("Call Post-Processing" event). Vaani runs the conversation with its own model; once the call is over
 * it posts the finished call here, and we analyse the transcript, qualify, book, email the designer and update HubSpot.
 *
 * Vaani's payload isn't documented publicly, so this is deliberately forgiving: it looks for the call id, phone and
 * transcript under common names at any nesting depth. Every payload is logged (truncated) so the mapping can be checked.
 */
type Payload = Record<string, unknown>;

/** Breadth-first search for the first key (case-insensitive) whose value is a string/number, to a few levels deep. */
function find(obj: unknown, keys: string[], want: "scalar" | "any" = "scalar", depth = 4): unknown {
  const wanted = keys.map((k) => k.toLowerCase());
  let level: unknown[] = [obj];
  for (let d = 0; d <= depth && level.length; d++) {
    const next: unknown[] = [];
    for (const o of level) {
      if (!o || typeof o !== "object") continue;
      if (Array.isArray(o)) continue;
      for (const [k, v] of Object.entries(o as Payload)) {
        if (wanted.includes(k.toLowerCase())) {
          if (want === "any" && v != null && v !== "") return v;
          if (want === "scalar" && (typeof v === "string" || typeof v === "number") && String(v).trim()) return String(v);
        }
        if (v && typeof v === "object" && !Array.isArray(v)) next.push(v);
      }
    }
    level = next;
  }
  return undefined;
}
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

type T = { role: "agent" | "caller"; text: string };
const roleOf = (r: unknown): T["role"] => (/agent|bot|assistant|\bai\b|model|system|vaani/i.test(String(r ?? "")) ? "agent" : "caller");

/** Accepts [{role|speaker, text|content|message}] or "Agent: …\nUser: …" text; unparseable text becomes one caller turn. */
function parseTranscript(raw: unknown): T[] {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        return parseTranscript(JSON.parse(trimmed));
      } catch {}
    }
    const lines = trimmed
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*\[?([A-Za-z _-]{2,20})\]?\s*[:\-–]\s*(.+)$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => ({ role: roleOf(m[1]), text: m[2].trim() }));
    return lines.length ? lines : [{ role: "caller", text: trimmed }];
  }
  if (Array.isArray(raw)) {
    return raw
      .map((m) => (m && typeof m === "object" ? (m as Payload) : { text: String(m) }))
      .map((m) => ({
        role: roleOf(m.role ?? m.speaker ?? m.from ?? m.sender ?? m.participant),
        text: String(m.text ?? m.content ?? m.message ?? m.transcript ?? m.utterance ?? "").trim(),
      }))
      .filter((m) => m.text);
  }
  return [];
}

export const POST = handle(async (req) => {
  requireWebhook(req);
  const p = await readJson(req);
  console.log("[vaani] webhook payload", JSON.stringify(p).slice(0, 4000));

  const event = String(find(p, ["event", "event_type", "type", "status"]) ?? "").toLowerCase();
  const id = str(find(p, ["call_id", "callId", "session_id", "sessionId", "conversation_id", "room_name", "call_sid", "id"]));
  if (!id || event.includes("test")) return Response.json({ ok: true, note: "received; nothing to process" });

  const outbound = /outbound/i.test(String(find(p, ["direction", "call_direction", "call_type"]) ?? ""));
  const phone = str(
    outbound
      ? find(p, ["to", "to_number", "callee", "customer_number", "user_number", "phone_number"])
      : find(p, ["from", "from_number", "caller", "caller_number", "customer_number", "user_number", "phone_number"]),
  );
  const turns = parseTranscript(find(p, ["transcript", "transcript_object", "transcription", "messages", "conversation", "chat_history", "transcript_text"], "any"));
  const dur = Number(find(p, ["duration_s", "duration", "call_duration", "duration_seconds"]));
  const durationS = Number.isFinite(dur) && dur > 0 ? dur : undefined;

  if (turns.length) {
    const call = await ingestTranscript({ id, phone, turns, durationS });
    return Response.json({ ok: true, route: call.route });
  }
  // A finished call with no transcript (caller hung up at once): log it as a front-desk callback, once.
  if (/end|complete|post|process|hangup|no_answer|failed/.test(event) && !(await getCall(id))) {
    const call = await ingestTranscript({ id, phone, turns: [], durationS });
    return Response.json({ ok: true, route: call.route });
  }
  return Response.json({ ok: true, note: "no transcript in this event" });
});
