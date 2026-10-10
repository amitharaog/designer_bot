import Link from "next/link";
import { BriefLink, CallButton, Chip, DateBlock, LeadChips, projectLine } from "@/components/studio/LeadParts";
import RetryButton from "@/components/studio/RetryButton";
import { dateTime, longDate, timeShort } from "@/lib/studio/format";
import type { CallRecord } from "@/lib/studio/types";

export function Stat({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-2 font-display text-3xl leading-tight text-ink">{value}</p>
      {hint && <p className="mt-1 line-clamp-2 text-sm text-stone-500">{hint}</p>}
    </>
  );
  const cls = "block rounded-2xl border border-line bg-white p-5";
  return href ? <Link href={href} className={`${cls} transition hover:border-stone-300`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line bg-white/60 p-10 text-center text-sm text-stone-500">{children}</div>;
}

export function ConsultCard({ c, kq }: { c: CallRecord; kq: string }) {
  return (
    <article className="flex gap-4 rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-18px_rgba(28,25,23,0.35)]">
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
  );
}

export function ScheduleRow({ c, kq }: { c: CallRecord; kq: string }) {
  return (
    <li className="flex flex-wrap items-center gap-4 border-l-4 border-l-clay-500 p-4">
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
  );
}

const ROUTE: Record<string, { label: string; tone: "green" | "clay" | "amber" | "stone" }> = {
  qualified: { label: "Qualified", tone: "green" },
  needs_review: { label: "Needs review", tone: "amber" },
  not_qualified: { label: "Not a fit", tone: "stone" },
};

export function CallsTable({ calls, kq }: { calls: CallRecord[]; kq: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-sand/60 text-[11px] uppercase tracking-[0.14em] text-stone-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Caller</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">Project</th>
            <th className="px-4 py-3 font-semibold">Outcome</th>
            <th className="hidden px-4 py-3 font-semibold sm:table-cell">Received</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {calls.map((c) => (
            <tr key={c.id} className="align-middle hover:bg-sand/40">
              <td className="px-4 py-3">
                <p className="font-semibold text-ink">{c.lead.name ?? "Unknown caller"}</p>
                <p className="text-xs text-stone-500">{c.caller_phone}</p>
              </td>
              <td className="hidden max-w-[260px] truncate px-4 py-3 text-stone-600 md:table-cell">{projectLine(c)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {c.route ? <Chip tone={ROUTE[c.route].tone}>{ROUTE[c.route].label}</Chip> : <Chip>In progress</Chip>}
                  {c.booking && c.booking.status !== "failed" && <Chip tone="green">Booked</Chip>}
                  {c.simulated && <Chip>Test</Chip>}
                </div>
              </td>
              <td className="hidden whitespace-nowrap px-4 py-3 text-stone-500 sm:table-cell">{dateTime(c.started_at)}</td>
              <td className="px-4 py-3 text-right"><BriefLink id={c.id} kq={kq} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AttentionList({ calls, kq, k }: { calls: CallRecord[]; kq: string; k: string | null }) {
  const why = (c: CallRecord) =>
    c.usage.errors > 0 ? "The AI couldn't process this call" : c.booking?.status === "failed" ? "Calendar booking failed" : "Designer email failed";
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-amber-200 bg-white">
      {calls.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-4 border-l-4 border-l-amber-400 p-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{c.lead.name ?? c.caller_phone ?? "Unknown caller"} <span className="text-sm font-normal text-stone-500">· {dateTime(c.started_at)}</span></p>
            <p className="text-sm text-amber-800">{why(c)}</p>
            {(c.handoff?.error || c.booking?.error) && <p className="mt-1 truncate text-xs text-stone-500">{c.handoff?.error ?? c.booking?.error}</p>}
          </div>
          <div className="flex items-center gap-2">
            <RetryButton id={c.id} k={k} />
            <BriefLink id={c.id} kq={kq} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function NextUp({ c }: { c: CallRecord | undefined }) {
  return c ? `${longDate(c.booking!.start)} · ${timeShort(c.booking!.start)}` : "";
}
