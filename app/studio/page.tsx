import Link from "next/link";
import StudioNav, { Locked } from "@/components/studio/StudioNav";
import { studioKeyOk } from "@/lib/studio/auth";
import { summarize } from "@/lib/studio/metrics";
import { listCalls } from "@/lib/studio/store";
import type { CallRecord, Route } from "@/lib/studio/types";

const inr = (n: number | null, d = 0) => (n === null ? "–" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d })}`);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const secs = (n: number | null) => (n === null ? "–" : n < 90 ? `${n.toFixed(1)}s` : `${Math.round(n / 60)} min`);

const ROUTE: Record<Route, { label: string; cls: string }> = {
  qualified: { label: "Qualified", cls: "bg-emerald-100 text-emerald-800" },
  needs_review: { label: "Needs review", cls: "bg-amber-100 text-amber-800" },
  not_qualified: { label: "Not qualified", cls: "bg-slate-200 text-slate-700" },
};

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

async function callsSince(days: number, includeTest: boolean) {
  const since = days ? Date.now() - days * 86400_000 : 0;
  return (await listCalls()).filter((c) => (includeTest || !c.simulated) && new Date(c.started_at).getTime() >= since);
}

export default async function Dashboard(props: PageProps<"/studio">) {
  const q = await props.searchParams;
  const key = typeof q.key === "string" ? q.key : null;
  if (!studioKeyOk(key)) return <Locked />;
  const days = q.days === "7" ? 7 : q.days === "all" ? 0 : 30;
  const includeTest = q.test === "1";

  const all = await callsSince(days, includeTest);
  const m = summarize(all);
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(key ? { key } : {}), ...(q.days ? { days: String(q.days) } : {}), ...(includeTest ? { test: "1" } : {}), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/studio?${p}`;
  };
  const pill = (on: boolean) => `rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`;
  const kq = key ? `?key=${encodeURIComponent(key)}` : "";

  return (
    <>
      <StudioNav k={key} active="dashboard" />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Every call, what it became, and what it cost</h1>
            <p className="text-sm text-slate-500">Incoming phone calls only. {days ? `Last ${days} days.` : "All time."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={href({ days: "7" })} className={pill(days === 7)}>7 days</Link>
            <Link href={href({ days: "30" })} className={pill(days === 30)}>30 days</Link>
            <Link href={href({ days: "all" })} className={pill(days === 0)}>All time</Link>
            <Link href={href({ test: includeTest ? "" : "1" })} className={pill(includeTest)}>{includeTest ? "Test calls shown" : "Show test calls"}</Link>
          </div>
        </div>

        {m.n === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="font-bold">No calls yet.</p>
            <p className="mt-1 text-sm text-slate-600">
              Point Vaani at <code>/api/voice/webhook</code>, or <Link className="font-semibold underline" href={`/studio/simulate${kq}`}>try a call here</Link> (then switch on “Show test calls”).
            </p>
          </div>
        ) : (
          <>
            <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">Response</h2>
            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Calls handled" value={String(m.n)} sub={`${m.afterHours} after hours (${pct(m.n ? m.afterHours / m.n : 0)})`} />
              <Tile label="Callers who got a conversation" value={pct(m.answeredShare)} sub="the rest hung up before speaking" />
              <Tile label="Median reply time" value={secs(m.medianReplyS)} sub="agent's answer to each thing said" />
              <Tile label="Call end → designer email" value={secs(m.medianHandoffS)} sub="time to handoff" />
            </div>

            <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">What it is generating</h2>
            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Qualified" value={`${m.routes.qualified}`} sub={`${pct(m.qualifiedPct)} of calls`} />
              <Tile label="Consultations booked" value={`${m.booked}`} sub={`${pct(m.bookedPct)} of qualified`} />
              <Tile label="Won / lost" value={`${m.won} / ${m.lost}`} sub={m.winRate === null ? "mark outcomes on each call" : `${pct(m.winRate)} win rate`} />
              <Tile label="Qualified pipeline" value={`₹${m.pipelineLakh[0]}–${m.pipelineLakh[1]} lakh`} sub="qualified × avg project ₹8–14 lakh" />
            </div>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-200" role="img" aria-label="Call outcomes">
              <div className="bg-emerald-500" style={{ width: pct(m.routes.qualified / m.n) }} />
              <div className="bg-amber-400" style={{ width: pct(m.routes.needs_review / m.n) }} />
              <div className="bg-slate-400" style={{ width: pct(m.routes.not_qualified / m.n) }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              <span className="text-emerald-700">●</span> qualified {m.routes.qualified} · <span className="text-amber-600">●</span> needs front-desk review {m.routes.needs_review} ·{" "}
              <span className="text-slate-500">●</span> not qualified {m.routes.not_qualified} · {m.pricingAsked} asked about price
            </p>

            <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">What the system costs to run</h2>
            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Total" value={inr(m.cost.total)} sub={`AI ${inr(m.cost.ai, 1)} + voice ${inr(m.cost.voice)}`} />
              <Tile label="Per call" value={inr(m.cost.perCall, 1)} sub={`${m.cost.minutes.toFixed(0)} call minutes`} />
              <Tile label="Per qualified lead" value={inr(m.cost.perQualified, 1)} />
              <Tile label="Per booked consultation" value={inr(m.cost.perBooking, 1)} sub={`${(m.cost.tokensIn / 1000).toFixed(0)}k tokens in · ${(m.cost.tokensOut / 1000).toFixed(0)}k out`} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Cal.com and email run on free tiers (₹0 here). The voice rate is a configured assumption (VAANI_INR_PER_MIN) until it matches the Vaani contract; test calls cost no voice.
            </p>

            <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">Calls</h2>
            <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="p-3">When</th><th className="p-3">Caller</th><th className="p-3">Enquiry</th><th className="p-3">Result</th><th className="p-3">Booked</th><th className="p-3 text-right">Cost</th></tr>
                </thead>
                <tbody>
                  {all.slice(0, 100).map((c: CallRecord) => (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="p-3 whitespace-nowrap">
                        <Link className="font-semibold underline-offset-2 hover:underline" href={`/studio/calls/${c.id}${kq}`}>
                          {new Date(c.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                        </Link>
                        {c.after_hours && <span className="ml-1 text-xs text-slate-400">night</span>}
                        {c.simulated && <span className="ml-1 rounded bg-violet-100 px-1 text-xs text-violet-700">test</span>}
                      </td>
                      <td className="p-3">{c.lead.name ?? "–"}<div className="text-xs text-slate-400">{c.caller_phone ?? ""}</div></td>
                      <td className="p-3 max-w-xs truncate text-slate-600">{[c.lead.project_type, c.lead.location].filter(Boolean).join(" · ") || c.summary || "–"}</td>
                      <td className="p-3">
                        {c.route ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROUTE[c.route].cls}`}>{ROUTE[c.route].label}</span> : <span className="text-xs text-slate-400">in progress</span>}
                        {c.outcome !== "open" && <span className="ml-1 text-xs font-semibold">{c.outcome}</span>}
                      </td>
                      <td className="p-3 text-slate-600">{c.booking && c.booking.status !== "failed" ? c.booking.label : "–"}</td>
                      <td className="p-3 text-right tabular-nums">{c.cost ? inr(c.cost.total_inr, 1) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}
