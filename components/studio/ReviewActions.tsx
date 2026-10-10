"use client";

import { useState } from "react";

export default function ReviewActions({ id, token, initial }: { id: string; token: string; initial: string | null }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function decide(decision: "forward" | "keep") {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/review/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, t: token }) });
    const j = await r.json();
    if (r.ok) setState(j.founder_decision); else setErr(j.error ?? "Failed");
    setBusy(false);
  }

  if (state === "forwarded") return <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Pushed to the designers. They have the note and transcript.</p>;
  return (
    <div>
      {state === "kept_rejected" && <p className="mb-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">Marked as rejected. You can still push it to a designer.</p>}
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => decide("forward")} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Push to designer</button>
        {state !== "kept_rejected" && (
          <button disabled={busy} onClick={() => decide("keep")} className="rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-300 disabled:opacity-50">Keep rejected</button>
        )}
      </div>
      {err && <p className="mt-2 text-sm text-rose-700">{err}</p>}
    </div>
  );
}
