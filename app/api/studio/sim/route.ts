import { requireStudio } from "@/lib/studio/auth";
import { finalizeCall, handleUtterance, startCall } from "@/lib/studio/engine";
import { handle, HttpError, readJson } from "@/lib/http";

// Text simulator for the phone agent: same engine, same rules, no telephony. Calls are tagged as test calls.
const reason = (e: unknown) =>
  e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e);

export const POST = handle(async (req) => {
  requireStudio(req);
  const b = await readJson(req);
  try {
    return await run(b);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error("[studio] sim failed", e);
    // This route is behind the studio key, so showing the real reason is safe and saves a trip to the logs.
    return Response.json({ error: reason(e) }, { status: 500 });
  }
});

async function run(b: Record<string, unknown>) {
  const action = b.action;
  if (action === "start") {
    const { call, reply } = await startCall({ phone: typeof b.phone === "string" ? b.phone : null, simulated: true });
    return Response.json({ id: call.id, reply, end_call: false });
  }
  const id = typeof b.id === "string" ? b.id : "";
  if (action === "end") return Response.json({ call: await finalizeCall(id, "hangup") });
  if (action === "say" && typeof b.text === "string" && b.text.trim()) {
    const { reply, end_call, call } = await handleUtterance(id, b.text.slice(0, 1000));
    return Response.json({ reply, end_call, call });
  }
  return Response.json({ error: "Bad request" }, { status: 400 });
}
