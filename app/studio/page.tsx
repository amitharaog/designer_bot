import Link from "next/link";
import { BriefLink, CallButton, Chip, DateBlock, LeadChips, projectLine } from "@/components/studio/LeadParts";
import RetryButton from "@/components/studio/RetryButton";
import StudioNav, { Locked } from "@/components/studio/StudioNav";
import { studioKeyOk } from "@/lib/studio/auth";
import { dateTime, deskView, longDate, timeShort } from "@/lib/studio/format";
import { listCalls } from "@/lib/studio/store";
import type { CallRecord } from "@/lib/studio/types";

const isLead = (c: CallRecord) => c.finalized && (c.route === "qualified" || c.founder_decision === "forwarded");

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-2 font-display text-3xl leading-tight text-ink">{value}</p>
      {hint && <p className="mt-1 line-clamp-2 text-sm text-stone-500">{hint}</p>}
    </div>
  );
}

function SectionTitle({ title, count, children }: { title: string; count: number; children?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-10 flex items-end justify-between gap-3">
      <h2 className="font-display text-2xl text-ink">
        {title} <span className="align-middle text-base font-sans font-semibold text-stone-400">{count}</span>
      </h2>
      {children}
    </div>
  );
}

export default async function Desk(props: PageProps<"/studio">) {
  const q = await props.searchParams;
  const key = typeof q.key === "string" ? q.key : null;
  if (!studioKeyOk(key)) return <Locked />;
  const includeTest = q.test === "1";
  const all = await listCalls();
  const leads = all.filter((c) => isLead(c) && (includeTest || !c.simulated));
  const stuck = all.filter((c) => c.finalized && c.usage.errors > 0 && c.transcript.some((t) => t.role === "caller")).slice(0, 20);
  const { upcoming, past, toSchedule, newThisWeek, greeting, today } = deskView(leads);
  // Every call, whatever happened to it, so nothing that came in is invisible (designers only act on leads above).
  const recent = all.filter((c) => includeTest || !c.simulated).slice(0, 15);
  const ROUTE: Record<string, { label: string; tone: "green" | "clay" | "amber" | "stone" }> = {
    qualified: { label: "Qualified", tone: "green" },
    needs_review: { label: "Needs review", tone: "amber" },
    not_qualified: { label: "Not a fit", tone: "stone" },
  };
  const next = upcoming[0];
  const kq = key ? `?key=${encodeURIComponent(key)}` : "";
  const testHref = `/studio?${new URLSearchParams({ ...(key ? { key } : {}), ...(includeTest ? {} : { test: "1" }) })}`;

  return (
    <>
      <StudioNav k={key} active="dashboard" />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-clay-600">{today}</p>
            <h1 className="mt-1 font-display text-4xl tracking-tight text-ink sm:text-5xl">{greeting}.</h1>
            <p className="mt-2 max-w-xl text-stone-600">Every lead arrives with what the caller already told us, so your first conversation starts at design.</p>
          </div>
          <Link href={testHref} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ${includeTest ? "bg-ink text-white ring-ink" : "bg-white text-stone-600 ring-line hover:bg-stone-50"}`}>
            {includeTest ? "✓ Including test calls" : "Include test calls"}
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Next consultation" value={next ? timeShort(next.booking!.start) : "None yet"} hint={next ? `${longDate(next.booking!.start)} · ${next.lead.name ?? "Caller"}` : "Booked calls will appear here"} />
          <Stat label="Upcoming" value={String(upcoming.length)} hint="consultations booked" />
          <Stat label="To schedule" value={String(toSchedule.length)} hint="qualified, need a call" />
          <Stat label="New this week" value={String(newThisWeek)} hint="qualified leads" />
        </div>

        <SectionTitle title="Upcoming consultations" count={upcoming.length} />
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-10 text-center text-stone-500">
            No consultations booked yet. When a caller qualifies, the agent books a slot and it shows up here.{" "}
            <Link className="font-semibold text-clay-700 underline" href={`/studio/simulate${kq}`}>Try a call</Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((c) => (
              <article key={c.id} className="flex gap-4 rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-18px_rgba(28,25,23,0.35)]">
                <DateBlock iso={c.booking!.start} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-xl text-ink">{c.lead.name ?? "Unknown caller"}</h3>
                      <p className="truncate text-sm text-stone-600">{projectLine(c)}</p>
                    </div>
                    {c.booking?.status === "dry_run" && <span className="shrink-0 text-[11px] font-semibold uppercase text-stone-400">demo slot</span>}
                  </div>
                  {c.summary && <p className="mt-2 line-clamp-2 text-sm text-stone-700">{c.summary}</p>}
                  <div className="mt-3"><LeadChips c={c} /></div>
                  <div className="mt-4 flex items-center gap-2">
                    <CallButton phone={c.caller_phone} />
                    <BriefLink id={c.id} kq={kq} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <SectionTitle title="To schedule" count={toSchedule.length} />
        {toSchedule.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white/60 p-6 text-center text-sm text-stone-500">Nothing waiting. Every qualified caller has a slot.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {toSchedule.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-4 border-l-4 border-l-clay-500 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg text-ink">{c.lead.name ?? "Unknown caller"} <span className="font-sans text-sm text-stone-500">{c.caller_phone}</span></p>
                  <p className="truncate text-sm text-stone-600">{projectLine(c)}</p>
                  <div className="mt-2"><LeadChips c={c} /></div>
                </div>
                <span className="text-xs text-stone-500">Called {dateTime(c.started_at)}</span>
                <div className="flex items-center gap-2">
                  <CallButton phone={c.caller_phone} />
                  <BriefLink id={c.id} kq={kq} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {past.length > 0 && (
          <details className="mt-10 rounded-2xl border border-line bg-white p-4">
            <summary className="cursor-pointer font-display text-lg text-ink">Past consultations <span className="font-sans text-sm text-stone-400">{past.length}</span></summary>
            <ul className="mt-3 divide-y divide-line">
              {past.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span><b>{c.lead.name ?? "Caller"}</b> · {projectLine(c)}</span>
                  <span className="flex items-center gap-3 text-stone-500">{dateTime(c.booking!.start)} <BriefLink id={c.id} kq={kq} /></span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <details className="mt-10 rounded-2xl border border-line bg-white p-4" open={leads.length === 0}>
          <summary className="cursor-pointer font-display text-lg text-ink">All recent calls <span className="font-sans text-sm text-stone-400">{recent.length}</span></summary>
          <p className="mt-1 text-xs text-stone-500">Every call that reached the app, including ones that didn&apos;t qualify. Rejections are reviewed by the founder in HubSpot.</p>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No calls have reached the app yet. Check the Vaani webhook and Vercel logs.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {recent.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <b className="text-ink">{c.lead.name ?? c.caller_phone ?? "Unknown caller"}</b>
                    <span className="text-stone-500"> · {dateTime(c.started_at)}</span>
                    <span className="block truncate text-xs text-stone-500">{c.route_reason ?? (c.finalized ? "" : "Call in progress")}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {c.route ? <Chip tone={ROUTE[c.route].tone}>{ROUTE[c.route].label}</Chip> : <Chip>In progress</Chip>}
                    {c.simulated && <Chip>Test</Chip>}
                    <BriefLink id={c.id} kq={kq} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>

        {stuck.length > 0 && (
          <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <p className="text-sm font-bold text-amber-900">Calls the AI couldn&apos;t process ({stuck.length})</p>
            <p className="text-xs text-amber-800">Re-run the analysis; the transcript is saved.</p>
            <ul className="mt-3 space-y-2">
              {stuck.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{dateTime(c.started_at)} · {c.caller_phone ?? "unknown number"}</span>
                  <RetryButton id={c.id} k={key} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
