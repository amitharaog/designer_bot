import "server-only";
import { cfg } from "./config";
import { fail, safeEqual } from "@/lib/http";

/** Dashboard key. In production a STUDIO_KEY is mandatory; locally an unset key means open. */
export function studioKeyOk(key: string | null | undefined) {
  const want = cfg.studioKey();
  if (!want) return process.env.NODE_ENV !== "production";
  return safeEqual(want, key);
}

export function requireStudio(req: Request) {
  if (!studioKeyOk(req.headers.get("x-studio-key"))) fail(403, "Invalid studio key");
}

/** Voice provider webhooks authenticate with a shared secret (header or ?secret=). */
export function requireWebhook(req: Request) {
  const want = cfg.webhookSecret();
  if (!want) {
    if (process.env.NODE_ENV === "production") fail(503, "VOICE_WEBHOOK_SECRET is not configured");
    return;
  }
  const got =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(req.url).searchParams.get("secret");
  if (!safeEqual(want, got)) fail(403, "Invalid webhook secret");
}
