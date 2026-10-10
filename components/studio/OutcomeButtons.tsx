"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OutcomeButtons({ id, current, k }: { id: string; current: string; k: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function set(outcome: string) {
    setBusy(true);
    await fetch(`/api/studio/calls/${id}/outcome`, { method: "POST", headers: { "content-type": "application/json", ...(k ? { "x-studio-key": k } : {}) }, body: JSON.stringify({ outcome }) });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex gap-2">
      {(["open", "won", "lost"] as const).map((o) => (
        <button key={o} disabled={busy} onClick={() => set(o)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ring-1 ${current === o ? "bg-ink text-white ring-ink" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}>
          {o === "open" ? "Still open" : o}
        </button>
      ))}
    </div>
  );
}
