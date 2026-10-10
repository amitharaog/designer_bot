import "server-only";
import { CRITERIA, CRITERIA_LABEL, type CallRecord } from "./types";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The designer's handoff note: everything the front desk would have asked, so the first call starts at design. */
export function buildHandoff(c: CallRecord, opts: { reviewUrl?: string } = {}) {
  const l = c.lead;
  const route =
    c.founder_decision === "forwarded" ? "Forwarded by founder"
    : c.route === "not_qualified" ? "AI rejected: founder to review"
    : c.route === "qualified" ? "Qualified"
    : "Needs review (front desk)";
  const who = l.name || "Unknown caller";
  const rows: [string, string][] = [
    ["Name", who],
    ["Phone", c.caller_phone ?? "not captured"],
    ...(l.email ? ([["Email", l.email]] as [string, string][]) : []),
    ["Location", l.location ?? "not stated"],
    ["Project", [l.project_type, l.size].filter(Boolean).join(", ") || "not stated"],
    ["Timeline", l.timeline ?? "not stated"],
    ["Budget mentioned", l.budget_mentioned ?? "not mentioned (not asked, by design)"],
    ["Decision-maker", l.decision_maker_note ?? "not confirmed"],
    ...(l.scope_notes ? ([["Scope notes", l.scope_notes]] as [string, string][]) : []),
    ...(c.fail_evidence ? ([["Caller said (reason for rejection)", c.fail_evidence]] as [string, string][]) : []),
    ["Call came in", `${new Date(c.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST${c.after_hours ? " (after hours)" : ""}`],
  ];
  const booking = c.founder_decision === "forwarded" ? "Not booked. Founder forwarded this after the AI rejected it. Please call the caller to arrange a consultation." : c.booking
    ? c.booking.status === "failed"
      ? `NOT booked (${c.booking.error}). Caller was told a designer will call to fix a slot.`
      : `${c.booking.label} IST${c.booking.designer ? ` with ${c.booking.designer}` : ""}${c.booking.status === "dry_run" ? " (demo slot: Cal.com not connected)" : ""}`
    : c.route === "qualified"
      ? "No slot booked. Please call the caller to arrange a consultation."
      : "n/a";
  const checks = CRITERIA.map((k) => `${c.criteria[k] === "pass" ? "✔" : c.criteria[k] === "fail" ? "✘" : "?"} ${CRITERIA_LABEL[k]}`);
  const transcript = c.transcript.map((t) => `${t.role === "agent" ? "Agent" : "Caller"}: ${t.text}`).join("\n");
  const pricing = c.pricing_asked
    ? "Caller asked about pricing. They were told it depends on site, materials and scope and that you'll cover it at the consultation. No figure was given."
    : "";

  const subject = `[${route}] ${who}${l.location ? `, ${l.location}` : ""}${l.project_type ? `, ${l.project_type}` : ""}`;

  const text = [
    `${route.toUpperCase()}: ${c.route_reason ?? ""}`,
    ...(opts.reviewUrl ? ["", `Read the transcript and decide: ${opts.reviewUrl}`] : []),
    "",
    c.summary ? `SUMMARY\n${c.summary}\n` : "",
    "DETAILS",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `CONSULTATION: ${booking}`,
    pricing ? `\nPRICING: ${pricing}` : "",
    c.caller_questions.length ? `\nQUESTIONS THE CALLER ASKED\n${c.caller_questions.map((q) => `- ${q}`).join("\n")}` : "",
    `\nRUBRIC\n${checks.join("\n")}`,
    `\nTRANSCRIPT\n${transcript}`,
  ].join("\n");

  const html = `<div style="font-family:system-ui,sans-serif;max-width:640px;color:#0f172a">
<p style="font-size:13px;font-weight:700;color:${c.route === "qualified" || c.founder_decision === "forwarded" ? "#047857" : "#b45309"};margin:0">${esc(route.toUpperCase())}</p>
<p style="margin:2px 0 12px;color:#475569;font-size:13px">${esc(c.route_reason ?? "")}</p>
${opts.reviewUrl ? `<p><a href="${esc(opts.reviewUrl)}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Review and decide</a></p>` : ""}
${c.summary ? `<p style="font-size:15px;line-height:1.5">${esc(c.summary)}</p>` : ""}
<table style="border-collapse:collapse;width:100%;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`)
    .join("")}</table>
<p style="font-size:14px"><b>Consultation:</b> ${esc(booking)}</p>
${pricing ? `<p style="font-size:14px"><b>Pricing:</b> ${esc(pricing)}</p>` : ""}
${c.caller_questions.length ? `<p style="font-size:14px;margin-bottom:2px"><b>Caller asked</b></p><ul style="margin-top:0;font-size:14px">${c.caller_questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}
<p style="font-size:13px;color:#475569">${checks.map(esc).join(" &nbsp;·&nbsp; ")}</p>
<details><summary style="cursor:pointer;font-size:13px;color:#475569">Full transcript</summary><pre style="white-space:pre-wrap;font-size:12px;background:#f1f5f9;padding:12px;border-radius:8px">${esc(transcript)}</pre></details>
</div>`;
  return { subject, text, html };
}
