import { CRITERIA, CRITERIA_LABEL, type Criteria, type Crit, type CriterionKey } from "./types";

export const blankCriteria = (): Criteria => ({
  real_project: "unclear",
  in_area: "unclear",
  timeline: "unclear",
  budget: "unclear",
  decision_maker: "unclear",
});

export type Verdict =
  | { kind: "not_qualified"; failed: CriterionKey[]; reason: string }
  | { kind: "needs_info"; missing: CriterionKey[]; reason: string }
  | { kind: "qualified"; uncertain: CriterionKey[]; reason: string };

/**
 * Nikhil's rubric (studio/knowledge/qualified.md), applied in code so the model
 * can't talk itself into forwarding a bad lead:
 *  - any criterion failed            -> close gracefully, never forward
 *  - 1/2/3 unclear                   -> keep asking
 *  - 4/5 unclear                     -> qualified, with the uncertainty noted for the designer
 */
export function verdict(c: Criteria): Verdict {
  const failed = CRITERIA.filter((k) => c[k] === "fail");
  if (failed.length) {
    return { kind: "not_qualified", failed, reason: `Failed: ${failed.map((k) => CRITERIA_LABEL[k]).join("; ")}` };
  }
  const missing = (["real_project", "in_area", "timeline"] as const).filter((k) => c[k] === "unclear");
  if (missing.length) {
    return { kind: "needs_info", missing, reason: `Still unclear: ${missing.map((k) => CRITERIA_LABEL[k]).join("; ")}` };
  }
  const uncertain = (["budget", "decision_maker"] as const).filter((k) => c[k] === "unclear");
  return {
    kind: "qualified",
    uncertain,
    reason: uncertain.length ? `Qualified; not confirmed: ${uncertain.map((k) => CRITERIA_LABEL[k]).join("; ")}` : "All five criteria met",
  };
}

export const isCrit = (v: unknown): v is Crit => v === "pass" || v === "fail" || v === "unclear";
