import "server-only";
import { cfg } from "./config";
import { reviewUrl } from "./review";
import type { CallRecord, HubspotState } from "./types";

// HubSpot is the founder's dashboard: every call becomes a contact + a deal in the "Aangan phone enquiries"
// pipeline (created by `npm run hubspot:setup`), with the handoff note and transcript logged on it.
// Cost, route and booking are deal properties, so Nikhil builds his reports in HubSpot.
const API = process.env.HUBSPOT_BASE_URL ?? "https://api.hubapi.com";
const ASSOC = { dealToContact: 3, noteToContact: 202, noteToDeal: 214 };

export function stageLabel(c: CallRecord): string {
  if (c.founder_decision === "forwarded") return "Forwarded by founder";
  if (c.founder_decision === "kept_rejected") return "Closed: rejected";
  if (c.route === "qualified") return c.booking && c.booking.status !== "failed" ? "Qualified: booked" : "Qualified: to schedule";
  if (c.route === "needs_review") return "Needs front-desk review";
  return "AI rejected: founder review";
}

async function hs<T = Record<string, unknown>>(method: string, path: string, body?: object): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${cfg.hubspot.token()}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HubSpot ${method} ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (res.status === 204 ? {} : await res.json()) as T;
}

let stageCache: Map<string, string> | null = null;
async function stageId(label: string) {
  if (!stageCache) {
    const p = await hs<{ stages: { id: string; label: string }[] }>("GET", `/crm/v3/pipelines/deals/${cfg.hubspot.pipelineId()}`);
    stageCache = new Map(p.stages.map((s) => [s.label, s.id]));
  }
  const id = stageCache.get(label);
  if (!id) throw new Error(`HubSpot pipeline has no stage "${label}". Run npm run hubspot:setup`);
  return id;
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

function dealProps(c: CallRecord) {
  return {
    aangan_call_id: c.id,
    aangan_route: c.route ?? "",
    aangan_reason: c.route_reason ?? "",
    aangan_summary: c.summary,
    aangan_fail_evidence: c.fail_evidence,
    aangan_booked_slot: c.booking && c.booking.status !== "failed" ? c.booking.label : "",
    aangan_after_hours: c.after_hours ? "yes" : "no",
    aangan_duration_s: String(c.duration_s ?? 0),
    aangan_ai_cost_inr: (c.cost?.ai_inr ?? 0).toFixed(2),
    aangan_voice_cost_inr: (c.cost?.voice_inr ?? 0).toFixed(2),
    aangan_total_cost_inr: (c.cost?.total_inr ?? 0).toFixed(2),
    aangan_review_url: c.route === "qualified" ? "" : reviewUrl(c.id),
  };
}

function noteBody(c: CallRecord) {
  const l = c.lead;
  const lines = [
    `<b>${esc(stageLabel(c))}</b>: ${esc(c.route_reason ?? "")}`,
    c.summary ? esc(c.summary) : "",
    c.fail_evidence ? `<b>Caller said (reason for rejection):</b> ${esc(c.fail_evidence)}` : "",
    `Location: ${esc(l.location ?? "n/a")} · Project: ${esc([l.project_type, l.size].filter(Boolean).join(", ") || "n/a")} · Timeline: ${esc(l.timeline ?? "n/a")}`,
    `Budget mentioned: ${esc(l.budget_mentioned ?? "no")} · Decision-maker: ${esc(l.decision_maker_note ?? "not confirmed")}`,
    c.pricing_asked ? "Caller asked about pricing (told: depends on site, materials and scope)." : "",
    "<b>Transcript</b>",
    ...c.transcript.map((t) => `${t.role === "agent" ? "Agent" : "Caller"}: ${esc(t.text)}`),
  ];
  return lines.filter(Boolean).join("<br>");
}

/** Creates (first time) or updates (later, e.g. after a founder decision) the call's HubSpot records. Never throws. */
export async function syncHubspot(c: CallRecord): Promise<HubspotState> {
  if (!cfg.hubspot.token() || !cfg.hubspot.pipelineId()) {
    console.log(`[studio] hubspot dry-run: "${stageLabel(c)}" for ${c.lead.name ?? c.caller_phone ?? c.id}`);
    return { status: "dry_run" };
  }
  try {
    const stage = await stageId(stageLabel(c));
    if (c.hubspot?.deal_id) {
      await hs("PATCH", `/crm/v3/objects/deals/${c.hubspot.deal_id}`, { properties: { dealstage: stage, ...dealProps(c) } });
      return { ...c.hubspot, status: "synced" };
    }
    // contact: reuse by phone number, else create
    let contactId: string | undefined;
    const props = { ...(c.lead.name ? { firstname: c.lead.name } : { firstname: "Unknown caller" }), ...(c.caller_phone ? { phone: c.caller_phone } : {}), ...(c.lead.email ? { email: c.lead.email } : {}), ...(c.lead.location ? { city: c.lead.location } : {}) };
    if (c.caller_phone) {
      const found = await hs<{ results: { id: string }[] }>("POST", "/crm/v3/objects/contacts/search", {
        filterGroups: [{ filters: [{ propertyName: "phone", operator: "EQ", value: c.caller_phone }] }],
        limit: 1,
      });
      contactId = found.results[0]?.id;
      if (contactId) await hs("PATCH", `/crm/v3/objects/contacts/${contactId}`, { properties: props });
    }
    if (!contactId) contactId = (await hs<{ id: string }>("POST", "/crm/v3/objects/contacts", { properties: props })).id;

    const deal = await hs<{ id: string }>("POST", "/crm/v3/objects/deals", {
      properties: { dealname: `${c.lead.name ?? c.caller_phone ?? "Phone enquiry"}${c.lead.location ? `, ${c.lead.location}` : ""}`, pipeline: cfg.hubspot.pipelineId(), dealstage: stage, ...dealProps(c) },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOC.dealToContact }] }],
    });
    await hs("POST", "/crm/v3/objects/notes", {
      properties: { hs_timestamp: new Date().toISOString(), hs_note_body: noteBody(c) },
      associations: [
        { to: { id: deal.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOC.noteToDeal }] },
        { to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: ASSOC.noteToContact }] },
      ],
    });
    return { status: "synced", contact_id: contactId, deal_id: deal.id };
  } catch (e) {
    console.error("[studio] hubspot sync failed", e);
    return { ...(c.hubspot ?? {}), status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
