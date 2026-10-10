import "server-only";
import { cfg } from "./config";

export type SendResult = { status: "sent" | "dry_run" | "failed"; error?: string };

/** Resend REST API. Without RESEND_API_KEY (or recipients) it logs instead of sending, and says so. */
export async function sendEmail(to: string[], subject: string, text: string, html: string): Promise<SendResult> {
  if (!cfg.email.resendKey() || !to.length) {
    console.log(`[studio] email dry-run → ${to.join(", ") || "(no recipients configured)"}\n${subject}\n${text}`);
    return { status: "dry_run" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.email.resendKey()}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ from: cfg.email.from(), to, subject, text, html }),
    });
    if (!res.ok) return { status: "failed", error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { status: "sent" };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
