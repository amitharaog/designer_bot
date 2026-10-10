import type { CallRecord } from "./types";

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// From the brief: average project value is ₹8–14 lakh. Pipeline is shown as that range, never one made-up number.
export const AVG_PROJECT_LAKH = [8, 14] as const;

export function summarize(all: CallRecord[]) {
  const calls = all.filter((c) => c.finalized);
  const by = (r: string) => calls.filter((c) => c.route === r);
  const qualified = by("qualified");
  const booked = calls.filter((c) => c.booking && c.booking.status !== "failed");
  const won = calls.filter((c) => c.outcome === "won");
  const lost = calls.filter((c) => c.outcome === "lost");
  const replyMs = calls.flatMap((c) => c.transcript.filter((t) => t.latency_ms).map((t) => t.latency_ms!));
  const handoffS = calls
    .filter((c) => c.handoff?.at && c.ended_at)
    .map((c) => (new Date(c.handoff!.at!).getTime() - new Date(c.ended_at!).getTime()) / 1000);
  const ai = sum(calls.map((c) => c.cost?.ai_inr ?? 0));
  const voice = sum(calls.map((c) => c.cost?.voice_inr ?? 0));
  const total = ai + voice;
  const n = calls.length;
  const decided = won.length + lost.length;
  return {
    n,
    afterHours: calls.filter((c) => c.after_hours).length,
    answeredShare: n ? calls.filter((c) => c.transcript.some((t) => t.role === "caller")).length / n : 0,
    medianReplyS: median(replyMs) === null ? null : median(replyMs)! / 1000,
    medianHandoffS: median(handoffS),
    routes: { qualified: qualified.length, needs_review: by("needs_review").length, not_qualified: by("not_qualified").length },
    qualifiedPct: n ? qualified.length / n : 0,
    booked: booked.length,
    bookedPct: qualified.length ? booked.length / qualified.length : 0,
    pricingAsked: calls.filter((c) => c.pricing_asked).length,
    won: won.length,
    lost: lost.length,
    winRate: decided ? won.length / decided : null,
    pipelineLakh: [qualified.length * AVG_PROJECT_LAKH[0], qualified.length * AVG_PROJECT_LAKH[1]] as [number, number],
    cost: {
      ai,
      voice,
      total,
      perCall: n ? total / n : 0,
      perQualified: qualified.length ? total / qualified.length : null,
      perBooking: booked.length ? total / booked.length : null,
      tokensIn: sum(calls.map((c) => c.usage.input_tokens)),
      tokensOut: sum(calls.map((c) => c.usage.output_tokens)),
      minutes: sum(calls.map((c) => (c.duration_s ?? 0) / 60)),
    },
  };
}
