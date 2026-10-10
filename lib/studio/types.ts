export type Crit = "pass" | "fail" | "unclear";

export const CRITERIA = ["real_project", "in_area", "timeline", "budget", "decision_maker"] as const;
export type CriterionKey = (typeof CRITERIA)[number];
export type Criteria = Record<CriterionKey, Crit>;

export const CRITERIA_LABEL: Record<CriterionKey, string> = {
  real_project: "Real project (design + execution)",
  in_area: "In Pune / PCMC",
  timeline: "Realistic timeline",
  budget: "Budget band",
  decision_maker: "Decision-maker",
};

export type Lead = {
  name?: string | null;
  email?: string | null;
  location?: string | null;
  project_type?: string | null;
  size?: string | null;
  timeline?: string | null;
  budget_mentioned?: string | null;
  decision_maker_note?: string | null;
  scope_notes?: string | null;
};

export type Route = "qualified" | "needs_review" | "not_qualified";
export type FounderDecision = "pending" | "forwarded" | "kept_rejected";

export type HubspotState = { status: "synced" | "dry_run" | "failed"; contact_id?: string; deal_id?: string; error?: string };

export type Turn = { role: "caller" | "agent"; text: string; at: string; latency_ms?: number };

export type Slot = { start: string; label: string };

export type Booking = {
  status: "booked" | "dry_run" | "failed";
  start: string;
  label: string;
  designer?: string | null;
  uid?: string | null;
  error?: string;
};

export type CallRecord = {
  id: string;
  simulated: boolean;
  caller_phone: string | null;
  started_at: string;
  ended_at: string | null;
  after_hours: boolean;
  transcript: Turn[];
  criteria: Criteria;
  lead: Lead;
  summary: string;
  caller_questions: string[];
  pricing_asked: boolean;
  slots: Slot[];
  booking: Booking | null;
  route: Route | null;
  route_reason: string | null;
  handoff: { to: string[]; status: "sent" | "dry_run" | "failed" | "not_needed"; at: string | null; error?: string; client?: "sent" | "dry_run" | "failed" | "skipped" } | null;
  usage: { input_tokens: number; output_tokens: number; model_calls: number; errors: number };
  duration_s: number | null;
  cost: { ai_inr: number; voice_inr: number; total_inr: number } | null;
  /** AI-rejected calls wait here for the founder to read the transcript and decide. */
  founder_decision: FounderDecision | null;
  /** The caller's own words behind a failed criterion, so the founder can judge the AI. */
  fail_evidence: string;
  hubspot: HubspotState | null;
  finalized: boolean;
};
