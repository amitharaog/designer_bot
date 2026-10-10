import Link from "next/link";
import DeskShell, { PageHead } from "@/components/studio/DeskShell";
import { AttentionList, CallsTable, ConsultCard, Empty, ScheduleRow, Stat } from "@/components/studio/DeskViews";
import { BriefLink } from "@/components/studio/LeadParts";
import { Locked } from "@/components/studio/StudioNav";
import { studioKeyOk } from "@/lib/studio/auth";
import { deskHref, loadDesk, VIEWS, type DeskView } from "@/lib/studio/desk";
import { dateTime, longDate, timeShort } from "@/lib/studio/format";
import { projectLine } from "@/components/studio/LeadParts";

export default async function Desk(props: PageProps<"/studio">) {
  const q = await props.searchParams;
  const key = typeof q.key === "string" ? q.key : null;
  if (!studioKeyOk(key)) return <Locked />;
  const includeTest = q.test === "1";
  const view: DeskView = VIEWS.includes(q.view as DeskView) ? (q.view as DeskView) : "overview";
  const d = await loadDesk(includeTest);
  const kq = key ? `?key=${encodeURIComponent(key)}` : "";
  const href = (v: DeskView) => deskHref(key, includeTest, v);
  const next = d.upcoming[0];

  return (
    <DeskShell k={key} includeTest={includeTest} active={view} counts={d.counts}>
      {view === "overview" && (
        <>
          <PageHead eyebrow={d.today} title={`${d.greeting}.`} sub="Every lead arrives with what the caller already told us, so your first conversation starts at design." />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Next consultation" value={next ? timeShort(next.booking!.start) : "None yet"} hint={next ? `${longDate(next.booking!.start)} · ${next.lead.name ?? "Caller"}` : "Booked calls appear here"} href={href("upcoming")} />
            <Stat label="Upcoming" value={String(d.upcoming.length)} hint="consultations booked" href={href("upcoming")} />
            <Stat label="To schedule" value={String(d.toSchedule.length)} hint="qualified, need a call" href={href("schedule")} />
            <Stat label="New this week" value={String(d.newThisWeek)} hint="qualified leads" href={href("calls")} />
          </div>

          {d.attention.length > 0 && (
            <Link href={href("attention")} className="mt-4 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100">
              {d.attention.length} call{d.attention.length > 1 ? "s" : ""} need{d.attention.length > 1 ? "" : "s"} attention <span>Review →</span>
            </Link>
          )}

          <div className="mt-10 flex items-end justify-between">
            <h2 className="font-display text-2xl text-ink">Next up</h2>
            {d.upcoming.length > 2 && <Link href={href("upcoming")} className="text-sm font-semibold text-clay-700">All {d.upcoming.length} →</Link>}
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {d.upcoming.slice(0, 2).map((c) => <ConsultCard key={c.id} c={c} kq={kq} />)}
            {d.upcoming.length === 0 && <div className="md:col-span-2"><Empty>No consultations booked yet. When a caller qualifies, the agent books a slot and it shows up here.</Empty></div>}
          </div>

          <div className="mt-10 flex items-end justify-between">
            <h2 className="font-display text-2xl text-ink">Waiting to be scheduled</h2>
            {d.toSchedule.length > 3 && <Link href={href("schedule")} className="text-sm font-semibold text-clay-700">All {d.toSchedule.length} →</Link>}
          </div>
          {d.toSchedule.length === 0 ? (
            <div className="mt-3"><Empty>Nothing waiting. Every qualified caller has a slot.</Empty></div>
          ) : (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {d.toSchedule.slice(0, 3).map((c) => <ScheduleRow key={c.id} c={c} kq={kq} />)}
            </ul>
          )}
        </>
      )}

      {view === "upcoming" && (
        <>
          <PageHead title="Upcoming consultations" sub="Booked on your calendar, soonest first." />
          {d.upcoming.length === 0 ? <Empty>No consultations booked yet.</Empty> : (
            <div className="grid gap-4 md:grid-cols-2">{d.upcoming.map((c) => <ConsultCard key={c.id} c={c} kq={kq} />)}</div>
          )}
        </>
      )}

      {view === "schedule" && (
        <>
          <PageHead title="To schedule" sub="Qualified callers without a slot yet. Call them to fix a time." />
          {d.toSchedule.length === 0 ? <Empty>Nothing waiting. Every qualified caller has a slot.</Empty> : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">{d.toSchedule.map((c) => <ScheduleRow key={c.id} c={c} kq={kq} />)}</ul>
          )}
        </>
      )}

      {view === "past" && (
        <>
          <PageHead title="Past consultations" sub="Consultations whose time has passed." />
          {d.past.length === 0 ? <Empty>No past consultations yet.</Empty> : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {d.past.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <span className="min-w-0"><b className="font-display text-base text-ink">{c.lead.name ?? "Caller"}</b> <span className="text-stone-500">· {projectLine(c)}</span></span>
                  <span className="flex items-center gap-3 text-stone-500">{dateTime(c.booking!.start)} <BriefLink id={c.id} kq={kq} /></span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view === "calls" && (
        <>
          <PageHead title="All calls" sub="Every call that reached the desk and what happened to it. Rejections are reviewed by the founder in HubSpot." />
          {d.all.length === 0 ? <Empty>No calls yet.</Empty> : <CallsTable calls={d.all.slice(0, 100)} kq={kq} />}
        </>
      )}

      {view === "attention" && (
        <>
          <PageHead title="Needs attention" sub="Calls the AI couldn't process, or leads whose booking or email failed. Retry re-runs them; the transcript is saved." />
          {d.attention.length === 0 ? <Empty>All clear. Nothing needs attention.</Empty> : <AttentionList calls={d.attention} kq={kq} k={key} />}
        </>
      )}
    </DeskShell>
  );
}
