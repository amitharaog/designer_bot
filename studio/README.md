# Aangan Studio: AI phone enquiry agent

Incoming calls only. Follows `components-map.html`: Vaani Labs (voice) → this app → Gemini → Cal.com → email → dashboard.

```
Vaani ──POST /api/voice/webhook {start | utterance | end}──▶ lib/studio/engine.ts
   Context   knowledge.ts   services.md, qualified.md (+ studio/enquiries/* as examples). pricing.md is NOT loaded
   Process   rubric.ts      the five criteria; code, not the model, decides the route
   AI        gemini.ts      one JSON call per turn: reply + criteria + lead fields + summary
   Output    calcom.ts      books a slot (qualified only)   email.ts / handoff.ts   designer or front desk
   Founder   hubspot.ts     every call → HubSpot contact + deal + note (transcript), cost/route as deal properties
   Designer  /studio        Vercel-hosted lead list for designers (handoff note + transcript)
   Log       store.ts       one record per call, with token + minute cost
```

Routes: **Qualified** (designer email + booked slot), **Needs review** (a HubSpot stage for the front desk, no email: unclear 1–3 after the question cap, caller hung up, or an AI/tool error, so a call is never silently dropped), **Not qualified** (graceful close). A rejection is never final: the AI can be wrong, so every rejected call lands in HubSpot stage "AI rejected: founder review". The founder opens the signed review link (a property on the HubSpot deal) (`/review/[id]?t=…`), reads the transcript and the caller's exact words behind the rejection, and picks **Push to designer** (designer email + HubSpot stage "Forwarded by founder") or **Keep rejected**. The AI is also told to fail a criterion only on what it clearly heard, and a rejection it can't quote is turned back into a question.

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

## HubSpot
`HUBSPOT_TOKEN=… npm run hubspot:setup` creates the deal properties and the "Aangan phone enquiries" pipeline and prints `HUBSPOT_PIPELINE_ID`. Not yet run against a real HubSpot account; only tested against a stand-in API. Won/lost is the deal stage, so conversion and cost-per-lead reports are built in HubSpot.

## Post-call mode (the whiteboard flow)
Vaani runs the conversation using `studio/vaani-agent.md` (generate with `node scripts/vaani-prompt.mjs`) and sends the finished transcript to `/api/voice/webhook` (`event: call_ended` + `transcript`). `ingestTranscript` analyses it once with Gemini, applies the rubric, books the earliest slot for qualified leads, emails the designer (and the client, if they gave an email), or sends a rejection to the founder to review. A call where the caller never spoke becomes a front-desk callback. Because Vaani's model speaks live, pricing can't be gated in code there: the transcript is checked afterwards and any agent turn that looks like a quoted figure puts a WARNING at the top of the handoff.

## Testing with one email address
Set `DESIGNER_EMAILS` to your own address (designers are the only people the app emails), and leave `HANDOFF_FROM_EMAIL` empty (Resend's sandbox sender only delivers to the Resend account owner).
