import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";

/** Giriş zorunlu sayfalar için. Giriş yoksa giriş sayfasına yönlendirir. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(nextPath ? `/giris?next=${encodeURIComponent(nextPath)}` : "/giris");
  }
  return user;
}

/** Yönetim paneli. Yetkisiz kullanıcılara panelin varlığını göstermez. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/giris?next=/admin");
  if (user.role !== "ADMIN") notFound();
  return user;
}

/** İş ortaklığı paneli: yalnızca aktif iş ortağı hesapları. Diğer kullanıcılara panelin varlığı gösterilmez. */
export async function requirePartner() {
  const user = await getSessionUser();
  if (!user) redirect("/giris?next=/ortak");
  if (user.role !== "PARTNER") notFound();
  const { db } = await import("../db");
  const partner = await db.partner.findUnique({ where: { userId: user.id } });
  if (!partner || !partner.active) notFound();
  return { user, partner };
}

export function isAdmin(user: Pick<SessionUser, "role"> | null | undefined) {
  return user?.role === "ADMIN";
}

/** Güvenli yönlendirme: yalnızca site içi göreli yollar kabul edilir. */
export function safeNextPath(next: string | null | undefined, fallback = "/panel") {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
