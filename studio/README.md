# Aangan Studio: AI phone enquiry agent

Incoming calls only. Follows `components-map.html`: Vaani Labs (voice) → this app → Gemini → Cal.com → email → dashboard.

```
Vaani ──POST /api/voice/webhook {start | utterance | end}──▶ lib/studio/engine.ts
   Context   knowledge.ts   services.md, qualified.md (+ studio/enquiries/* as examples). pricing.md is NOT loaded
   Process   rubric.ts      the five criteria; code, not the model, decides the route
   AI        gemini.ts      one JSON call per turn: reply + criteria + lead fields + summary
   Output    calcom.ts      books a slot (qualified only)   email.ts / handoff.ts   designer or front desk
   Log       store.ts       one record per call, with token + minute cost → /studio dashboard
```

Routes: **Qualified** (designer email + booked slot), **Needs review** (front-desk email: unclear 1–3 after the question cap, caller hung up, or an AI/tool error, so a call is never silently dropped), **Not qualified** (graceful close, logged, no email).

Run it: `cp studio/env.example .env.local`, fill in what you have, `npm run dev`, open `/studio/simulate`. Everything degrades visibly without keys (email → logged "dry_run", Cal.com → clearly-labelled demo slots).

## Guarantees enforced in code
- **Pricing is never decided by the AI.** Code detects a price question in the caller's words (`asksPrice`) and says the fixed pricing.md line itself. The model never sees pricing.md or any rate, so it has nothing to leak; if it ever volunteered a figure anyway, `guardReply` replaces the reply. Callers who volunteer their own budget are not treated as asking for a price. If Nikhil later wants real quotes, they should come from a deterministic calculator he signs off on, not from the model.
- A slot is booked only by code, only for a qualified caller, only from slots the system fetched.
- Any failed criterion ends the call and never forwards the lead (qualified.md).

## Open items
- **Vaani payload**: `/api/voice/webhook` accepts a generic `{event, call_id, from, text}` shape. Map Vaani's real webhook/custom-LLM format in that one file.
- **Past enquiries**: put the 40 transcripts in `studio/enquiries/` (up to 6 are loaded as examples).
- **Rates**: `VAANI_INR_PER_MIN` is a placeholder; the dashboard cost depends on it.
- **Components map wording**: it says the agent may share an indicative *range*. The code gives no number at all, per pricing.md; update the map to match.
