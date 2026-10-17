import "server-only";
import { env } from "./env";

/**
 * Durum değiştiren API isteklerinde (POST/PUT/DELETE) isteğin kendi sitemizden geldiğini doğrular.
 * Çerezler SameSite=Lax olsa da ek CSRF koruması sağlar.
 */
export function isSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return site === "same-origin";
  try {
    const o = new URL(origin);
    const allowed = new URL(env().APP_URL);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return o.host === allowed.host || (host != null && o.host === host);
  } catch {
    return false;
  }
}

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return Response.json({ ok: false, error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

export function jsonOk(data: Record<string, unknown> = {}) {
  return Response.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
}
