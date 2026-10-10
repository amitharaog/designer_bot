import Link from "next/link";
import { notFound } from "next/navigation";
import OutcomeButtons from "@/components/studio/OutcomeButtons";
import StudioNav, { Locked } from "@/components/studio/StudioNav";
import { studioKeyOk } from "@/lib/studio/auth";
import { getCall } from "@/lib/studio/store";
import { CRITERIA, CRITERIA_LABEL } from "@/lib/studio/types";

export default async function CallPage(props: PageProps<"/studio/calls/[id]">) {
  const [{ id }, q] = await Promise.all([props.params, props.searchParams]);
  const key = typeof q.key === "string" ? q.key : null;
  if (!studioKeyOk(key)) return <Locked />;
  const c = await getCall(id);
  if (!c) notFound();
  const kq = key ? `?key=${encodeURIComponent(key)}` : "";
  const mark = { pass: "✔", fail: "✘", unclear: "?" } as const;
  return (
    <>
      <StudioNav k={key} active="call" />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-6">
        <Link href={`/studio${kq}`} className="text-sm font-semibold text-slate-500 hover:underline">← All calls</Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{c.lead.name ?? "Unknown caller"} <span className="text-base font-medium text-slate-500">{c.caller_phone}</span></h1>
        <p className="text-sm text-slate-600">
          {c.route ? `${c.route.replace("_", " ")} — ${c.route_reason}` : "Call in progress"}
          {c.simulated && " · test call"}
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Handoff</h2>
            <p className="mt-2 text-sm">{c.summary || "–"}</p>
            <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
              {([["Location", c.lead.location], ["Project", [c.lead.project_type, c.lead.size].filter(Boolean).join(", ")], ["Timeline", c.lead.timeline], ["Budget said", c.lead.budget_mentioned], ["Decision-maker", c.lead.decision_maker_note], ["Booked", c.booking ? `${c.booking.label} (${c.booking.status})` : null], ["Email", c.handoff ? `${c.handoff.status}${c.handoff.to.length ? ` → ${c.handoff.to.join(", ")}` : ""}${c.handoff.error ? ` — ${c.handoff.error}` : ""}` : null]] as [string, string | null | undefined][]).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd>{v || "–"}</dd></div>
              ))}
            </dl>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Rubric</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {CRITERIA.map((k) => (
                <li key={k}><span className={`inline-block w-5 font-bold ${c.criteria[k] === "pass" ? "text-emerald-600" : c.criteria[k] === "fail" ? "text-rose-600" : "text-amber-600"}`}>{mark[c.criteria[k]]}</span>{CRITERIA_LABEL[k]}</li>
              ))}
            </ul>
            <h2 className="mt-4 text-sm font-bold uppercase tracking-wide text-slate-500">Outcome</h2>
            <div className="mt-2"><OutcomeButtons id={c.id} current={c.outcome} k={key} /></div>
            <p className="mt-4 text-xs text-slate-500">
              {c.cost ? `Cost ₹${c.cost.total_inr.toFixed(2)} (AI ₹${c.cost.ai_inr.toFixed(2)}, voice ₹${c.cost.voice_inr.toFixed(2)}) · ${c.usage.input_tokens + c.usage.output_tokens} tokens · ${c.duration_s}s` : ""}
            </p>
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Transcript</h2>
          <div className="mt-3 space-y-2">
            {c.transcript.map((t, i) => (
              <p key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${t.role === "agent" ? "bg-slate-100" : "ml-auto bg-brand-600 text-white"}`}>{t.text}</p>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
