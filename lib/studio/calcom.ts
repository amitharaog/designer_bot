import "server-only";
import { cfg } from "./config";
import type { Booking, Lead, Slot } from "./types";

const fmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: cfg.tz,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
export const slotLabel = (iso: string) => fmt.format(new Date(iso));

const live = () => !!(cfg.cal.key() && cfg.cal.eventTypeId());

/** Up to 3 slots on different days (earliest first). Live from Cal.com, or clearly-labelled demo slots. */
export async function getSlots(): Promise<{ slots: Slot[]; demo: boolean }> {
  if (!live()) return { slots: demoSlots(), demo: true };
  const start = new Date(Date.now() + 4 * 3600_000);
  const end = new Date(Date.now() + 10 * 24 * 3600_000);
  const url = new URL("https://api.cal.com/v2/slots");
  url.searchParams.set("eventTypeId", cfg.cal.eventTypeId()!);
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", end.toISOString());
  url.searchParams.set("timeZone", cfg.tz);
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${cfg.cal.key()}`, "cal-api-version": "2024-09-04" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Cal.com slots ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const days = Object.keys(body?.data ?? {}).sort();
  const slots: Slot[] = [];
  for (const d of days) {
    const first = body.data[d]?.[0]?.start;
    if (first) slots.push({ start: first, label: slotLabel(first) });
    if (slots.length === 3) break;
  }
  return { slots, demo: false };
}

function demoSlots(): Slot[] {
  const out: Slot[] = [];
  const d = new Date();
  while (out.length < 3) {
    d.setDate(d.getDate() + 1);
    const ist = new Date(d.getTime() + 5.5 * 3600_000);
    if (ist.getUTCDay() === 0) continue; // skip Sundays
    const iso = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 5, 30)).toISOString(); // 11:00 IST
    out.push({ start: iso, label: slotLabel(iso) });
  }
  return out;
}

export async function bookSlot(slot: Slot, lead: Lead, phone: string | null): Promise<Booking> {
  const base = { start: slot.start, label: slot.label };
  if (!live()) return { ...base, status: "dry_run" };
  const email = lead.email || cfg.cal.fallbackEmail();
  if (!email) return { ...base, status: "failed", error: "No attendee email: caller gave none and CAL_FALLBACK_EMAIL is unset" };
  try {
    const res = await fetch("https://api.cal.com/v2/bookings", {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.cal.key()}`, "cal-api-version": "2024-08-13", "content-type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        start: slot.start,
        eventTypeId: Number(cfg.cal.eventTypeId()),
        attendee: { name: lead.name || "Phone enquiry", email, timeZone: cfg.tz, ...(phone ? { phoneNumber: phone } : {}) },
        metadata: { source: "aangan-phone-agent" },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ...base, status: "failed", error: `Cal.com ${res.status}: ${JSON.stringify(body).slice(0, 200)}` };
    const d = body?.data ?? {};
    return { ...base, status: "booked", uid: d.uid ?? null, designer: d.hosts?.[0]?.name ?? d.organizer?.name ?? null };
  } catch (e) {
    return { ...base, status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
