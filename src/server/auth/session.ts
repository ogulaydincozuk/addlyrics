import "server-only";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { db } from "../db";
import { randomToken, sha256Hex } from "../crypto";
import { isProduction } from "../env";

const SESSION_DAYS = 30;

function cookieName() {
  // __Host- öneki: yalnızca HTTPS, path=/ ve alan adı belirtilmeden ayarlanabilir
  return isProduction() ? "__Host-al_session" : "al_session";
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  artistName: string | null;
  role: Role;
};

export async function createSession(userId: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const h = await headers();
  await db.session.create({
    data: {
      id: sha256Hex(token),
      userId,
      expiresAt,
      ipAddress: clientIpFromHeaders(h),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  const store = await cookies();
  store.set(cookieName(), token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(cookieName())?.value;
  if (token) {
    await db.session.deleteMany({ where: { id: sha256Hex(token) } });
  }
  store.delete(cookieName());
}

/** Kullanıcının tüm oturumlarını kapatır (ör. şifre değişikliğinden sonra). */
export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

/**
 * Geçerli oturumun kullanıcısını döndürür. İstek başına bir kez çalışır.
 * Çerez okuduğu için çağıran bileşen <Suspense> içinde olmalıdır.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(cookieName())?.value;
  if (!token || token.length > 200) return null;
  // Oturum süresi kontrolü anlık zamana bağlıdır; yalnızca gerçek istek anında çalışmalı
  await connection();

  const session = await db.session.findUnique({
    where: { id: sha256Hex(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, email: true, name: true, artistName: true, role: true, disabledAt: true } },
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now() || session.user.disabledAt) {
    await db.session.deleteMany({ where: { id: sha256Hex(token) } });
    return null;
  }
  const { disabledAt: _disabled, ...user } = session.user;
  return user;
});

export function clientIpFromHeaders(h: Headers) {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return h.get("x-real-ip")?.slice(0, 64) ?? null;
}
