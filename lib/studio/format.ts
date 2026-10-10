import type { CallRecord } from "./types";

const TZ = "Asia/Kolkata";
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...o });

export const dayShort = (iso: string) => fmt({ weekday: "short" }).format(new Date(iso));
export const dayNum = (iso: string) => fmt({ day: "numeric" }).format(new Date(iso));
export const monthShort = (iso: string) => fmt({ month: "short" }).format(new Date(iso));
export const timeShort = (iso: string) => fmt({ hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
export const dateTime = (iso: string) => fmt({ day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
export const longDate = (iso: string) => fmt({ weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

export const isBooked = (c: CallRecord) => !!c.booking && c.booking.status !== "failed";

/** Sort leads for the designer desk. Uses the clock, so keep it out of components. */
export function deskView(leads: CallRecord[]) {
  const now = Date.now();
  const weekAgo = now - 7 * 86400_000;
  const upcoming = leads
    .filter((c) => isBooked(c) && new Date(c.booking!.start).getTime() >= now - 3600_000)
    .sort((a, b) => a.booking!.start.localeCompare(b.booking!.start));
  const past = leads.filter((c) => isBooked(c) && new Date(c.booking!.start).getTime() < now - 3600_000);
  const toSchedule = leads.filter((c) => !isBooked(c));
  const newThisWeek = leads.filter((c) => new Date(c.started_at).getTime() >= weekAgo).length;
  const hour = Number(fmt({ hour: "numeric", hour12: false }).format(new Date(now)));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return { upcoming, past, toSchedule, newThisWeek, greeting, today: longDate(new Date(now).toISOString()) };
}
