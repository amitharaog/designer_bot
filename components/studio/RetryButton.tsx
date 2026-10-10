"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RetryButton({ id, k }: { id: string; k: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<string | null>(null);
  async function retry() {
    setState("Running…");
    const r = await fetch(`/api/studio/calls/${id}/retry`, { method: "POST", headers: k ? { "x-studio-key": k } : {} });
    const j = await r.json().catch(() => ({}));
    setState(r.ok ? `Done: ${String(j.route ?? "").replace("_", " ")}` : `Failed: ${j.error ?? r.status}`);
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={retry} disabled={state === "Running…"} className="rounded-lg bg-ink px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
        Retry
      </button>
      {state && <span className="text-xs text-slate-600">{state}</span>}
    </span>
  );
}
