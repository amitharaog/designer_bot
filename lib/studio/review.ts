import "server-only";
import { createHmac } from "node:crypto";
import { cfg } from "./config";
import { safeEqual } from "@/lib/http";

function secret() {
  const s = cfg.reviewSecret();
  if (s) return s;
  if (process.env.NODE_ENV !== "production") return "dev-review-secret";
  throw new Error("Set REVIEW_SECRET (or STUDIO_KEY): review links are signed with it");
}

/** Per-call signed token: lets the founder open exactly one call from HubSpot or email, without the studio key. */
export const reviewToken = (id: string) => createHmac("sha256", secret()).update(`review:${id}`).digest("base64url");
export const reviewTokenOk = (id: string, t: string | null | undefined) => safeEqual(reviewToken(id), t);
export const reviewUrl = (id: string) => `${cfg.appUrl()}/review/${id}?t=${reviewToken(id)}`;
