import Link from "next/link";

export default function StudioNav({ k, active }: { k: string | null; active: "dashboard" | "simulate" | "call" }) {
  const q = k ? `?key=${encodeURIComponent(k)}` : "";
  const tab = (on: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold ${on ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-200/60"}`;
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <p className="font-extrabold tracking-tight">
          Aangan Studio <span className="font-medium text-slate-500">· phone agent</span>
        </p>
        <nav className="flex gap-1">
          <Link href={`/studio${q}`} className={tab(active !== "simulate")}>Dashboard</Link>
          <Link href={`/studio/simulate${q}`} className={tab(active === "simulate")}>Try a call</Link>
        </nav>
      </div>
    </header>
  );
}

export function Locked() {
  return (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-xl font-extrabold">This page needs the studio key</h1>
      <p className="mt-2 text-sm text-slate-600">Open the link with <code>?key=…</code> (the value of STUDIO_KEY).</p>
    </div>
  );
}
