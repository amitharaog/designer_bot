import Link from "next/link";
import { notFound } from "next/navigation";
import { CallButton, Chip, DateBlock, LeadChips } from "@/components/studio/LeadParts";
import RetryButton from "@/components/studio/RetryButton";
import StudioNav, { Locked } from "@/components/studio/StudioNav";
import { studioKeyOk } from "@/lib/studio/auth";
import { cleanCall } from "@/lib/studio/clean";
import { dateTime, isBooked, longDate, timeShort } from "@/lib/studio/format";
import { getCall } from "@/lib/studio/store";
import { CRITERIA, CRITERIA_LABEL } from "@/lib/studio/types";

export default async function Brief(props: PageProps<"/studio/calls/[id]">) {
  const [{ id }, q] = await Promise.all([props.params, props.searchParams]);
  const key = typeof q.key === "string" ? q.key : null;
  if (!studioKeyOk(key)) return <Locked />;
  const raw = await getCall(id);
  if (!raw) notFound();
  const c = cleanCall(raw);
  const kq = key ? `?key=${encodeURIComponent(key)}` : "";
  const booked = isBooked(c);
  const l = c.lead;
  const details: [string, string | null | undefined][] = [
    ["Location", l.location],
    ["Space", [l.project_type, l.size].filter(Boolean).join(", ")],
    ["Timeline", l.timeline],
    ["Decision-maker", l.decision_maker_note],
    ["Budget mentioned", l.budget_mentioned ?? "Not mentioned (we don't ask)"],
    ["Email", l.email],
    ["Notes", l.scope_notes],
  ];
  const status = booked ? (
    <Chip tone="green">Consultation booked</Chip>
  ) : c.route === "qualified" || c.founder_decision === "forwarded" ? (
    <Chip tone="clay">To schedule</Chip>
  ) : c.route === "not_qualified" ? (
    <Chip>Not a fit (founder reviews)</Chip>
  ) : (
    <Chip tone="amber">Needs review</Chip>
  );
  const dot = { pass: "bg-emerald-500", fail: "bg-rose-500", unclear: "bg-amber-400" } as const;
  const word = { pass: "Yes", fail: "No", unclear: "Not confirmed" } as const;

  return (
    <>
      <StudioNav k={key} active="call" />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6">
        <Link href={`/studio${kq}`} className="text-sm font-semibold text-stone-500 hover:text-ink">← Back to leads</Link>

        <section className="mt-4 flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-white p-5">
          {booked && <DateBlock iso={c.booking!.start} />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">{status}{c.simulated && <Chip>Test call</Chip>}</div>
            <h1 className="mt-2 font-display text-3xl tracking-tight text-ink sm:text-4xl">{l.name ?? "Unknown caller"}</h1>
            <p className="mt-1 text-stone-600">
              {[l.project_type, l.location].filter(Boolean).join(" in ") || "Project details below"}
              {booked && <> · <b className="text-ink">{longDate(c.booking!.start)}, {timeShort(c.booking!.start)}</b>{c.booking!.designer ? ` with ${c.booking!.designer}` : ""}</>}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <CallButton phone={c.caller_phone} />
            <span className="text-sm text-stone-500">{c.caller_phone}</span>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <section className="rounded-2xl border border-line bg-white p-6 lg:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-clay-600">Design brief</p>
            <p className="mt-2 font-display text-xl leading-relaxed text-ink">{c.summary || "No summary for this call."}</p>
            <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {details.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="border-t border-line pt-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{k}</dt>
                  <dd className="mt-1 text-[15px] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {c.caller_questions.length > 0 && (
              <div className="mt-6 rounded-xl bg-sand p-4">
                <p className="text-sm font-bold text-ink">Be ready for</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">{c.caller_questions.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
            {c.pricing_asked && (
              <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                <b>Pricing:</b> the caller asked. They were told it depends on site, materials and scope, and that you&apos;ll walk them through it at the consultation. No figure was given.
              </p>
            )}
            <div className="mt-5"><LeadChips c={c} /></div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-line bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Fit check</p>
              <ul className="mt-3 space-y-2.5">
                {CRITERIA.map((k) => (
                  <li key={k} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${dot[c.criteria[k]]}`} />{CRITERIA_LABEL[k]}</span>
                    <span className="text-stone-500">{word[c.criteria[k]]}</span>
                  </li>
                ))}
              </ul>
              {c.fail_evidence && <p className="mt-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-600">Caller said: “{c.fail_evidence}”</p>}
            </section>
            <section className="rounded-2xl border border-line bg-white p-5 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Call</p>
              <dl className="mt-3 space-y-1.5 text-stone-700">
                <div className="flex justify-between"><dt>Received</dt><dd>{dateTime(c.started_at)}{c.after_hours ? " (after hours)" : ""}</dd></div>
                {c.duration_s ? <div className="flex justify-between"><dt>Length</dt><dd>{Math.max(1, Math.round(c.duration_s / 60))} min</dd></div> : null}
                {c.handoff?.status && c.handoff.status !== "not_needed" && <div className="flex justify-between"><dt>Designer email</dt><dd>{c.handoff.status.replace("_", " ")}</dd></div>}
              </dl>
              {c.usage.errors > 0 && <div className="mt-3"><RetryButton id={c.id} k={key} /></div>}
            </section>
          </aside>
        </div>

        <section className="mt-5 rounded-2xl border border-line bg-white p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Transcript</p>
          <div className="mt-4 space-y-2.5">
            {c.transcript.map((t, i) => (
              <div key={i} className={`flex ${t.role === "agent" ? "" : "justify-end"}`}>
                <p className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${t.role === "agent" ? "bg-sand text-ink" : "bg-ink text-white"}`}>
                  <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider opacity-60">{t.role === "agent" ? "Agent" : "Caller"}</span>
                  {t.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
