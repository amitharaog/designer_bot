"use client";

import { useRef, useState } from "react";

type Msg = { role: "agent" | "caller"; text: string };
const SCENARIOS = [
  { label: "Good lead", text: "Hi, I'm Priya Kulkarni. We just bought a 3BHK in Baner and want the whole flat designed and done, with execution. We'd like it ready in about three months. My husband and I are deciding together." },
  { label: "Asks price", text: "Hello, I have a 2BHK in Wakad. What do you charge per square foot? Just give me a ballpark." },
  { label: "Outside Pune", text: "Hi, I want my bungalow in Nashik redone completely, design and execution." },
  { label: "Needs it in 3 weeks", text: "I'm in Aundh, moving into my new flat in three weeks and need the whole interior done before that." },
  { label: "Just advice", text: "I just want some ideas on colours for my living room. Can someone come and advise? I'll do the work myself." },
];

export default function Simulator({ k }: { k: string | null }) {
  const [id, setId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("+91 98765 43210");
  const [ended, setEnded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  async function api(body: object) {
    const r = await fetch("/api/studio/sim", { method: "POST", headers: { "content-type": "application/json", ...(k ? { "x-studio-key": k } : {}) }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Request failed");
    return j;
  }
  const scroll = () => setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50);

  async function start() {
    setBusy(true); setErr(null);
    try {
      const j = await api({ action: "start", phone });
      setId(j.id); setMsgs([{ role: "agent", text: j.reply }]); setEnded(false);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  async function say(t: string) {
    if (!id || !t.trim() || busy) return;
    setBusy(true); setText(""); setErr(null);
    setMsgs((m) => [...m, { role: "caller", text: t }]); scroll();
    try {
      const j = await api({ action: "say", id, text: t });
      setMsgs((m) => [...m, { role: "agent", text: j.reply }]);
      if (j.end_call) setEnded(true);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false); scroll();
  }
  async function hangup() {
    if (!id) return;
    setBusy(true);
    try { await api({ action: "end", id }); } catch {}
    setEnded(true); setBusy(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-extrabold tracking-tight">Try a call</h1>
      <p className="mt-1 text-sm text-slate-600">Type what a caller would say. This runs the same engine as a real call (same rules, same handoff), without telephony. These show up as test calls.</p>
      {!id ? (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">Caller number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <button onClick={start} disabled={busy} className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Start call</button>
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            {msgs.map((m, i) => (
              <p key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "agent" ? "bg-sand" : "ml-auto bg-ink text-white"}`}>{m.text}</p>
            ))}
            {busy && <p className="text-xs text-slate-400">…</p>}
            <div ref={end} />
          </div>
          {ended ? (
            <p className="mt-3 text-sm font-semibold">
              Call ended. <a className="underline" href={`/studio/calls/${id}${k ? `?key=${encodeURIComponent(k)}` : ""}`}>See the handoff note</a> ·{" "}
              <button className="underline" onClick={() => { setId(null); setMsgs([]); }}>New call</button>
            </p>
          ) : (
            <>
              <form onSubmit={(e) => { e.preventDefault(); say(text); }} className="mt-3 flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Caller says…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" autoFocus />
                <button disabled={busy} className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Send</button>
                <button type="button" onClick={hangup} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">Hang up</button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                {SCENARIOS.map((s) => (
                  <button key={s.label} onClick={() => say(s.text)} disabled={busy} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">{s.label}</button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {err && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{err}</p>}
    </div>
  );
}
