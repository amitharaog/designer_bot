import { requireStudio } from "@/lib/studio/auth";
import { reprocessCall } from "@/lib/studio/engine";
import { handle } from "@/lib/http";

// POST /api/studio/calls/:id/retry: re-run the transcript analysis for a call that hit an AI error.
export const POST = handle(async (req, ctx: RouteContext<"/api/studio/calls/[id]/retry">) => {
  requireStudio(req);
  const { id } = await ctx.params;
  try {
    const call = await reprocessCall(id);
    return Response.json({ route: call.route, reason: call.route_reason });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
});
