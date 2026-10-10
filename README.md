# designer_bot: Aangan Studio AI phone enquiry agent

Incoming phone calls only: Vaani Labs (voice) → this app → Gemini → Cal.com → email → founder dashboard.
Architecture, guarantees (code-owned pricing, code-owned booking) and open items: see [`studio/README.md`](studio/README.md).

## Run
```
npm install
cp studio/env.example .env.local   # fill in what you have
npm run dev                        # open /studio/simulate to try a call
```
Supabase: run `supabase/studio.sql`, then set `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Without them, calls are stored in `.data/` (dev only).
Vaani should POST to `/api/voice/webhook` with `x-webhook-secret: $VOICE_WEBHOOK_SECRET`.
