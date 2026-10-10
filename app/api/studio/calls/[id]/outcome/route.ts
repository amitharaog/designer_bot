import { requireStudio } from "@/lib/studio/auth";
import { getCall, saveCall } from "@/lib/studio/store";
import { fail, handle, readJson } from "@/lib/http";

// Founder/designer marks what happened to a lead, which is what makes "conversions" on the dashboard real.
export const POST = handle(async (req, ctx: RouteContext<"/api/studio/calls/[id]/outcome">) => {
  requireStudio(req);
  const { id } = await ctx.params;
  const { outcome } = await readJson(req);
  if (outcome !== "open" && outcome !== "won" && outcome !== "lost") fail(400, "outcome must be open, won or lost");
  const call = await getCall(id);
  if (!call) fail(404, "Call not found");
  call.outcome = outcome;
  await saveCall(call);
  return Response.json({ ok: true });
});
