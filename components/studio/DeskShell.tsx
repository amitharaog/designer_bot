import Link from "next/link";
import type { ReactNode } from "react";
import { deskHref, type DeskView } from "@/lib/studio/desk";

const ICONS: Record<DeskView, ReactNode> = {
  overview: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  upcoming: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>,
  schedule: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  past: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  calls: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />,
  attention: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
};
const LABELS: Record<DeskView, string> = {
  overview: "Overview",
  upcoming: "Upcoming",
  schedule: "To schedule",
  past: "Past consultations",
  calls: "All calls",
  attention: "Needs attention",
};
const GROUPS: { title: string; items: DeskView[] }[] = [
  { title: "Today", items: ["overview"] },
  { title: "Consultations", items: ["upcoming", "schedule", "past"] },
  { title: "Calls", items: ["calls", "attention"] },
];

function Icon({ v }: { v: DeskView }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[v]}
    </svg>
  );
}

export default function DeskShell({
  k,
  includeTest,
  active,
  counts,
  children,
}: {
  k: string | null;
  includeTest: boolean;
  active: DeskView | null;
  counts: Record<DeskView, number>;
  children: ReactNode;
}) {
  const item = (v: DeskView) => {
    const on = active === v;
    const n = counts[v];
    const alert = v === "attention" && n > 0;
    return (
      <Link
        key={v}
        href={deskHref(k, includeTest, v)}
        className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
          on ? "bg-ink text-white" : "text-stone-600 hover:bg-white hover:text-ink"
        }`}
      >
        <Icon v={v} />
        <span className="flex-1 truncate">{LABELS[v]}</span>
        {v !== "overview" && n > 0 && (
          <span
            className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums ${
              alert ? "bg-amber-400 text-amber-950" : on ? "bg-white/15 text-white" : "bg-stone-200/80 text-stone-600"
            }`}
          >
            {n}
          </span>
        )}
      </Link>
    );
  };
  const testHref = `${deskHref(k, !includeTest, active ?? "overview")}`;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-sand/80 px-4 py-5 lg:flex">
        <Link href={deskHref(k, includeTest)} className="flex items-center gap-3 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink font-display text-lg text-white">A</span>
          <span className="leading-tight">
            <span className="block font-display text-lg tracking-tight text-ink">Aangan Studio</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">Designer desk</span>
          </span>
        </Link>
        <nav className="mt-8 flex-1 space-y-6">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">{g.title}</p>
              <div className="space-y-0.5">{g.items.map(item)}</div>
            </div>
          ))}
        </nav>
        <Link href={testHref} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-stone-500 hover:bg-white">
          Include test calls
          <span className={`relative h-4 w-7 rounded-full transition ${includeTest ? "bg-ink" : "bg-stone-300"}`}>
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${includeTest ? "left-3.5" : "left-0.5"}`} />
          </span>
        </Link>
      </aside>

      {/* Top bar + scrollable tabs (mobile / tablet) */}
      <div className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink font-display text-white">A</span>
          <span className="font-display text-lg text-ink">Aangan Studio</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {GROUPS.flatMap((g) => g.items).map((v) => (
            <Link
              key={v}
              href={deskHref(k, includeTest, v)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${active === v ? "bg-ink text-white" : "bg-stone-100 text-stone-600"}`}
            >
              {LABELS[v]}
              {v !== "overview" && counts[v] > 0 ? ` ${counts[v]}` : ""}
            </Link>
          ))}
        </nav>
      </div>

      <main className="min-w-0 px-4 pb-24 pt-6 sm:px-8 lg:pt-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

export function PageHead({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-sm font-semibold text-clay-600">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-3xl tracking-tight text-ink sm:text-4xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-stone-600">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
