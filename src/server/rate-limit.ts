import "server-only";
import { headers } from "next/headers";
import { clientIpFromHeaders } from "./auth/session";

/**
 * Basit sabit pencereli hız sınırlayıcı (bellek içi).
 * Tek sunucu için yeterlidir. Birden fazla sunucu/serverless örneğinde
 * Redis (ör. Upstash) tabanlı bir depo ile değiştirilmelidir — bkz. docs/DEPLOYMENT.md.
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();
let lastSweep = Date.now();

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 15 * 60 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  uploadInit: { limit: 120, windowSeconds: 60 * 60 },
  orderCreate: { limit: 20, windowSeconds: 60 * 60 },
  paymentStart: { limit: 20, windowSeconds: 60 * 60 },
  contact: { limit: 5, windowSeconds: 60 * 60 },
  orderMessage: { limit: 30, windowSeconds: 60 * 60 },
  webhook: { limit: 600, windowSeconds: 60 },
  // Doğrulama: kalıcı sınırlar ayrıca veritabanında uygulanır (src/server/verification/service.ts)
  verifyEmail: { limit: 6, windowSeconds: 60 * 60 },
  otpSend: { limit: 8, windowSeconds: 60 * 60 },
  otpVerify: { limit: 15, windowSeconds: 15 * 60 },
  trialCreate: { limit: 5, windowSeconds: 60 * 60 },
  referralApply: { limit: 20, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

export function rateLimit(key: string, rule: RateLimitRule) {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
    lastSweep = now;
  }
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
    return { ok: true as const, remaining: rule.limit - 1 };
  }
  if (bucket.count >= rule.limit) {
    return { ok: false as const, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true as const, remaining: rule.limit - bucket.count };
}

/** Sunucu eylemlerinde istemci IP'sine göre sınırlama. */
export async function rateLimitByIp(name: keyof typeof RATE_LIMITS, extraKey = "") {
  const ip = clientIpFromHeaders(await headers()) ?? "unknown";
  return rateLimit(`${name}:${ip}:${extraKey}`, RATE_LIMITS[name]);
}

export function rateLimitRequest(request: Request, name: keyof typeof RATE_LIMITS, extraKey = "") {
  const ip = clientIpFromHeaders(request.headers) ?? "unknown";
  return rateLimit(`${name}:${ip}:${extraKey}`, RATE_LIMITS[name]);
}

/** Test yardımcısı */
export function resetRateLimits() {
  store.clear();
}
