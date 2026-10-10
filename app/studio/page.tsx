import Link from "next/link";
import StudioNav, { Locked } from "@/components/studio/StudioNav";
import { studioKeyOk } from "@/lib/studio/auth";
import { listCalls } from "@/lib/studio/store";
import type { CallRecord } from "@/lib/studio/types";

const isLead = (c: CallRecord) => c.finalized && (c.route === "qualified" || c.founder_decision === "forwarded");
const booked = (c: CallRecord) => !!c.booking && c.booking.status !== "failed";

export default async function Leads(props: PageProps<"/studio">) {
  const q = await props.searchParams;
  const key = typeof q.key === "string" ? q.key : null;
  if (!studioKeyOk(key)) return <Locked />;
  const includeTest = q.test === "1";
  const leads = (await listCalls()).filter((c) => isLead(c) && (includeTest || !c.simulated)).slice(0, 100);
  const kq = key ? `?key=${encodeURIComponent(key)}` : "";
  const testHref = `/studio?${new URLSearchParams({ ...(key ? { key } : {}), ...(includeTest ? {} : { test: "1" }) })}`;

  return (
    <>
      <StudioNav k={key} active="dashboard" />
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Your leads</h1>
            <p className="text-sm text-slate-500">Everything the caller already told us, so your first call starts at design. Cost and conversion reports live in HubSpot.</p>
          </div>
          <Link href={testHref} className={`rounded-full px-3 py-1 text-xs font-semibold ${includeTest ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            {includeTest ? "Test calls shown" : "Show test calls"}
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"><p className="text-xs font-semibold uppercase text-slate-500">Booked</p><p className="mt-1 text-2xl font-extrabold">{leads.filter(booked).length}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"><p className="text-xs font-semibold uppercase text-slate-500">To schedule</p><p className="mt-1 text-2xl font-extrabold">{leads.filter((c) => !booked(c)).length}</p></div>
        </div>

        {leads.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
            No leads yet. <Link className="font-semibold underline" href={`/studio/simulate${kq}`}>Try a call</Link> to see how one looks.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">When</th><th className="p-3">Caller</th><th className="p-3">Enquiry</th><th className="p-3">Consultation</th></tr></thead>
              <tbody>
                {leads.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-3 whitespace-nowrap">
                      <Link className="font-semibold hover:underline" href={`/studio/calls/${c.id}${kq}`}>
                        {new Date(c.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      </Link>
                      {c.simulated && <span className="ml-1 rounded bg-violet-100 px-1 text-xs text-violet-700">test</span>}
                    </td>
                    <td className="p-3">{c.lead.name ?? "–"}<div className="text-xs text-slate-400">{c.caller_phone ?? ""}</div></td>
                    <td className="max-w-xs truncate p-3 text-slate-600">{[c.lead.project_type, c.lead.location].filter(Boolean).join(" · ") || c.summary || "–"}</td>
                    <td className="p-3">
                      {booked(c) ? <span className="text-emerald-700">{c.booking!.label}</span> : <span className="font-semibold text-amber-700">Call to schedule</span>}
                      {c.founder_decision === "forwarded" && <span className="ml-1 text-xs text-slate-500">(forwarded by founder)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
