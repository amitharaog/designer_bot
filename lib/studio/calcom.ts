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

const CAL_API = process.env.CAL_BASE_URL ?? "https://api.cal.com/v2";

const live = () => !!(cfg.cal.key() && cfg.cal.eventTypeId());

type CalEventType = { id: number | string; slug?: string; title?: string };
let resolved: { eventTypeId: number } | null = null;

/**
 * CAL_EVENT_TYPE_ID should be the numeric id, but Cal.com's UI mostly shows slugs and links. If it isn't a number,
 * look the event type up with the API key (match by slug, then a "consult" title, then the only one) and cache it.
 */
async function eventRef(): Promise<{ eventTypeId: number }> {
  const v = cfg.cal.eventTypeId()!.trim();
  if (/^\d+$/.test(v)) return { eventTypeId: Number(v) };
  if (resolved) return resolved;
  const res = await fetch(`${CAL_API}/event-types`, {
    headers: { authorization: `Bearer ${cfg.cal.key()}`, "cal-api-version": "2024-06-14" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Cal.com event-types ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const list: CalEventType[] = Array.isArray(body?.data)
    ? body.data
    : (body?.data?.eventTypeGroups ?? []).flatMap((g: { eventTypes?: CalEventType[] }) => g.eventTypes ?? []);
  const needle = (v.replace(/^https?:\/\/[^/]+\//i, "").split("/").filter(Boolean).pop() ?? v).toLowerCase();
  const slug = (e: CalEventType) => String(e.slug ?? "").toLowerCase();
  const hit =
    list.find((e) => slug(e) === needle) ??
    list.find((e) => slug(e).includes(needle) || needle.includes(slug(e) || "\u0000")) ??
    list.find((e) => /consult/i.test(`${e.title ?? ""} ${e.slug ?? ""}`)) ??
    (list.length === 1 ? list[0] : undefined);
  if (!hit) {
    throw new Error(`No Cal.com event type matches "${v}". Event types on this account: ${list.map((e) => `${e.id} (${e.slug})`).join(", ") || "none"}`);
  }
  console.log(`[studio] Cal.com event type resolved: ${hit.id} (${hit.slug})`);
  resolved = { eventTypeId: Number(hit.id) };
  return resolved;
}

/** Up to 3 slots on different days (earliest first). Live from Cal.com, or clearly-labelled demo slots. */
export async function getSlots(): Promise<{ slots: Slot[]; demo: boolean }> {
  if (!live()) return { slots: demoSlots(), demo: true };
  const start = new Date(Date.now() + 4 * 3600_000);
  const end = new Date(Date.now() + 10 * 24 * 3600_000);
  const url = new URL(`${CAL_API}/slots`);
  url.searchParams.set("eventTypeId", String((await eventRef()).eventTypeId));
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", end.toISOString());
  url.searchParams.set("timeZone", cfg.tz);
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${cfg.cal.key()}`, "cal-api-version": "2024-09-04" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Cal.com slots ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  // v2 replies as {data: {"YYYY-MM-DD": [{start}]}}; older versions as {data: {slots: {...}}}; entries may be strings.
  const byDay: Record<string, unknown[]> = body?.data?.slots ?? body?.data ?? body?.slots ?? {};
  const slots: Slot[] = [];
  for (const d of Object.keys(byDay).sort()) {
    const first = byDay[d]?.[0] as string | { start?: string; time?: string } | undefined;
    const iso = typeof first === "string" ? first : (first?.start ?? first?.time);
    if (iso) slots.push({ start: iso, label: slotLabel(iso) });
    if (slots.length === 3) break;
  }
  if (!slots.length) console.warn("[studio] Cal.com returned no free slots in the next 10 days:", JSON.stringify(body).slice(0, 300));
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

/** Book with the caller's email; if Cal.com rejects it (callers often mis-spell it on the phone), retry with the fallback. */
export async function bookSlot(slot: Slot, lead: Lead, phone: string | null): Promise<Booking> {
  const first = await bookOnce(slot, lead, phone);
  const fallback = cfg.cal.fallbackEmail();
  if (first.status === "failed" && lead.email && fallback && lead.email !== fallback) {
    console.warn("[studio] Cal.com booking failed with the caller's email, retrying with CAL_FALLBACK_EMAIL:", first.error);
    return bookOnce(slot, { ...lead, email: fallback }, phone);
  }
  return first;
}

async function bookOnce(slot: Slot, lead: Lead, phone: string | null): Promise<Booking> {
  const base = { start: slot.start, label: slot.label };
  if (!live()) return { ...base, status: "dry_run" };
  const email = lead.email || cfg.cal.fallbackEmail();
  if (!email) return { ...base, status: "failed", error: "No attendee email: caller gave none and CAL_FALLBACK_EMAIL is unset" };
  try {
    const res = await fetch(`${CAL_API}/bookings`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.cal.key()}`, "cal-api-version": "2024-08-13", "content-type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        start: slot.start,
        ...(await eventRef()),
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
