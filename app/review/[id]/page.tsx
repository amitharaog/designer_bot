import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReviewActions from "@/components/studio/ReviewActions";
import { reviewTokenOk } from "@/lib/studio/review";
import { getCall } from "@/lib/studio/store";
import { CRITERIA, CRITERIA_LABEL } from "@/lib/studio/types";

export const metadata: Metadata = { title: "Review a call · Aangan Studio", robots: { index: false } };

export default async function ReviewPage(props: PageProps<"/review/[id]">) {
  const [{ id }, q] = await Promise.all([props.params, props.searchParams]);
  const t = typeof q.t === "string" ? q.t : null;
  if (!reviewTokenOk(id, t)) {
    return <div className="mx-auto max-w-md p-10 text-center"><h1 className="text-xl font-extrabold">This review link isn&apos;t valid</h1><p className="mt-2 text-sm text-slate-600">Open it from the email or HubSpot deal it came from.</p></div>;
  }
  const c = await getCall(id);
  if (!c) notFound();
  const mark = { pass: "✔", fail: "✘", unclear: "?" } as const;
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <p className="text-sm font-semibold text-amber-700">AI rejected this call. You decide.</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{c.lead.name ?? "Unknown caller"} <span className="text-base font-medium text-slate-500">{c.caller_phone}</span></h1>
      <p className="mt-1 text-sm text-slate-600">{c.route_reason}</p>
      {c.fail_evidence && (
        <blockquote className="mt-3 rounded-xl border-l-4 border-amber-400 bg-amber-50 p-3 text-sm">
          <span className="font-semibold">Caller said:</span> “{c.fail_evidence}”
        </blockquote>
      )}
      <div className="mt-5"><ReviewActions id={c.id} token={t!} initial={c.founder_decision} /></div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">What the AI understood</h2>
        <p className="mt-2 text-sm">{c.summary || "–"}</p>
        <ul className="mt-3 space-y-1 text-sm">
          {CRITERIA.map((k) => (
            <li key={k}><span className={`inline-block w-5 font-bold ${c.criteria[k] === "pass" ? "text-emerald-600" : c.criteria[k] === "fail" ? "text-rose-600" : "text-amber-600"}`}>{mark[c.criteria[k]]}</span>{CRITERIA_LABEL[k]}</li>
          ))}
        </ul>
      </section>
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Full transcript</h2>
        <div className="mt-3 space-y-2">
          {c.transcript.map((m, i) => (
            <p key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "agent" ? "bg-slate-100" : "ml-auto bg-brand-600 text-white"}`}>{m.text}</p>
          ))}
        </div>
      </section>
    </main>
  );
}
