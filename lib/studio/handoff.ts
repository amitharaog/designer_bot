import "server-only";
import type { CallRecord } from "./types";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * The one email designers get: the consultation is scheduled (or needs scheduling), plus a short summary of the call
 * with what the front desk would have asked, so the first call starts at design. The full transcript lives in the dashboard.
 */
export function buildHandoff(c: CallRecord) {
  const l = c.lead;
  const who = l.name || "Unknown caller";
  const booked = !!c.booking && c.booking.status !== "failed";
  const forwarded = c.founder_decision === "forwarded";
  const when = booked
    ? `${c.booking!.label} (IST)${c.booking!.designer ? ` with ${c.booking!.designer}` : ""}${c.booking!.status === "dry_run" ? " [demo slot: Cal.com not connected]" : ""}`
    : "";
  const headline = booked
    ? `Consultation scheduled: ${when}`
    : forwarded
      ? "Forwarded by the founder after review. Please call the caller to arrange a consultation."
      : "Qualified lead, no slot booked. Please call the caller to arrange a consultation.";
  const rows: [string, string][] = [
    ["Name", who],
    ["Phone", c.caller_phone ?? "not captured"],
    ...(l.email ? ([["Email", l.email]] as [string, string][]) : []),
    ["Location", l.location ?? "not stated"],
    ["Project", [l.project_type, l.size].filter(Boolean).join(", ") || "not stated"],
    ["Timeline", l.timeline ?? "not stated"],
    ["Decision-maker", l.decision_maker_note ?? "not confirmed"],
    ...(l.budget_mentioned ? ([["Budget mentioned", l.budget_mentioned]] as [string, string][]) : []),
    ...(l.scope_notes ? ([["Notes", l.scope_notes]] as [string, string][]) : []),
    ["Call came in", `${new Date(c.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST${c.after_hours ? " (after hours)" : ""}`],
  ];
  const pricing = c.pricing_asked
    ? "The caller asked about pricing and was told it depends on site, materials and scope, and that you'll cover it at the consultation. No figure was given."
    : "";
  const questions = c.caller_questions.length ? c.caller_questions : [];
  const subject = `${booked ? "Consultation scheduled" : "New lead"}: ${who}${l.location ? `, ${l.location}` : ""}${booked ? ` · ${c.booking!.label}` : ""}`;

  const text = [
    headline,
    "",
    c.summary ? `SUMMARY\n${c.summary}\n` : "",
    "DETAILS",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    questions.length ? `\nTHE CALLER ASKED\n${questions.map((q) => `- ${q}`).join("\n")}` : "",
    pricing ? `\nPRICING: ${pricing}` : "",
    "\nThe full transcript is in the designers' dashboard.",
  ].join("\n");

  const html = `<div style="font-family:system-ui,sans-serif;max-width:600px;color:#0f172a;line-height:1.5">
<p style="font-size:16px;font-weight:700;margin:0 0 12px;color:${booked ? "#047857" : "#b45309"}">${esc(headline)}</p>
${c.summary ? `<p style="font-size:15px;margin:0 0 14px">${esc(c.summary)}</p>` : ""}
<table style="border-collapse:collapse;width:100%;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="padding:3px 12px 3px 0;color:#64748b;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:3px 0">${esc(v)}</td></tr>`)
    .join("")}</table>
${questions.length ? `<p style="font-size:14px;margin:14px 0 2px"><b>The caller asked</b></p><ul style="margin-top:0;font-size:14px">${questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}
${pricing ? `<p style="font-size:14px"><b>Pricing:</b> ${esc(pricing)}</p>` : ""}
<p style="font-size:12px;color:#64748b">The full transcript is in the designers' dashboard.</p>
</div>`;
  return { subject, text, html };
}

/** Confirmation to the caller (only when they gave an email on the call). Never contains any price. */
export function buildClientNotice(c: CallRecord) {
  const name = c.lead.name ? ` ${c.lead.name.split(" ")[0]}` : "";
  const booked = c.booking && c.booking.status !== "failed";
  const line = booked
    ? `Your design consultation is booked for ${c.booking!.label} (IST). Your designer already has everything you told us, so you won't need to repeat yourself.`
    : "One of our designers will call you shortly to arrange a design consultation. They already have everything you told us, so you won't need to repeat yourself.";
  const subject = booked ? "Your Aangan Studio consultation is booked" : "Thanks for calling Aangan Studio";
  const text = `Hi${name},\n\nThanks for calling Aangan Studio. ${line}\n\nPricing is confirmed by your designer at the consultation, after they understand your site and requirements.\n\nAangan Studio, Pune`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0f172a;line-height:1.5"><p>Hi${esc(name)},</p><p>Thanks for calling Aangan Studio. ${esc(line)}</p><p style="color:#475569;font-size:14px">Pricing is confirmed by your designer at the consultation, after they understand your site and requirements.</p><p>Aangan Studio, Pune</p></div>`;
  return { subject, text, html };
}
