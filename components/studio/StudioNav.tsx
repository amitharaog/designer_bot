import Link from "next/link";

export default function StudioNav({ k, active }: { k: string | null; active: "dashboard" | "simulate" | "call" }) {
  const q = k ? `?key=${encodeURIComponent(k)}` : "";
  const tab = (on: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition ${on ? "bg-ink text-white" : "text-stone-600 hover:bg-stone-200/70"}`;
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href={`/studio${q}`} className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink font-display text-lg text-white">A</span>
          <span className="leading-tight">
            <span className="block font-display text-lg tracking-tight text-ink">Aangan Studio</span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Designer desk</span>
          </span>
        </Link>
        <nav className="flex gap-1">
          <Link href={`/studio${q}`} className={tab(active !== "simulate")}>Leads</Link>
          <Link href={`/studio/simulate${q}`} className={tab(active === "simulate")}>Try a call</Link>
        </nav>
      </div>
    </header>
  );
}

export function Locked() {
  return (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="font-display text-2xl">This page needs the studio key</h1>
      <p className="mt-2 text-sm text-stone-600">Open the link with <code>?key=…</code> (the value of STUDIO_KEY).</p>
    </div>
  );
}
