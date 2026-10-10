import { requireStudio } from "@/lib/studio/auth";
import { finalizeCall, handleUtterance, startCall } from "@/lib/studio/engine";
import { handle, readJson } from "@/lib/http";

// Text simulator for the phone agent: same engine, same rules, no telephony. Calls are tagged as test calls.
export const POST = handle(async (req) => {
  requireStudio(req);
  const b = await readJson(req);
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
});
