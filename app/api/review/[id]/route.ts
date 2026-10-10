import { founderDecide } from "@/lib/studio/engine";
import { reviewTokenOk } from "@/lib/studio/review";
import { fail, handle, readJson } from "@/lib/http";

// POST /api/review/:id  { decision: "forward" | "keep", t: <signed token from the review link> }
export const POST = handle(async (req, ctx: RouteContext<"/api/review/[id]">) => {
  const { id } = await ctx.params;
  const b = await readJson(req);
  if (!reviewTokenOk(id, typeof b.t === "string" ? b.t : null)) fail(403, "This review link isn't valid");
  if (b.decision !== "forward" && b.decision !== "keep") fail(400, "decision must be forward or keep");
  const call = await founderDecide(id, b.decision);
  return Response.json({ founder_decision: call.founder_decision, handoff: call.handoff?.status ?? null });
});
