import "server-only";
import { cleanCall } from "./clean";
import { deskView, isBooked } from "./format";
import { listCalls } from "./store";
import type { CallRecord } from "./types";

export type DeskView = "overview" | "upcoming" | "schedule" | "past" | "calls" | "attention";
export const VIEWS: DeskView[] = ["overview", "upcoming", "schedule", "past", "calls", "attention"];

const isLead = (c: CallRecord) => c.finalized && (c.route === "qualified" || c.founder_decision === "forwarded");

/** Everything the designer desk shows, computed once per request. */
export async function loadDesk(includeTest: boolean) {
  const all = (await listCalls()).map(cleanCall).filter((c) => includeTest || !c.simulated);
  const leads = all.filter(isLead);
  const view = deskView(leads);
  // Things a person should look at: calls the AI couldn't process, and leads whose booking or email failed.
  const attention = all.filter(
    (c) =>
      c.finalized &&
      ((c.usage.errors > 0 && c.transcript.some((t) => t.role === "caller")) ||
        (isLead(c) && (c.handoff?.status === "failed" || c.booking?.status === "failed"))),
  );
  return {
    ...view,
    all,
    leads,
    attention,
    counts: {
      overview: 0,
      upcoming: view.upcoming.length,
      schedule: view.toSchedule.length,
      past: view.past.length,
      calls: all.length,
      attention: attention.length,
    } satisfies Record<DeskView, number>,
    bookedCount: leads.filter(isBooked).length,
  };
}

export const deskHref = (key: string | null, includeTest: boolean, view?: DeskView) => {
  const p = new URLSearchParams();
  if (key) p.set("key", key);
  if (includeTest) p.set("test", "1");
  if (view && view !== "overview") p.set("view", view);
  const s = p.toString();
  return `/studio${s ? `?${s}` : ""}`;
};
