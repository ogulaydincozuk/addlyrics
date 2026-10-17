import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export function sha256Hex(input: string | Buffer) {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacSha256(secret: string, payload: string | Buffer, encoding: "hex" | "base64" | "base64url" = "hex") {
  return createHmac("sha256", secret).update(payload).digest(encoding);
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Kısa ömürlü, imzalı belirteç (ör. yerel dosya yükleme izni).
 * Biçim: base64url(json).base64url(hmac)
 */
export function signToken(payload: Record<string, unknown>, ttlSeconds: number) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString(
    "base64url",
  );
  const sig = hmacSha256(env().AUTH_SECRET, body, "base64url");
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string | null | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmacSha256(env().AUTH_SECRET, body, "base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: number };
    if (typeof data.exp !== "number" || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}
