// One-time HubSpot setup: deal properties + the "Aangan phone enquiries" pipeline. Safe to re-run.
//   HUBSPOT_TOKEN=... npm run hubspot:setup
// Prints the HUBSPOT_PIPELINE_ID to set in the app's environment.
const token = process.env.HUBSPOT_TOKEN;
if (!token) { console.error("Set HUBSPOT_TOKEN (private app token with CRM schema + deals write)."); process.exit(1); }
const api = async (method, path, body) => {
  const r = await fetch(`https://api.hubapi.com${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body && JSON.stringify(body) });
  const text = await r.text();
  return { ok: r.ok, status: r.status, json: text ? JSON.parse(text) : {} };
};
const text = (name, label, long = false) => ({ name, label, type: "string", fieldType: long ? "textarea" : "text" });
const num = (name, label) => ({ name, label, type: "number", fieldType: "number" });
const props = [
  text("aangan_call_id", "Aangan call ID"), text("aangan_route", "Aangan route"), text("aangan_reason", "Aangan route reason", true),
  text("aangan_summary", "Aangan call summary", true), text("aangan_fail_evidence", "What the caller said (AI rejection)", true),
  text("aangan_booked_slot", "Aangan booked consultation"), text("aangan_after_hours", "Call after hours"),
  text("aangan_review_url", "Founder review link"),
  num("aangan_duration_s", "Call duration (s)"), num("aangan_ai_cost_inr", "AI cost (INR)"), num("aangan_voice_cost_inr", "Voice cost (INR)"), num("aangan_total_cost_inr", "Total cost (INR)"),
];
for (const p of props) {
  const r = await api("POST", "/crm/v3/properties/deals", { ...p, groupName: "dealinformation" });
  console.log(r.ok ? `created ${p.name}` : r.status === 409 ? `exists  ${p.name}` : `FAILED  ${p.name}: ${JSON.stringify(r.json)}`);
}
const stages = [
  ["Qualified: booked", { probability: "0.5" }], ["Qualified: to schedule", { probability: "0.4" }], ["Needs front-desk review", { probability: "0.2" }],
  ["AI rejected: founder review", { probability: "0.1" }], ["Forwarded by founder", { probability: "0.3" }],
  ["Won", { isClosed: "true", probability: "1.0" }], ["Lost", { isClosed: "true", probability: "0.0" }], ["Closed: rejected", { isClosed: "true", probability: "0.0" }],
];
const label = "Aangan phone enquiries";
const list = await api("GET", "/crm/v3/pipelines/deals");
let pipe = list.json.results?.find((p) => p.label === label);
if (!pipe) {
  const r = await api("POST", "/crm/v3/pipelines/deals", { label, displayOrder: 5, stages: stages.map(([l, metadata], i) => ({ label: l, displayOrder: i, metadata })) });
  if (!r.ok) { console.error("Pipeline creation failed:", JSON.stringify(r.json)); process.exit(1); }
  pipe = r.json;
  console.log("created pipeline");
} else console.log("pipeline exists");
console.log(`\nSet in the app environment:\nHUBSPOT_PIPELINE_ID=${pipe.id}`);
