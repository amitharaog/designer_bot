import Link from "next/link";
import type { ReactNode } from "react";
import { dayNum, dayShort, monthShort, timeShort } from "@/lib/studio/format";
import type { CallRecord } from "@/lib/studio/types";

export function Chip({ children, tone = "stone" }: { children: ReactNode; tone?: "stone" | "clay" | "green" | "amber" }) {
  const tones = {
    stone: "bg-stone-100 text-stone-700 ring-stone-200",
    clay: "bg-clay-50 text-clay-700 ring-clay-100",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    amber: "bg-amber-50 text-amber-800 ring-amber-100",
  } as const;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}>{children}</span>;
}

export function DateBlock({ iso }: { iso: string }) {
  return (
    <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-ink py-3 text-white">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-300">{dayShort(iso)}</span>
      <span className="font-display text-3xl leading-none">{dayNum(iso)}</span>
      <span className="text-xs text-stone-300">{monthShort(iso)}</span>
      <span className="mt-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold">{timeShort(iso)}</span>
    </div>
  );
}

export function LeadChips({ c }: { c: CallRecord }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {c.lead.timeline && <Chip>⏱ {c.lead.timeline}</Chip>}
      {c.lead.decision_maker_note && <Chip>👥 {c.lead.decision_maker_note}</Chip>}
      {c.founder_decision === "forwarded" && <Chip tone="clay">Forwarded by founder</Chip>}
      {c.pricing_asked && <Chip tone="amber">Asked about price</Chip>}
      {c.after_hours && <Chip>After hours</Chip>}
      {c.simulated && <Chip>Test call</Chip>}
    </div>
  );
}

export function CallButton({ phone }: { phone: string | null }) {
  if (!phone) return null;
  return (
    <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white hover:bg-stone-700">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>
      Call
    </a>
  );
}

export function BriefLink({ id, kq }: { id: string; kq: string }) {
  return (
    <Link href={`/studio/calls/${id}${kq}`} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-clay-700 ring-1 ring-clay-100 hover:bg-clay-50">
      Open brief →
    </Link>
  );
}

export const projectLine = (c: CallRecord) => [c.lead.project_type, c.lead.size, c.lead.location].filter(Boolean).join(" · ") || "Project details in the brief";
