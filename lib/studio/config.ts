import "server-only";

const num = (v: string | undefined, d: number) => {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};

/** Everything tunable lives here; each value has an env override. */
export const cfg = {
  gemini: {
    key: () => process.env.GEMINI_API_KEY,
    base: () => process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com",
    model: () => process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    // USD per 1M tokens. Defaults are gemini-2.5-flash list prices; set these if you change GEMINI_MODEL.
    inUsdPerM: () => num(process.env.GEMINI_IN_USD_PER_M, 0.3),
    outUsdPerM: () => num(process.env.GEMINI_OUT_USD_PER_M, 2.5),
  },
  usdInr: () => num(process.env.USD_INR, 88),
  // ASSUMPTION: replace with the per-minute rate in the Vaani Labs contract (telephony + speech, in ₹).
  voiceInrPerMin: () => num(process.env.VAANI_INR_PER_MIN, 5),
  officeStartHour: () => num(process.env.OFFICE_START_HOUR, 10),
  officeEndHour: () => num(process.env.OFFICE_END_HOUR, 19),
  maxTurns: () => num(process.env.MAX_CALLER_TURNS, 14),
  tz: "Asia/Kolkata",
  cal: {
    key: () => process.env.CAL_API_KEY,
    eventTypeId: () => process.env.CAL_EVENT_TYPE_ID,
    fallbackEmail: () => process.env.CAL_FALLBACK_EMAIL,
  },
  email: {
    resendKey: () => process.env.RESEND_API_KEY,
    from: () => process.env.HANDOFF_FROM_EMAIL ?? "Aangan Enquiries <onboarding@resend.dev>",
    designers: () => list(process.env.DESIGNER_EMAILS),
    frontDesk: () => list(process.env.FRONT_DESK_EMAILS),
  },
  webhookSecret: () => process.env.VOICE_WEBHOOK_SECRET,
  studioKey: () => process.env.STUDIO_KEY,
};

function list(v: string | undefined) {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
